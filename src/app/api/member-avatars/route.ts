import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import {
  isInvalidIdTokenError,
  isUserNotFoundError,
  normalizeEmail,
  readMemberDirectory,
  resolveUserClaims,
  syncMemberPhoto,
} from "@/lib/auth-claims";
import { apiResponse, withApiObservability } from "@/lib/observability";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const AVATAR_RATE_LIMIT = 20;
const AVATAR_RATE_WINDOW_MS = 15 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function avatarError(message: string, status: number, step: string): Response {
  return apiResponse(
    { ok: false, error: message, step },
    status,
    step,
    { "Cache-Control": "no-store" }
  );
}

function errorCode(error: unknown): string {
  return isRecord(error) && typeof error.code === "string" ? error.code : "unknown";
}

export async function GET(request: Request): Promise<Response> {
  return withApiObservability(request, "/api/member-avatars", async () => {
    const authorization = request.headers.get("authorization") ?? "";
    const idToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    if (!idToken || idToken.length > 10_000) {
      return avatarError("A verified sign-in session is required.", 401, "authorization");
    }

    let adminAuth: ReturnType<typeof getAdminAuth>;
    try {
      adminAuth = getAdminAuth();
    } catch {
      return avatarError("Authentication is temporarily unavailable.", 503, "auth-initialization");
    }

    let decodedToken: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (error) {
      return isInvalidIdTokenError(error)
        ? avatarError("The sign-in session is invalid or expired.", 401, "token-verification")
        : avatarError("Could not verify the sign-in session. Try again.", 503, "token-verification");
    }

    const callerEmail = normalizeEmail(decodedToken.email);
    if (decodedToken.email_verified !== true || !callerEmail) {
      return avatarError("A verified account is required.", 403, "account-validation");
    }

    const limit = consumeRateLimit(`member-avatars:${decodedToken.uid}`, {
      limit: AVATAR_RATE_LIMIT,
      windowMs: AVATAR_RATE_WINDOW_MS,
    });
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSeconds, "Member photos are temporarily limited.");
    }

    let directory;
    try {
      directory = await readMemberDirectory();
    } catch {
      return avatarError("Could not load member access settings. Try again.", 503, "member-directory");
    }

    if (!resolveUserClaims(callerEmail, directory).active) {
      return avatarError("Active mess membership is required.", 403, "authorization");
    }

    let firestore: ReturnType<typeof getAdminFirestore>;
    try {
      firestore = getAdminFirestore();
    } catch {
      return avatarError("Could not initialize member profiles. Try again.", 503, "user-profiles");
    }

    const photos: { memberId: string; photoURL: string }[] = [];
    for (const member of directory.members) {
      const memberPhotoURL = typeof member.photoURL === "string" ? member.photoURL.trim() : "";
      if (memberPhotoURL) {
        photos.push({ memberId: member.id, photoURL: memberPhotoURL });
        continue;
      }

      const email = normalizeEmail(member.email);
      if (!email || !member.id) continue;

      let authUser: Awaited<ReturnType<typeof adminAuth.getUserByEmail>>;
      try {
        authUser = await adminAuth.getUserByEmail(email);
      } catch (error) {
        if (isUserNotFoundError(error)) continue;
        console.error("Could not look up a member profile photo.", { code: errorCode(error) });
        return avatarError("Could not resolve member photos. Try again.", 503, "auth-user-lookup");
      }

      let storedUserPhotoURL = "";
      try {
        const userProfile = await firestore.doc(`users/${authUser.uid}`).get();
        const storedPhoto = userProfile.data()?.photoURL;
        storedUserPhotoURL = typeof storedPhoto === "string" ? storedPhoto.trim() : "";
      } catch (error) {
        console.error("Could not read a member profile.", { code: errorCode(error) });
        return avatarError("Could not load member profiles. Try again.", 503, "user-profiles");
      }

      const photoURL = storedUserPhotoURL || authUser.photoURL?.trim() || "";
      if (!photoURL) continue;

      let resolvedPhotoURL: string | null;
      try {
        resolvedPhotoURL = await syncMemberPhoto(authUser.uid, email, photoURL);
      } catch (error) {
        console.error("Could not backfill a member profile photo.", { code: errorCode(error) });
        return avatarError("Could not save member photos. Try again.", 503, "photo-backfill");
      }

      if (resolvedPhotoURL) {
        photos.push({ memberId: member.id, photoURL: resolvedPhotoURL });
      }
    }

    return apiResponse(
      { ok: true, photos },
      200,
      "avatars-resolved",
      { "Cache-Control": "no-store" }
    );
  });
}
