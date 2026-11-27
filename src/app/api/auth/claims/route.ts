import { getAdminAuth } from "@/lib/firebase-admin";
import { recordServerAuditLog } from "@/lib/audit-log-server";
import {
  isInvalidIdTokenError,
  isUserNotFoundError,
  normalizeEmail,
  readMemberDirectory,
  resolveUserClaims,
  setUserClaimsIfChanged,
  syncMemberPhoto,
} from "@/lib/auth-claims";
import { formatMonthKey } from "@/lib/mess";
import { apiResponse, withApiObservability } from "@/lib/observability";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const CLAIMS_RATE_LIMIT = 30;
const CLAIMS_RATE_WINDOW_MS = 15 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function claimsError(message: string, status: number, step: string): Response {
  return apiResponse({ ok: false, error: message, step }, status, step);
}

export async function POST(request: Request): Promise<Response> {
  return withApiObservability(request, "/api/auth/claims", async () => {
    const authorization = request.headers.get("authorization") ?? "";
    const idToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    if (!idToken) {
      return claimsError("A verified sign-in session is required.", 401, "authorization");
    }

    let adminAuth: ReturnType<typeof getAdminAuth>;
    try {
      adminAuth = getAdminAuth();
    } catch {
      return claimsError("Authentication is temporarily unavailable.", 503, "auth-initialization");
    }

    let callerToken: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
    try {
      callerToken = await adminAuth.verifyIdToken(idToken, true);
    } catch (error) {
      return isInvalidIdTokenError(error)
        ? claimsError("The sign-in session is invalid or expired.", 401, "token-verification")
        : claimsError("Could not verify the sign-in session. Try again.", 503, "token-verification");
    }

    const callerEmail = normalizeEmail(callerToken.email);
    if (callerToken.email_verified !== true || !callerEmail) {
      return claimsError("A verified account is required.", 403, "account-validation");
    }

    const limit = consumeRateLimit(`auth-claims:${callerToken.uid}`, {
      limit: CLAIMS_RATE_LIMIT,
      windowMs: CLAIMS_RATE_WINDOW_MS,
    });
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfterSeconds, "Access updates are temporarily limited.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return claimsError("A valid JSON request body is required.", 400, "body-parsing");
    }

    const memberId = isRecord(body) && typeof body.memberId === "string"
      ? body.memberId.trim()
      : "";
    if (!memberId || memberId.length > 128 || memberId.includes("/")) {
      return claimsError("A valid member ID is required.", 400, "input-validation");
    }

    let directory;
    try {
      directory = await readMemberDirectory();
    } catch {
      return claimsError("Could not load member access settings. Try again.", 503, "member-directory");
    }

    const targetMember = directory.members.find((member) => member.id === memberId);
    if (!targetMember) {
      return claimsError("Member not found. Refresh the dashboard and try again.", 404, "member-lookup");
    }

    const callerClaims = resolveUserClaims(callerEmail, directory);
    const isSelfSync = normalizeEmail(targetMember.email) === callerEmail;
    const isAuthorizedAdmin = callerClaims.role === "super_admin" ||
      (callerClaims.role === "admin" && callerClaims.active);
    if (!isSelfSync && !isAuthorizedAdmin) {
      return claimsError("Only an administrator can synchronize another member's access.", 403, "authorization");
    }

    let photoSyncFailed = false;
    try {
      await syncMemberPhoto(callerToken.uid, callerEmail, callerToken.picture);
    } catch (error) {
      photoSyncFailed = true;
      const code = isRecord(error) && typeof error.code === "string"
        ? error.code
        : "unknown";
      console.error("Could not synchronize the profile photo during claims sync.", { code });
    }

    const targetEmail = normalizeEmail(targetMember.email);
    if (!targetEmail) {
      return apiResponse(
        { ok: true, synced: false, photoSyncFailed },
        200,
        "no-auth-account"
      );
    }

    let targetUser;
    try {
      targetUser = targetEmail === callerEmail
        ? await adminAuth.getUser(callerToken.uid)
        : await adminAuth.getUserByEmail(targetEmail);
    } catch (error) {
      if (isUserNotFoundError(error)) {
        return apiResponse(
          { ok: true, synced: false, photoSyncFailed },
          200,
          "no-auth-account"
        );
      }
      return claimsError("Could not look up the member's sign-in account. Try again.", 503, "auth-user-lookup");
    }

    const desiredClaims = resolveUserClaims(targetEmail, directory);
    let changed: boolean;
    try {
      changed = await setUserClaimsIfChanged(
        targetUser.uid,
        targetUser.customClaims,
        desiredClaims
      );
    } catch {
      return claimsError("The member change was saved, but access synchronization failed.", 503, "claims-update");
    }

    if (changed) {
      void recordServerAuditLog({
        action: "Access claims synchronized",
        category: "members",
        actorEmail: callerEmail,
        actorName: typeof callerToken.name === "string" && callerToken.name.trim()
          ? callerToken.name.trim()
          : callerEmail,
        summary: `Synchronized ${targetMember.name || targetEmail} as ${desiredClaims.role} (${desiredClaims.active ? "active" : "inactive"}).`,
        monthKey: formatMonthKey(new Date()),
      });
    }

    return apiResponse(
      { ok: true, synced: true, claimsChanged: changed, photoSyncFailed },
      200,
      "claims-synchronized"
    );
  });
}
