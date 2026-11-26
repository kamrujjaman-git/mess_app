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
  adminEmails: Set<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseMember(value: unknown): ClaimsMember | null {
  if (!isRecord(value)) return null;

  const status: Member["status"] = value.status === "removed"
    ? "removed"
    : value.status === "inactive" || value.active === false
      ? "inactive"
      : "active";

  return {
    id: typeof value.id === "string" ? value.id : "",
    name: typeof value.name === "string" ? value.name : "",
    email: typeof value.email === "string" ? value.email.trim() : "",
    status,
    active: value.active === false ? false : status !== "inactive" && status !== "removed",
    isAdmin: value.isAdmin === true,
    isBlocked: value.isBlocked === true,
    isRemoved: value.isRemoved === true || status === "removed",
  };
}

export async function readMemberDirectory(): Promise<MemberDirectory> {
  const snapshot = await getAdminFirestore().doc("settings/members").get();
  const settings = snapshot.data();
  const members = Array.isArray(settings?.members)
    ? settings.members.map(parseMember).filter((member): member is ClaimsMember => member !== null)
    : [];
  const adminEmails = new Set(
    Array.isArray(settings?.adminEmails)
      ? settings.adminEmails.map(normalizeEmail).filter(Boolean)
      : []
  );

  return { members, adminEmails };
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
