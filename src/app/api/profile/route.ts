import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore, getAdminStorage } from "@/lib/firebase-admin";
import type { ProfileUpdateResponse } from "@/lib/profile";

export const runtime = "nodejs";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function profileErrorResponse(error: string, status: number) {
  return NextResponse.json<ProfileUpdateResponse>({ ok: false, error }, { status });
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

async function uploadAvatar(file: File, uid: string): Promise<string> {
  if (file.size === 0 || file.size > MAX_AVATAR_SIZE) {
    throw new Error("The profile picture must be between 1 byte and 2MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const imageType = detectedImageType(bytes);
  if (!imageType || file.type !== imageType) {
    throw new Error("Choose a valid JPG, PNG, or WEBP image.");
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) {
    throw new Error("Profile picture storage is not configured. Contact an administrator.");
  }

  const objectPath = `users/${uid}/profile/avatar`;
  const downloadToken = randomUUID();
  const bucket = getAdminStorage().bucket(bucketName);
  await bucket.file(objectPath).save(bytes, {
    resumable: false,
    metadata: {
      contentType: imageType,
      cacheControl: "private, max-age=3600",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return profileErrorResponse("Sign in again before updating your profile.", 401);
  }

  let decodedToken;
  try {
    decodedToken = await getAdminAuth().verifyIdToken(token, true);
  } catch (error) {
    console.error("Profile update token verification failed:", error);
    return profileErrorResponse("The session is invalid or expired. Sign in again.", 401);
  }

  const callerEmail = normalizeEmail(decodedToken.email);
  if (decodedToken.email_verified !== true || !callerEmail) {
    return profileErrorResponse("A verified account is required to update your profile.", 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return profileErrorResponse("A valid profile update is required.", 400);
  }

  const rawName = formData.get("name");
  if (typeof rawName !== "string") {
    return profileErrorResponse("Enter a valid profile name.", 400);
  }
  const name = rawName.trim();
  if (!name || name.length > 80) {
    return profileErrorResponse("Names must be between 1 and 80 characters.", 400);
  }

  const rawAvatar = formData.get("avatar");
  if (rawAvatar !== null && (typeof File === "undefined" || !(rawAvatar instanceof File))) {
    return profileErrorResponse("Choose a valid image file.", 400);
  }

  let firestore: ReturnType<typeof getAdminFirestore>;
  try {
    firestore = getAdminFirestore();
  } catch (error) {
    console.error("Could not initialize the profile database:", error);
    return profileErrorResponse("Profile service is temporarily unavailable. Try again.", 503);
  }
  const userRef = firestore.doc(`users/${decodedToken.uid}`);
  const membersRef = firestore.doc("settings/members");
  try {
    const existingUser = await userRef.get();
    const storedEmail = normalizeEmail(existingUser.data()?.email);
    if (storedEmail && storedEmail !== callerEmail) {
      return profileErrorResponse(
        "Your account record does not match your sign-in email. Contact an administrator.",
        403
      );
    }
  } catch (error) {
    console.error("Could not verify the profile record:", error);
    return profileErrorResponse("Could not verify your profile record. Try again.", 503);
  }

  let photoURL: string | undefined;
  try {
    if (rawAvatar instanceof File) {
      photoURL = await uploadAvatar(rawAvatar, decodedToken.uid);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload the profile picture.";
    const isValidationError =
      message.startsWith("The profile picture") ||
      message.startsWith("Choose a valid") ||
      message.startsWith("Profile picture storage");
    if (!isValidationError) console.error("Profile picture upload failed:", error);
    return profileErrorResponse(message, isValidationError ? 400 : 503);
  }

  try {
    const authUpdates = photoURL ? { displayName: name, photoURL } : { displayName: name };
    const updatedUser = await getAdminAuth().updateUser(decodedToken.uid, authUpdates);
    const nextPhotoURL = updatedUser.photoURL || null;

    await firestore.runTransaction(async (transaction) => {
      const [userSnapshot, membersSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(membersRef),
      ]);
      const transactionEmail = normalizeEmail(userSnapshot.data()?.email);
      if (transactionEmail && transactionEmail !== callerEmail) {
        throw new Error("The profile email changed during the update. Contact an administrator.");
      }

      const members = membersSnapshot.data()?.members;
      const matchingMember = Array.isArray(members)
        ? members.find((member) => isRecord(member) && normalizeEmail(member.email) === callerEmail)
        : undefined;

      if (userSnapshot.exists || isRecord(matchingMember)) {
        const profilePatch: Record<string, unknown> = {
          name,
          email: decodedToken.email,
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
      }

      if (Array.isArray(members)) {
        let changed = false;
        const updatedMembers = members.map((member) => {
          if (!isRecord(member) || normalizeEmail(member.email) !== callerEmail) return member;
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
          transaction.update(membersRef, {
            members: updatedMembers,
            activeEmails: activeMembers.map((member) => normalizeEmail(member.email)),
            adminEmails: activeAdmins.map((member) => normalizeEmail(member.email)),
          });
        }
      }
    });

    return NextResponse.json<ProfileUpdateResponse>({
      ok: true,
      name,
      photoURL: nextPhotoURL,
    });
  } catch (error) {
    console.error("Profile record synchronization failed:", error);
    return profileErrorResponse(
      "Your sign-in profile may have updated, but the member record could not be synced. Save again or contact an administrator.",
      503
    );
  }
}
