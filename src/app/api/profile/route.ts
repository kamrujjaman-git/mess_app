import { randomUUID } from "node:crypto";
import {
  getAdminAuth,
  getAdminFirestore,
  getAdminStorageBuckets,
} from "@/lib/firebase-admin";
import { withIdempotency } from "@/lib/idempotency";
import { apiResponse, type ApiRequestContext, withApiObservability } from "@/lib/observability";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_INLINE_AVATAR_SIZE = 80 * 1024;
const MAX_MEMBERS_DOCUMENT_BYTES = 850 * 1024;
const PROFILE_RATE_LIMIT = 20;
const PROFILE_RATE_WINDOW_MS = 60 * 60 * 1000;

interface AvatarUploadResult {
  photoURL: string;
  isDataURL: boolean;
  usedFallback: boolean;
}

class ProfileUpdateError extends Error {
  constructor(message: string, readonly status: number, readonly step: string) {
    super(message);
    this.name = "ProfileUpdateError";
  }
}

type AdminAuth = ReturnType<typeof getAdminAuth>;
type DecodedProfileToken = Awaited<ReturnType<AdminAuth["verifyIdToken"]>>;

interface ProfileAuthorization {
  adminAuth: AdminAuth;
  decodedToken: DecodedProfileToken;
  callerEmail: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isInvalidIdTokenError(error: unknown): boolean {
  if (!isRecord(error) || typeof error.code !== "string") return false;
  return new Set([
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/invalid-id-token",
    "auth/user-disabled",
    "auth/user-not-found",
  ]).has(error.code);
}

function profileErrorResponse(error: string, status: number, step: string) {
  return apiResponse(
    { ok: false, error, step },
    status,
    step
  );
}

function isStorageBucketNotFound(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const message = typeof error.message === "string" ? error.message : "";
  return error.code === 404 ||
    error.code === "404" ||
    error.code === "storage/bucket-not-found" ||
    error.statusCode === 404 ||
    error.status === 404 ||
    (isRecord(error.response) && error.response.status === 404) ||
    /(?:specified )?bucket (?:does not exist|not found)/i.test(message);
}

function isStorageConfigurationError(error: unknown): boolean {
  if (isRecord(error) && error.step === "storage-configuration") return true;
  if (!(error instanceof Error)) return false;
  return /(?:Firebase )?Storage bucket (?:is not configured|configuration is invalid)|Use a Firebase Storage bucket/i
    .test(error.message);
}

function isTransientStorageError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const status = Number(error.statusCode ?? error.status ?? error.code);
  if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  return [
    "econnreset",
    "econnrefused",
    "etimedout",
    "eai_again",
    "storage/retry-limit-exceeded",
    "storage/unknown",
  ].includes(code);
}

function isDataImageURL(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(?:jpeg|png|webp);base64,/i.test(value);
}

function detectedImageType(bytes: Buffer): string | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function createInlineAvatar(bytes: Buffer, imageType: string): AvatarUploadResult {
  if (bytes.length > MAX_INLINE_AVATAR_SIZE) {
    throw new ProfileUpdateError(
      "This picture is too large to save without Firebase Storage. Choose a picture under 80KB.",
      413,
      "storage-fallback-size"
    );
  }
  return {
    photoURL: `data:${imageType};base64,${bytes.toString("base64")}`,
    isDataURL: true,
    usedFallback: true,
  };
}

async function uploadAvatar(file: File, uid: string): Promise<AvatarUploadResult> {
  if (file.size === 0 || file.size > MAX_AVATAR_SIZE) {
    throw new ProfileUpdateError(
      "The profile picture must be between 1 byte and 2MB.",
      400,
      "image-validation"
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const imageType = detectedImageType(bytes);
  if (!imageType || file.type !== imageType) {
    throw new ProfileUpdateError(
      "Choose a valid JPG, PNG, or WEBP image.",
      400,
      "image-validation"
    );
  }

  const objectPath = `users/${uid}/profile/avatar`;
  const downloadToken = randomUUID();
  let buckets: Awaited<ReturnType<typeof getAdminStorageBuckets>>;
  try {
    buckets = await getAdminStorageBuckets();
  } catch (error) {
    if (isStorageConfigurationError(error)) {
      return createInlineAvatar(bytes, imageType);
    }
    throw error;
  }
  const metadata = {
    resumable: false,
    metadata: {
      contentType: imageType,
      cacheControl: "private, max-age=3600",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  };
  let lastError: unknown;

  for (const bucket of buckets) {
    try {
      await bucket.file(objectPath).save(bytes, metadata);
      return {
        photoURL: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`,
        isDataURL: false,
        usedFallback: false,
      };
    } catch (error) {
      lastError = error;
      if (isTransientStorageError(error)) {
        return createInlineAvatar(bytes, imageType);
      }
      if (!isStorageBucketNotFound(error)) {
        throw error;
      }
    }
  }

  if (lastError && !isStorageBucketNotFound(lastError)) throw lastError;
  return createInlineAvatar(bytes, imageType);
}

async function authorizeProfileRequest(
  request: Request
): Promise<ProfileAuthorization | Response> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return profileErrorResponse(
      "Sign in again before updating your profile.",
      401,
      "authorization"
    );
  }

  let adminAuth: AdminAuth;
  try {
    adminAuth = getAdminAuth();
  } catch {
    return profileErrorResponse(
      "Firebase Admin credentials are missing or invalid. Contact an administrator.",
      503,
      "firebase-admin-initialization"
    );
  }

  let decodedToken: DecodedProfileToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token, true);
  } catch (error) {
    return isInvalidIdTokenError(error)
      ? profileErrorResponse(
        "The session is invalid or expired. Sign in again.",
        401,
        "token-verification"
      )
      : profileErrorResponse(
        "Could not verify your session right now. Try again.",
        503,
        "token-verification"
      );
  }

  const callerEmail = normalizeEmail(decodedToken.email);
  if (decodedToken.email_verified !== true || !callerEmail) {
    return profileErrorResponse(
      "A verified account is required to update your profile.",
      403,
      "account-validation"
    );
  }

  return { adminAuth, decodedToken, callerEmail };
}

async function updateProfile(
  request: Request,
  { adminAuth, decodedToken, callerEmail }: ProfileAuthorization,
  context: ApiRequestContext
) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return profileErrorResponse(
      "A valid profile update is required.",
      400,
      "body-parsing"
    );
  }

  const rawName = formData.get("name");
  if (typeof rawName !== "string") {
    return profileErrorResponse("Enter a valid profile name.", 400, "input-validation");
  }
  const name = rawName.trim();
  if (!name || name.length > 80) {
    return profileErrorResponse(
      "Names must be between 1 and 80 characters.",
      400,
      "input-validation"
    );
  }

  const rawAvatar = formData.get("avatar");
  if (rawAvatar !== null && (typeof File === "undefined" || !(rawAvatar instanceof File))) {
    return profileErrorResponse("Choose a valid image file.", 400, "image-validation");
  }

  let firestore: ReturnType<typeof getAdminFirestore>;
  try {
    firestore = getAdminFirestore();
  } catch {
    return profileErrorResponse(
      "Could not initialize the profile database. Try again or contact an administrator.",
      503,
      "firestore-initialization"
    );
  }
  const userRef = firestore.doc(`users/${decodedToken.uid}`);
  const membersRef = firestore.doc("settings/members");
  const profileRefs = new Map<string, typeof userRef>([[userRef.path, userRef]]);
  const tokenEmail = decodedToken.email?.trim() || callerEmail;
  const storedProfilePhotoURLs: string[] = [];
  try {
    const emailVariants = [...new Set([tokenEmail, callerEmail])];
    const [existingUser, ...emailProfiles] = await Promise.all([
      userRef.get(),
      ...emailVariants.map((email) =>
        firestore.collection("users").where("email", "==", email).get()
      ),
    ]);
    const existingUserData = existingUser.data();
    const storedEmail = normalizeEmail(existingUserData?.email);
    if (storedEmail && storedEmail !== callerEmail) {
      return profileErrorResponse(
        "Your account record does not match your sign-in email. Contact an administrator.",
        403,
        "profile-lookup"
      );
    }
    if (typeof existingUserData?.photoURL === "string") {
      storedProfilePhotoURLs.push(existingUserData.photoURL);
    }

    for (const profileSnapshot of emailProfiles) {
      for (const profile of profileSnapshot.docs) {
        profileRefs.set(profile.ref.path, profile.ref);
        const profilePhotoURL = profile.data().photoURL;
        if (typeof profilePhotoURL === "string") {
          storedProfilePhotoURLs.push(profilePhotoURL);
        }
      }
    }
  } catch {
    return profileErrorResponse(
      "Could not look up your profile records. Try again or contact an administrator.",
      503,
      "profile-lookup"
    );
  }

  let photoURL: string | undefined;
  let photoURLIsDataURL = false;
  let usedStorageFallback = false;
  try {
    if (rawAvatar instanceof File) {
      const uploadResult = await uploadAvatar(rawAvatar, decodedToken.uid);
      photoURL = uploadResult.photoURL;
      photoURLIsDataURL = uploadResult.isDataURL;
      usedStorageFallback = uploadResult.usedFallback;
    }
  } catch (error) {
    if (error instanceof ProfileUpdateError) {
      return profileErrorResponse(error.message, error.status, error.step);
    }
    return profileErrorResponse(
      "Could not upload your profile picture. Check storage configuration and try again.",
      503,
      "storage-upload"
    );
  }

  let updatedUser: Awaited<
    ReturnType<ReturnType<typeof getAdminAuth>["updateUser"]>
  >;
  try {
    const authUpdates = photoURL && !photoURLIsDataURL
      ? { displayName: name, photoURL }
      : { displayName: name };
    updatedUser = await adminAuth.updateUser(decodedToken.uid, authUpdates);
  } catch {
    return profileErrorResponse(
      "Could not update your sign-in profile. Try again or contact an administrator.",
      503,
      "auth-profile-update"
    );
  }

  let nextPhotoURL = photoURL ?? updatedUser.photoURL ?? null;
  try {
    await firestore.runTransaction(async (transaction) => {
      const [profileSnapshots, membersSnapshot] = await Promise.all([
        Promise.all([...profileRefs.values()].map((profileRef) => transaction.get(profileRef))),
        transaction.get(membersRef),
      ]);
      const userSnapshot = profileSnapshots.find(
        (profileSnapshot) => profileSnapshot.ref.path === userRef.path
      );
      if (!userSnapshot) {
        throw new Error("The signed-in profile record could not be read.");
      }
      const transactionEmail = normalizeEmail(userSnapshot.data()?.email);
      if (transactionEmail && transactionEmail !== callerEmail) {
        throw new ProfileUpdateError(
          "Your account record changed during the update. Contact an administrator.",
          403,
          "profile-lookup"
        );
      }

      const members = membersSnapshot.data()?.members;
      const matchesCaller = (member: unknown) =>
        isRecord(member) &&
        (normalizeEmail(member.email) === callerEmail ||
          member.uid === decodedToken.uid ||
          member.userId === decodedToken.uid ||
          member.id === decodedToken.uid);
      const matchingMember = Array.isArray(members)
        ? members.find(matchesCaller)
        : undefined;
      const memberPhotoURL = isRecord(matchingMember) &&
        typeof matchingMember.photoURL === "string"
        ? matchingMember.photoURL
        : null;
      const firestoreDataPhotoURL = [
        ...storedProfilePhotoURLs,
        ...(memberPhotoURL ? [memberPhotoURL] : []),
      ].find(isDataImageURL);
      const firestorePhotoURL = storedProfilePhotoURLs[0] ?? memberPhotoURL;
      nextPhotoURL = photoURL ??
        firestoreDataPhotoURL ??
        updatedUser.photoURL ??
        firestorePhotoURL ??
        null;

      const profilePatch: Record<string, unknown> = {
        name,
        email: tokenEmail,
        photoURL: nextPhotoURL,
      };
      if (!userSnapshot.exists && isRecord(matchingMember)) {
        profilePatch.status = matchingMember.status === "removed"
          ? "removed"
          : matchingMember.status === "inactive" || matchingMember.active === false
            ? "inactive"
            : "active";
        profilePatch.active = matchingMember.active !== false &&
          matchingMember.status !== "inactive" &&
          matchingMember.status !== "removed";
        profilePatch.isAdmin = matchingMember.isAdmin === true;
        profilePatch.isBlocked = matchingMember.isBlocked === true;
        profilePatch.isRemoved = matchingMember.isRemoved === true ||
          matchingMember.status === "removed";
        profilePatch.whatsAppNumber = String(matchingMember.whatsAppNumber ?? "").trim();
      }
      transaction.set(userRef, profilePatch, { merge: true });

      for (const profileSnapshot of profileSnapshots) {
        if (
          !profileSnapshot.exists ||
          profileSnapshot.ref.path === userRef.path ||
          normalizeEmail(profileSnapshot.data()?.email) !== callerEmail
        ) {
          continue;
        }
        transaction.set(profileSnapshot.ref, {
          name,
          email: tokenEmail,
          photoURL: nextPhotoURL,
        }, { merge: true });
      }

      if (Array.isArray(members)) {
        let changed = false;
        const updatedMembers = members.map((member) => {
          if (!matchesCaller(member)) return member;
          changed = true;
          return { ...member, name, photoURL: nextPhotoURL };
        });
        if (changed) {
          const activeMembers = updatedMembers.filter((member) =>
            isRecord(member) &&
            member.status !== "inactive" &&
            member.status !== "removed" &&
            member.active !== false &&
            member.isBlocked !== true &&
            member.isRemoved !== true &&
            normalizeEmail(member.email)
          );
          const activeAdmins = activeMembers.filter((member) =>
            isRecord(member) && member.isAdmin === true
          );
          const membersUpdate = {
            members: updatedMembers,
            activeEmails: activeMembers.map((member) => normalizeEmail(member.email)),
            adminEmails: activeAdmins.map((member) => normalizeEmail(member.email)),
          };
          const projectedMembersDocument = {
            ...membersSnapshot.data(),
            ...membersUpdate,
          };
          const hasDataURLAvatar = updatedMembers.some(
            (member) => isRecord(member) && isDataImageURL(member.photoURL)
          );
          const serializedDocument = JSON.stringify(projectedMembersDocument);
          if (
            hasDataURLAvatar &&
            serializedDocument &&
            Buffer.byteLength(serializedDocument, "utf8") > MAX_MEMBERS_DOCUMENT_BYTES
          ) {
            throw new ProfileUpdateError(
              "The member profile data is too large to store another inline picture. Reduce the roster picture sizes or provision Firebase Storage.",
              413,
              "firestore-roster-size"
            );
          }
          transaction.set(membersRef, membersUpdate, { merge: true });
        }
      }
    });

    const successResponse = apiResponse(
      { ok: true, name, photoURL: nextPhotoURL },
      200,
      usedStorageFallback ? "storage-fallback" : "complete"
    );
    if (usedStorageFallback) context.setStep("storage-fallback");
    return successResponse;
  } catch (error) {
    if (error instanceof ProfileUpdateError) {
      return profileErrorResponse(error.message, error.status, error.step);
    }
    return profileErrorResponse(
      "Your sign-in profile may have updated, but the member record could not be synced. Save again or contact an administrator.",
      503,
      "firestore-sync"
    );
  }
}

export async function POST(request: Request) {
  return withApiObservability(request, "/api/profile", async (context) => {
    try {
      const authorization = await authorizeProfileRequest(request);
      if (authorization instanceof Response) return authorization;

      return withIdempotency(
        request,
        `profile:${authorization.decodedToken.uid}`,
        async () => {
          const limit = consumeRateLimit(
            `profile:${authorization.decodedToken.uid}`,
            { limit: PROFILE_RATE_LIMIT, windowMs: PROFILE_RATE_WINDOW_MS }
          );
          if (!limit.allowed) {
            return rateLimitResponse(
              limit.retryAfterSeconds,
              "Profile updates are temporarily limited. Try again later."
            );
          }
          return updateProfile(request, authorization, context);
        }
      );
    } catch {
      return profileErrorResponse(
        "Could not update your profile because of a server error. Try again or contact an administrator.",
        500,
        "unexpected"
      );
    }
  });
}
