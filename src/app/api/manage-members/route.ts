import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { isInvalidIdTokenError, normalizeEmail } from "@/lib/auth-claims";
import {
  createDefaultMembers,
  isMemberActive,
  normalizeWhatsAppNumber,
  type Member,
} from "@/lib/mess";
import { withIdempotency } from "@/lib/idempotency";
import { apiResponse, withApiObservability } from "@/lib/observability";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MEMBER_MUTATION_RATE_LIMIT = 30;
const MEMBER_MUTATION_RATE_WINDOW_MS = 15 * 60 * 1000;

class MemberMutationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MemberMutationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEmailList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeEmail).filter(Boolean))].sort();
}

function parseMember(value: unknown, fallbackId: string, index: number): Member {
  const record = isRecord(value) ? value : {};
  const removed = record.isRemoved === true || record.status === "removed";
  const blocked = record.isBlocked === true;
  const status: Member["status"] = removed
    ? "removed"
    : record.status === "inactive" || record.active === false || blocked
      ? "inactive"
      : "active";
  const role = typeof record.role === "string" ? record.role.trim().toLowerCase() : "";

  return {
    id: typeof record.id === "string" ? record.id : fallbackId,
    name: typeof record.name === "string" ? record.name : `Member ${index + 1}`,
    email: typeof record.email === "string"
      ? record.email.trim()
      : fallbackId.includes("@")
        ? fallbackId
        : "",
    status,
    active: record.active === false ? false : status !== "inactive" && status !== "removed",
    isAdmin: record.isAdmin === true || role === "admin" || role === "super_admin",
    isBlocked: blocked,
    isRemoved: removed,
    whatsAppNumber: typeof record.whatsAppNumber === "string"
      ? record.whatsAppNumber.trim()
      : "",
    photoURL: typeof record.photoURL === "string" ? record.photoURL : null,
  };
}

function parseMembers(settings: Record<string, unknown> | undefined): Member[] {
  const roster = settings?.members;
  const entries = Array.isArray(roster)
    ? roster.map((member, index) => [`member-${index + 1}`, member] as const)
    : isRecord(roster)
      ? Object.entries(roster)
      : null;

  if (entries) {
    return entries.map(([key, member], index) => parseMember(member, key, index));
  }
  if (Array.isArray(settings?.names)) {
    return settings.names.map((name, index) => ({
      ...createDefaultMembers()[index % createDefaultMembers().length],
      id: `member-${index + 1}`,
      name: typeof name === "string" ? name : `Member ${index + 1}`,
    }));
  }
  return createDefaultMembers();
}

function activeEmailsFor(members: Member[]): string[] {
  return [...new Set(
    members
      .filter((member) => isMemberActive(member))
      .map((member) => normalizeEmail(member.email))
      .filter(Boolean)
  )].sort();
}

function memberState(
  settings: Record<string, unknown> | undefined
): { members: Member[]; activeEmails: string[]; adminEmails: string[] } {
  const parsedMembers = parseMembers(settings);
  const activeEmails = activeEmailsFor(parsedMembers);
  const hasAdminEmails = Boolean(
    settings && Object.prototype.hasOwnProperty.call(settings, "adminEmails")
  );
  const storedAdminEmails = normalizeEmailList(settings?.adminEmails);
  const adminEmails = hasAdminEmails
    ? storedAdminEmails.filter((email) => activeEmails.includes(email))
    : [...new Set(
      parsedMembers
        .filter((member) => isMemberActive(member) && member.isAdmin === true)
        .map((member) => normalizeEmail(member.email))
        .filter(Boolean)
    )].sort();
  const adminEmailSet = new Set(adminEmails);

  return {
    members: parsedMembers.map((member) => ({
      ...member,
      isAdmin: adminEmailSet.has(normalizeEmail(member.email)),
    })),
    activeEmails,
    adminEmails,
  };
}

function parseMemberInput(value: unknown): Member {
  if (!isRecord(value)) {
    throw new MemberMutationError("A valid member record is required.", 400);
  }
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = normalizeEmail(value.email);
  const phone = typeof value.whatsAppNumber === "string"
    ? value.whatsAppNumber.trim()
    : "";
  if (!id || id.length > 128 || id.includes("/")) {
    throw new MemberMutationError("A valid member ID is required.", 400);
  }
  if (!name || name.length > 120) {
    throw new MemberMutationError("Member names must be between 1 and 120 characters.", 400);
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new MemberMutationError("Enter a valid member email address.", 400);
  }
  if (phone.length > 64) {
    throw new MemberMutationError("The WhatsApp number is too long.", 400);
  }
  if (typeof value.isAdmin !== "boolean") {
    throw new MemberMutationError("A valid member role is required.", 400);
  }

  return {
    id,
    name,
    email,
    status: "active",
    active: true,
    isAdmin: value.isAdmin,
    whatsAppNumber: normalizeWhatsAppNumber(phone),
    photoURL: typeof value.photoURL === "string" ? value.photoURL : null,
  };
}

async function mutateMember(
  body: unknown,
  callerEmail: string
): Promise<void> {
  if (!isRecord(body)) {
    throw new MemberMutationError("A valid JSON request body is required.", 400);
  }
  const operation = body.operation;
  if (operation !== "add" && operation !== "update" && operation !== "status") {
    throw new MemberMutationError("The requested member operation is invalid.", 400);
  }

  const inputMember = operation === "add" || operation === "update"
    ? parseMemberInput(body.member)
    : null;
  const memberId = operation === "status" && typeof body.memberId === "string"
    ? body.memberId.trim()
    : inputMember?.id ?? "";
  if (!memberId || memberId.length > 128 || memberId.includes("/")) {
    throw new MemberMutationError("A valid member ID is required.", 400);
  }

  let requestedStatus: Member["status"] | null = null;
  if (operation === "status") {
    if (body.status !== "active" && body.status !== "inactive" && body.status !== "removed") {
      throw new MemberMutationError("A valid member status is required.", 400);
    }
    requestedStatus = body.status;
  }

  const firestore = getAdminFirestore();
  const membersRef = firestore.doc("settings/members");
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(membersRef);
    const settings = snapshot.data();
    const state = memberState(settings);
    const configuredSuperAdminEmail = normalizeEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL);
    const isSuperAdmin = Boolean(configuredSuperAdminEmail) &&
      callerEmail === configuredSuperAdminEmail;
    const isActiveAdmin = state.activeEmails.includes(callerEmail) &&
      state.adminEmails.includes(callerEmail);
    if (!isSuperAdmin && !isActiveAdmin) {
      throw new MemberMutationError("An active administrator session is required.", 403);
    }

    const nextMembers = [...state.members];
    let previousMember: Member | null = null;
    let nextMember: Member | null = null;
    if (operation === "add") {
      if (nextMembers.some((member) => member.id === memberId)) {
        throw new MemberMutationError("That member already exists. Refresh and try again.", 409);
      }
      nextMember = { ...inputMember!, isAdmin: false };
      nextMembers.push(nextMember);
    } else {
      const index = nextMembers.findIndex((member) => member.id === memberId);
      if (index < 0) {
        throw new MemberMutationError("Member not found. Refresh and try again.", 404);
      }
      previousMember = nextMembers[index];
      if (operation === "update") {
        if (inputMember!.isAdmin !== (previousMember.isAdmin === true) && !isSuperAdmin) {
          throw new MemberMutationError("Only the configured Super Admin can change administrator roles.", 403);
        }
        nextMember = {
          ...previousMember,
          name: inputMember!.name,
          email: inputMember!.email,
          whatsAppNumber: inputMember!.whatsAppNumber,
          isAdmin: isSuperAdmin ? inputMember!.isAdmin : Boolean(previousMember.isAdmin),
        };
      } else {
        nextMember = {
          ...previousMember,
          status: requestedStatus!,
          active: requestedStatus === "active",
          isRemoved: requestedStatus === "removed"
            ? true
            : requestedStatus === "active"
              ? false
              : Boolean(previousMember.isRemoved),
          isBlocked: requestedStatus === "active" ? false : Boolean(previousMember.isBlocked),
        };
      }
      nextMembers[index] = nextMember;
    }

    const profileRefs = new Map<string, FirebaseFirestore.DocumentReference>();
    if (operation !== "add" && previousMember && nextMember) {
      const directProfileRef = firestore.doc(`users/${memberId}`);
      const directProfileSnapshot = await transaction.get(directProfileRef);
      if (directProfileSnapshot.exists) {
        profileRefs.set(directProfileRef.path, directProfileRef);
      }

      const emails = [...new Set(
        [previousMember.email, nextMember.email]
          .map((email) => email.trim())
          .filter(Boolean)
          .flatMap((email) => [email, email.toLowerCase()])
      )];
      const profileSnapshots = await Promise.all(
        emails.map((email) =>
          transaction.get(firestore.collection("users").where("email", "==", email))
        )
      );
      for (const profileSnapshot of profileSnapshots) {
        for (const profile of profileSnapshot.docs) {
          profileRefs.set(profile.ref.path, profile.ref);
        }
      }
    }

    const nextState = memberState({
      ...(settings ?? {}),
      members: nextMembers,
      adminEmails: nextMembers
        .filter((member) => isMemberActive(member) && member.isAdmin === true)
        .map((member) => normalizeEmail(member.email))
        .filter(Boolean),
    });
    transaction.set(membersRef, {
      ...(settings ?? {}),
      members: nextState.members,
      activeEmails: nextState.activeEmails,
      adminEmails: nextState.adminEmails,
    });

    for (const profileRef of profileRefs.values()) {
      const profilePatch: Record<string, unknown> = {
        email: nextMember!.email,
        name: nextMember!.name,
        isAdmin: Boolean(nextMember!.isAdmin),
        status: nextMember!.status,
        active: nextMember!.active !== false,
        isBlocked: Boolean(nextMember!.isBlocked),
        isRemoved: Boolean(nextMember!.isRemoved),
      };
      transaction.update(profileRef, profilePatch);
    }
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApiObservability(request, "/api/manage-members", async () => {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    if (!token) {
      return apiResponse({ ok: false, error: "A verified administrator session is required." }, 401, "authorization");
    }

    let adminAuth: ReturnType<typeof getAdminAuth>;
    try {
      adminAuth = getAdminAuth();
    } catch {
      return apiResponse({ ok: false, error: "Authentication is temporarily unavailable." }, 503, "auth-initialization");
    }

    let decodedToken: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
    try {
      decodedToken = await adminAuth.verifyIdToken(token, true);
    } catch (error) {
      return isInvalidIdTokenError(error)
        ? apiResponse({ ok: false, error: "The sign-in session is invalid or expired." }, 401, "token-verification")
        : apiResponse({ ok: false, error: "Could not verify the sign-in session. Try again." }, 503, "token-verification");
    }

    const callerEmail = normalizeEmail(decodedToken.email);
    if (decodedToken.email_verified !== true || !callerEmail) {
      return apiResponse({ ok: false, error: "A verified account is required." }, 403, "account-validation");
    }

    return withIdempotency(request, `manage-members:${decodedToken.uid}`, async () => {
      const limit = consumeRateLimit(`manage-members:${decodedToken.uid}`, {
        limit: MEMBER_MUTATION_RATE_LIMIT,
        windowMs: MEMBER_MUTATION_RATE_WINDOW_MS,
      });
      if (!limit.allowed) {
        return rateLimitResponse(limit.retryAfterSeconds, "Member updates are temporarily limited.");
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return apiResponse({ ok: false, error: "A valid JSON request body is required." }, 400, "body-parsing");
      }

      try {
        await mutateMember(body, callerEmail);
        return apiResponse({ ok: true }, 200, "complete");
      } catch (error) {
        if (error instanceof MemberMutationError) {
          return apiResponse({ ok: false, error: error.message }, error.status, "member-validation");
        }
        const code = isRecord(error) && typeof error.code === "string" ? error.code : "unknown";
        console.error("Could not complete the member mutation.", { code });
        return apiResponse(
          { ok: false, error: "The member change could not be completed. Refresh and try again." },
          500,
          "member-mutation"
        );
      }
    });
  });
}
