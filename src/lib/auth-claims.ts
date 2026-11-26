import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { isMemberActive, type Member } from "@/lib/mess";

export type UserRole = "super_admin" | "admin" | "member";

export interface UserClaims {
  role: UserRole;
  active: boolean;
}

type ClaimsMember = Pick<
  Member,
  "id" | "name" | "email" | "status" | "active" | "isAdmin" | "isBlocked" | "isRemoved"
>;

export interface MemberDirectory {
  members: ClaimsMember[];
  activeEmails: Set<string>;
  adminEmails: Set<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseMember(value: unknown, fallbackId = "", fallbackEmail = ""): ClaimsMember | null {
  if (!isRecord(value)) return null;

  const isRemoved = value.isRemoved === true || value.status === "removed";
  const isBlocked = value.isBlocked === true;
  const status: Member["status"] = isRemoved
    ? "removed"
    : value.status === "inactive" || value.active === false || isBlocked
      ? "inactive"
      : "active";
  const role = typeof value.role === "string" ? value.role.trim().toLowerCase() : "";

  return {
    id: typeof value.id === "string" ? value.id : fallbackId,
    name: typeof value.name === "string" ? value.name : "",
    email: typeof value.email === "string" ? value.email.trim() : fallbackEmail,
    status,
    active: value.active === false ? false : status !== "inactive" && status !== "removed",
    isAdmin: value.isAdmin === true || role === "admin" || role === "super_admin",
    isBlocked,
    isRemoved,
  };
}

function parseMembers(value: unknown): ClaimsMember[] {
  const records = Array.isArray(value)
    ? value.map((member, index) => [`member-${index + 1}`, member] as const)
    : isRecord(value)
      ? Object.entries(value)
      : [];

  return records
    .map(([key, member]) => parseMember(
      member,
      key,
      key.includes("@") ? key : ""
    ))
    .filter((member): member is ClaimsMember => member !== null);
}

function normalizeEmailList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeEmail).filter(Boolean))].sort();
}

function memberEmails(
  members: ClaimsMember[],
  predicate: (member: ClaimsMember) => boolean
): string[] {
  return [...new Set(
    members
      .filter((member) => predicate(member) && normalizeEmail(member.email))
      .map((member) => normalizeEmail(member.email))
  )].sort();
}

function matchesCanonicalEmailList(value: unknown, expected: string[]): boolean {
  return Array.isArray(value) &&
    value.length === expected.length &&
    value.every((email, index) => email === expected[index]);
}

export async function readMemberDirectory(): Promise<MemberDirectory> {
  const firestore = getAdminFirestore();
  const membersRef = firestore.doc("settings/members");

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(membersRef);
    const settings = snapshot.data();
    const members = parseMembers(settings?.members);
    const hasRoster = Array.isArray(settings?.members) || isRecord(settings?.members);
    const rawRosterSize = Array.isArray(settings?.members)
      ? settings.members.length
      : isRecord(settings?.members)
        ? Object.keys(settings.members).length
        : 0;
    const storedActiveEmails = normalizeEmailList(settings?.activeEmails);
    const storedAdminEmails = normalizeEmailList(settings?.adminEmails);
    const rosterHasEmail = (members.length === 0 && rawRosterSize === 0) ||
      members.some((member) => Boolean(normalizeEmail(member.email)));

    let activeEmails = storedActiveEmails;
    let adminEmails = storedAdminEmails;

    if (snapshot.exists && hasRoster && rosterHasEmail) {
      activeEmails = memberEmails(members, isMemberActive);
      adminEmails = memberEmails(
        members,
        (member) => isMemberActive(member) && member.isAdmin === true
      );

      if (
        !matchesCanonicalEmailList(settings?.activeEmails, activeEmails) ||
        !matchesCanonicalEmailList(settings?.adminEmails, adminEmails)
      ) {
        transaction.set(membersRef, { activeEmails, adminEmails }, { merge: true });
      }
    }

    return {
      members,
      activeEmails: new Set(activeEmails),
      adminEmails: new Set(adminEmails),
    };
  });
}

export function resolveUserClaims(
  email: string,
  directory: MemberDirectory
): UserClaims {
  const normalizedEmail = normalizeEmail(email);
  const configuredSuperAdminEmail = normalizeEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL);
  if (normalizedEmail && normalizedEmail === configuredSuperAdminEmail) {
    return { role: "super_admin", active: true };
  }

  const member = directory.members.find(
    (candidate) => normalizeEmail(candidate.email) === normalizedEmail
  );
  const isAdmin = directory.adminEmails.has(normalizedEmail) || member?.isAdmin === true;

  return {
    role: isAdmin ? "admin" : "member",
    active: Boolean(member && isMemberActive(member)),
  };
}

export function claimsChanged(existingClaims: unknown, desiredClaims: UserClaims): boolean {
  const claims = isRecord(existingClaims) ? existingClaims : {};
  return claims.role !== desiredClaims.role || claims.active !== desiredClaims.active;
}

export async function setUserClaimsIfChanged(
  uid: string,
  existingClaims: unknown,
  desiredClaims: UserClaims
): Promise<boolean> {
  if (!claimsChanged(existingClaims, desiredClaims)) return false;
  await getAdminAuth().setCustomUserClaims(uid, {
    role: desiredClaims.role,
    active: desiredClaims.active,
  });
  return true;
}

export function isInvalidIdTokenError(error: unknown): boolean {
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

export function isUserNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === "auth/user-not-found";
}
