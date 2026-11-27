import { getAdminAuth } from "@/lib/firebase-admin";
import {
  isInvalidIdTokenError,
  normalizeEmail,
  readMemberDirectory,
  resolveUserClaims,
  setUserClaimsIfChanged,
  syncMemberPhoto,
} from "@/lib/auth-claims";
import { apiResponse, withApiObservability } from "@/lib/observability";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SESSION_COOKIE_NAME = "__session";
const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;
const SESSION_RATE_LIMIT = 30;
const SESSION_RATE_WINDOW_MS = 15 * 60 * 1000;
const COOKIE_CLEAR_RATE_LIMIT = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cookieAttributes(): string {
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

function sessionError(message: string, status: number, step: string): Response {
  return apiResponse({ ok: false, error: message, step }, status, step);
}

function setSessionCookie(
  sessionCookie: string,
  claimsChanged: boolean,
  photoSyncFailed: boolean
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Set-Cookie": `${SESSION_COOKIE_NAME}=${sessionCookie}; Max-Age=${SESSION_EXPIRES_IN_MS / 1000}; ${cookieAttributes()}`,
  });
  return apiResponse(
    { ok: true, claimsChanged, photoSyncFailed },
    200,
    "session-created",
    headers
  );
}

export async function POST(request: Request): Promise<Response> {
  return withApiObservability(request, "/api/auth/session", async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return sessionError("A valid JSON request body is required.", 400, "body-parsing");
    }

    const idToken = isRecord(body) && typeof body.idToken === "string"
      ? body.idToken.trim()
      : "";
    if (!idToken || idToken.length > 10_000) {
      return sessionError("A valid sign-in token is required.", 400, "input-validation");
    }

    let adminAuth: ReturnType<typeof getAdminAuth>;
    try {
      adminAuth = getAdminAuth();
    } catch {
      return sessionError(
        "Authentication is temporarily unavailable. Try again later.",
        503,
        "auth-initialization"
      );
    }

    let decodedToken: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (error) {
      return isInvalidIdTokenError(error)
        ? sessionError("The sign-in token is invalid or expired.", 401, "token-verification")
        : sessionError("Could not verify the sign-in token. Try again.", 503, "token-verification");
    }

    const email = normalizeEmail(decodedToken.email);
    if (decodedToken.email_verified !== true || !email) {
      return sessionError("A verified account is required.", 403, "account-validation");
    }

    const limit = consumeRateLimit(`auth-session:${decodedToken.uid}`, {
      limit: SESSION_RATE_LIMIT,
      windowMs: SESSION_RATE_WINDOW_MS,
    });
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSeconds, "Session updates are temporarily limited.");
    }

    let directory;
    try {
      directory = await readMemberDirectory();
    } catch {
      return sessionError("Could not load member access settings. Try again.", 503, "member-directory");
    }

    let photoSyncFailed = false;
    try {
      await syncMemberPhoto(decodedToken.uid, email, decodedToken.picture);
    } catch (error) {
      photoSyncFailed = true;
      const code = isRecord(error) && typeof error.code === "string"
        ? error.code
        : "unknown";
      console.error("Could not synchronize the profile photo during session setup.", { code });
    }

    const desiredClaims = resolveUserClaims(email, directory);
    let claimsChanged: boolean;
    try {
      claimsChanged = await setUserClaimsIfChanged(
        decodedToken.uid,
        decodedToken,
        desiredClaims
      );
    } catch {
      return sessionError("Could not synchronize account access. Try again.", 503, "claims-update");
    }

    let sessionCookie: string;
    try {
      sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn: SESSION_EXPIRES_IN_MS,
      });
    } catch {
      return sessionError("Could not create a secure session. Try again.", 503, "cookie-creation");
    }

    return setSessionCookie(sessionCookie, claimsChanged, photoSyncFailed);
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return withApiObservability(request, "/api/auth/session", async () => {
    const address = request.headers.get("x-real-ip")?.trim() ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const limit = consumeRateLimit(`auth-session-delete:${address}`, {
      limit: COOKIE_CLEAR_RATE_LIMIT,
      windowMs: SESSION_RATE_WINDOW_MS,
    });
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSeconds, "Session clearing is temporarily limited.");
    }

    const headers = new Headers({
      "Cache-Control": "no-store",
      "Set-Cookie": `${SESSION_COOKIE_NAME}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${cookieAttributes()}`,
    });
    return apiResponse({ ok: true }, 200, "session-cleared", headers);
  });
}
