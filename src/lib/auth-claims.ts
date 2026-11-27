import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { isMemberActive, type Member } from "@/lib/mess";

export type UserRole = "super_admin" | "admin" | "member";

export interface UserClaims {
  role: UserRole;
  active: boolean;
}

type ClaimsMember = Pick<
  Member,
  "id" | "name" | "email" | "status" | "active" | "isAdmin" | "isBlocked" | "isRemoved" | "photoURL"
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
    photoURL: typeof value.photoURL === "string" && value.photoURL.trim()
      ? value.photoURL.trim()
      : null,
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

function storedPhotoURL(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isMemberEmail(value: unknown, fallbackKey: string, email: string): boolean {
  if (!isRecord(value)) return false;
  const memberEmail = normalizeEmail(value.email) ||
    (fallbackKey.includes("@") ? normalizeEmail(fallbackKey) : "");
  return memberEmail === email;
}

function rosterPhotoURL(roster: unknown, email: string): string {
  if (Array.isArray(roster)) {
    for (const member of roster) {
      if (isMemberEmail(member, "", email)) {
        const photoURL = storedPhotoURL(isRecord(member) ? member.photoURL : null);
        if (photoURL) return photoURL;
      }
    }
  } else if (isRecord(roster)) {
    for (const [key, member] of Object.entries(roster)) {
      if (isMemberEmail(member, key, email)) {
        const photoURL = storedPhotoURL(isRecord(member) ? member.photoURL : null);
        if (photoURL) return photoURL;
      }
    }
  }
  return "";
}

function rosterWithPhotoURL(
  roster: unknown,
  email: string,
  photoURL: string
): { roster: unknown; changed: boolean } {
  if (Array.isArray(roster)) {
    let changed = false;
    const updatedRoster = roster.map((member) => {
      if (
        !isRecord(member) ||
        !isMemberEmail(member, "", email) ||
        storedPhotoURL(member.photoURL)
      ) {
        return member;
      }
      changed = true;
      return { ...member, photoURL };
    });
    return { roster: updatedRoster, changed };
  }

  if (isRecord(roster)) {
    let changed = false;
    const updatedRoster = { ...roster };
    for (const [key, member] of Object.entries(roster)) {
      if (
        !isRecord(member) ||
        !isMemberEmail(member, key, email) ||
        storedPhotoURL(member.photoURL)
      ) {
        continue;
      }
      updatedRoster[key] = { ...member, photoURL };
      changed = true;
    }
    return { roster: updatedRoster, changed };
  }

  return { roster, changed: false };
}

function verifiedPhotoURL(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 4096) return "";
  try {
    return new URL(value).protocol === "https:" ? value.trim() : "";
  } catch {
    return "";
  }
}

export async function syncMemberPhoto(
  uid: string,
  email: string,
  photoURL: unknown
): Promise<string | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!uid.trim() || !normalizedEmail) {
    throw new Error("A user ID and verified email are required to synchronize a profile photo.");
  }

  const firestore = getAdminFirestore();
  const userRef = firestore.doc(`users/${uid}`);
  const membersRef = firestore.doc("settings/members");
  const tokenPhotoURL = verifiedPhotoURL(photoURL);

  return firestore.runTransaction(async (transaction) => {
    const [userSnapshot, membersSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(membersRef),
    ]);
    const settings = membersSnapshot.data();
    const roster = settings?.members;
    const memberPhotoURL = rosterPhotoURL(roster, normalizedEmail);
    const userPhotoURL = storedPhotoURL(userSnapshot.data()?.photoURL);
    const resolvedPhotoURL = memberPhotoURL || userPhotoURL || tokenPhotoURL;
    if (!resolvedPhotoURL) return null;

    if (!userPhotoURL) {
      transaction.set(userRef, { photoURL: resolvedPhotoURL }, { merge: true });
    }

    if (membersSnapshot.exists && !memberPhotoURL) {
      const updated = rosterWithPhotoURL(roster, normalizedEmail, resolvedPhotoURL);
      if (updated.changed) {
        transaction.set(membersRef, { members: updated.roster }, { merge: true });
      }
    }

    return resolvedPhotoURL;
  });
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
