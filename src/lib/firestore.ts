import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  runTransaction,
  type Transaction,
  Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { createIdempotencyKey } from "./idempotency";
import {
  BazarEntry,
  DailyMealRecord,
  DepositEntry,
  MonthBills,
  Member,
  BillField,
  BILL_LABELS,
  CarryForwardBalance,
  createDefaultMembers,
  createEmptyDailyMeals,
  formatCurrency,
  formatMonthKey,
  formatMonthLabel,
  getPreviousMonthKey,
  getAllowedMemberEmails,
  getActiveMembers,
  isMemberActive,
  isDateOnOrBeforeToday,
} from "./mess";
import { recordAuditLog } from "./audit-log";

function monthDoc(monthKey: string) {
  return doc(db, "months", monthKey);
}

function dailyMealsCollection(monthKey: string) {
  return collection(db, "months", monthKey, "dailyMeals");
}

function bazarCollection(monthKey: string) {
  return collection(db, "months", monthKey, "bazar");
}

function depositsCollection(monthKey: string) {
  return collection(db, "months", monthKey, "deposits");
}

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const CARRY_FORWARD_CHUNK_SIZE = 400;

export function getCarryForwardDepositId(
  sourceMonthKey: string,
  memberId: string
): string {
  if (!MONTH_KEY_PATTERN.test(sourceMonthKey) || !memberId.trim()) {
    throw new Error("A valid source month and member are required.");
  }
  return `cf_${sourceMonthKey}_${encodeURIComponent(memberId)}`;
}

function assertEntryDate(monthKey: string, date: string): void {
  if (!date.startsWith(`${monthKey}-`) || !isDateOnOrBeforeToday(date)) {
    throw new Error("Entries can only be saved for valid dates in the selected month up to today.");
  }
}

function assertPositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amounts must be greater than zero.");
  }
}

function assertNonNegativeAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Bill amounts cannot be negative.");
  }
}

function configuredSuperAdminEmail(): string {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

function assertSuperAdmin(): string {
  const user = auth.currentUser;
  const userEmail = user?.email?.trim() ?? "";
  const email = userEmail.toLowerCase();
  const configuredEmail = configuredSuperAdminEmail();
  if (!user || !user.emailVerified || !userEmail || !configuredEmail || email !== configuredEmail) {
    throw new Error("Only the configured Super Admin can delete members.");
  }
  return userEmail;
}

function getActivityAuthor(): string {
  const email = auth.currentUser?.email?.trim();
  if (!email) {
    throw new Error("An authenticated user email is required for activity logs.");
  }
  return email;
}

function adminEmailsForMembers(members: Member[]): string[] {
  return members
    .filter((member) => isMemberActive(member) && member.isAdmin === true && member.email.trim())
    .map((member) => member.email.trim().toLowerCase());
}

function memberAccessFields(members: Member[]) {
  return {
    activeEmails: getAllowedMemberEmails(members),
    adminEmails: adminEmailsForMembers(members),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function postMemberMutation(payload: Record<string, unknown>): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Sign in again before changing members.");
  }

  const response = await fetch("/api/manage-members", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": createIdempotencyKey(),
    },
    body: JSON.stringify(payload),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      isRecord(result) && typeof result.error === "string"
        ? result.error
        : "The member change could not be completed. Refresh and try again."
    );
  }
  if (!isRecord(result) || result.ok !== true) {
    throw new Error("The member change could not be confirmed. Refresh and try again.");
  }
}

function parseMembers(data: Record<string, unknown> | undefined): Member[] {
  if (!data) return createDefaultMembers();

  const memberRecords = Array.isArray(data.members)
    ? data.members.map((member, index) => [`member-${index + 1}`, member] as const)
    : data.members && typeof data.members === "object"
      ? Object.entries(data.members as Record<string, unknown>)
      : null;

  if (memberRecords) {
    return memberRecords.map(([key, value], index) => {
      const member = value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
      const role = typeof member.role === "string" ? member.role.trim().toLowerCase() : "";
      return {
        id: typeof member.id === "string" ? member.id : key,
        name: String(member.name ?? `Member ${index + 1}`),
        email: String(member.email ?? (key.includes("@") ? key : "")),
        status: member.status === "removed"
          ? "removed"
          : member.status === "inactive" || member.active === false
            ? "inactive"
            : "active",
        active:
          member.active === false
            ? false
            : member.status !== "inactive" && member.status !== "removed",
        isAdmin: member.isAdmin === true || role === "admin" || role === "super_admin",
        isBlocked: member.isBlocked === true,
        isRemoved: member.isRemoved === true || member.status === "removed",
        whatsAppNumber: String(member.whatsAppNumber ?? "").trim(),
        photoURL: typeof member.photoURL === "string" ? member.photoURL : null,
      };
    });
  }

  if (Array.isArray(data.names)) {
    return (data.names as string[]).map((name, i) => ({
      id: `member-${i + 1}`,
      name,
      email: "",
      status: "active" as const,
      active: true,
      isAdmin: false,
      whatsAppNumber: "",
    }));
  }

  return createDefaultMembers();
}

export async function getMembers(): Promise<Member[]> {
  const snap = await getDoc(doc(db, "settings", "members"));
  return parseMembers(snap.exists() ? snap.data() : undefined);
}

export async function getActiveMemberEmails(): Promise<string[]> {
  const members = await getMembers();
  return getAllowedMemberEmails(members);
}

export async function getUserByUid(uid: string): Promise<Member | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();

  const status = data.status === "removed"
    ? "removed"
    : data.status === "inactive" || data.active === false
      ? "inactive"
      : "active";

  return {
    id: uid,
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    status,
    active: data.active === false ? false : status !== "inactive" && status !== "removed",
    isAdmin: Boolean(data.isAdmin),
    isBlocked: Boolean(data.isBlocked),
    isRemoved: Boolean(data.isRemoved) || status === "removed",
    whatsAppNumber: String(data.whatsAppNumber ?? "").trim(),
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
  };
}

export async function getUserByEmail(email: string): Promise<Member | null> {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  const status = data.status === "removed"
    ? "removed"
    : data.status === "inactive" || data.active === false
      ? "inactive"
      : "active";

  return {
    id: d.id,
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    status,
    active: data.active === false ? false : status !== "inactive" && status !== "removed",
    isAdmin: Boolean(data.isAdmin),
    isBlocked: Boolean(data.isBlocked),
    isRemoved: Boolean(data.isRemoved) || status === "removed",
    whatsAppNumber: String(data.whatsAppNumber ?? "").trim(),
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
  };
}

export async function updateUserEmail(userDocId: string, email: string, name?: string): Promise<void> {
  const userRef = doc(db, "users", userDocId);
  const payload: Record<string, unknown> = { email };
  if (typeof name !== "undefined") payload.name = name;
  await setDoc(userRef, payload, { merge: true });
}

export async function setMembers(members: Member[]): Promise<void> {
  await setDoc(doc(db, "settings", "members"), {
    members,
    ...memberAccessFields(members),
  });
}

export function subscribeToMembers(
  callback: (members: Member[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(doc(db, "settings", "members"), (snap) => {
    callback(parseMembers(snap.exists() ? snap.data() : undefined));
  }, onError);
}

export async function addMember(
  name: string,
  email: string,
  whatsAppNumber?: string
): Promise<Member> {
  const newMember: Member = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    status: "active",
    active: true,
    isAdmin: false,
    whatsAppNumber: String(whatsAppNumber ?? "").trim(),
  };
  await postMemberMutation({ operation: "add", member: newMember });
  recordAuditLog({
    action: "Member added",
    category: "members",
    summary: `Added ${newMember.name}${newMember.email ? ` (${newMember.email})` : ""}.`,
    monthKey: formatMonthKey(new Date()),
  });
  return newMember;
}

export async function updateMember(updated: Member): Promise<void> {
  const membersRef = doc(db, "settings", "members");
  const normalizedMember = {
    ...updated,
    name: updated.name.trim(),
    email: updated.email.trim().toLowerCase(),
  };

  const initialSnapshot = await getDoc(membersRef);
  const initialMembers = parseMembers(
    initialSnapshot.exists() ? initialSnapshot.data() : undefined
  );
  const initialMember = initialMembers.find((member) => member.id === updated.id);
  if (!initialMember) {
    throw new Error("Member not found. Refresh the dashboard and try again.");
  }
  await postMemberMutation({ operation: "update", member: normalizedMember });

  const previousIsAdmin = initialMember.isAdmin === true;
  const nextIsAdmin = normalizedMember.isAdmin === true;
  if (previousIsAdmin !== nextIsAdmin) {
    recordAuditLog({
      action: nextIsAdmin ? "Admin access granted" : "Admin access revoked",
      category: "members",
      summary: `${normalizedMember.name} was ${nextIsAdmin ? "promoted to" : "demoted from"} admin.`,
      monthKey: formatMonthKey(new Date()),
    });
  }
  if (
    initialMember.status !== normalizedMember.status ||
    isMemberActive(initialMember) !== isMemberActive(normalizedMember)
  ) {
    recordAuditLog({
      action: "Member status changed",
      category: "members",
      summary: `${normalizedMember.name} was marked ${normalizedMember.status}.`,
      monthKey: formatMonthKey(new Date()),
    });
  }
}

export async function syncMemberClaims(memberId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Sign in again before synchronizing member access.");
  }

  const response = await fetch("/api/auth/claims", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ memberId }),
    cache: "no-store",
  });

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok) {
    const message = result &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      "error" in result &&
      typeof result.error === "string"
      ? result.error
      : "Member access was saved, but claims synchronization failed.";
    throw new Error(message);
  }
}

const memberDeletionRequests = new Map<string, Promise<void>>();

export async function deleteMember(memberId: string): Promise<void> {
  assertSuperAdmin();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("An authenticated Super Admin is required to delete members.");
  }

  const existingRequest = memberDeletionRequests.get(memberId);
  if (existingRequest) return existingRequest;

  const deletionRequest = (async () => {
    const response = await fetch("/api/delete-member", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": createIdempotencyKey(),
      },
      body: JSON.stringify({ memberId }),
    });
    const result = await response.json().catch(() => ({})) as { error?: unknown };
    if (!response.ok) {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : "Member deletion failed. Refresh the dashboard and try again."
      );
    }
  })();
  memberDeletionRequests.set(memberId, deletionRequest);
  try {
    await deletionRequest;
  } finally {
    if (memberDeletionRequests.get(memberId) === deletionRequest) {
      memberDeletionRequests.delete(memberId);
    }
  }
}

export async function setMemberStatus(
  memberId: string,
  status: Member["status"]
): Promise<void> {
  const initialSnapshot = await getDoc(doc(db, "settings", "members"));
  const initialMembers = parseMembers(
    initialSnapshot.exists() ? initialSnapshot.data() : undefined
  );
  const initialMember = initialMembers.find((member) => member.id === memberId);
  if (!initialMember) {
    throw new Error("Member not found. Refresh the dashboard and try again.");
  }

  await postMemberMutation({ operation: "status", memberId, status });

  if (initialMember.status !== status) {
    recordAuditLog({
      action: "Member status changed",
      category: "members",
      summary: `${initialMember.name} was marked ${status}.`,
      monthKey: formatMonthKey(new Date()),
    });
  }
}

export async function getMonthBills(monthKey: string): Promise<MonthBills> {
  const snap = await getDoc(monthDoc(monthKey));
  if (snap.exists()) {
    const data = snap.data();
    return {
      houseRent: data.houseRent ?? 0,
      buaBill: data.buaBill ?? 0,
      otherBills: data.otherBills ?? 0,
      otherBillsDescription: String(data.otherBillsDescription ?? ""),
    };
  }
  return { houseRent: 0, buaBill: 0, otherBills: 0, otherBillsDescription: "" };
}

export async function updateMonthBills(
  monthKey: string,
  bills: MonthBills
): Promise<void> {
  assertNonNegativeAmount(bills.houseRent);
  assertNonNegativeAmount(bills.buaBill);
  assertNonNegativeAmount(bills.otherBills);
  await setDoc(
    monthDoc(monthKey),
    {
      houseRent: Math.round(bills.houseRent),
      buaBill: Math.round(bills.buaBill),
      otherBills: Math.round(bills.otherBills),
      otherBillsDescription: bills.otherBillsDescription.trim(),
    },
    { merge: true }
  );
  recordAuditLog({
    action: "Fixed costs updated",
    category: "fixed_costs",
    summary: `Updated monthly fixed costs for ${monthKey}: Rent ৳${Math.round(bills.houseRent)}, Bua ৳${Math.round(bills.buaBill)}, Other Bills ৳${Math.round(bills.otherBills)}.`,
    monthKey,
  });
}

export async function updateBillField(
  monthKey: string,
  field: BillField,
  value: number
): Promise<void> {
  assertNonNegativeAmount(value);
  await setDoc(monthDoc(monthKey), { [field]: Math.round(value) }, { merge: true });
  recordAuditLog({
    action: `${BILL_LABELS[field]} updated`,
    category: "fixed_costs",
    summary: `${BILL_LABELS[field]} was set to ৳${Math.round(value)} for ${monthKey}.`,
    monthKey,
  });
}

export async function deleteBillField(
  monthKey: string,
  field: BillField
): Promise<void> {
  await updateBillField(monthKey, field, 0);
}

export async function getDailyMeals(
  monthKey: string
): Promise<DailyMealRecord[]> {
  const q = query(dailyMealsCollection(monthKey), orderBy("date", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as DailyMealRecord);
}

export async function saveDailyMeals(
  monthKey: string,
  record: DailyMealRecord,
  performedBy?: string
): Promise<void> {
  assertEntryDate(monthKey, record.date);
  await commitWithActivity(
    (transaction) => transaction.set(doc(dailyMealsCollection(monthKey), record.date), record, { merge: true }),
    "Meal Entry Saved",
    `Saved meal entries for ${record.date}.`,
    performedBy,
    (members) => validateMemberReferences(members, Object.keys(record.meals))
  );
  recordAuditLog({
    action: "Meal entry saved",
    category: "meals",
    summary: `Saved meal entries for ${record.date} across ${Object.keys(record.meals).length} member(s).`,
    monthKey,
  });
}

export async function deleteDailyMeals(
  monthKey: string,
  date: string,
  performedBy?: string
): Promise<void> {
  assertEntryDate(monthKey, date);
  await commitWithActivity(
    (batch) => batch.delete(doc(dailyMealsCollection(monthKey), date)),
    "Meal Entry Deleted",
    `Deleted meal entries for ${date}.`,
    performedBy
  );
  recordAuditLog({
    action: "Meal entry deleted",
    category: "meals",
    summary: `Deleted meal entries for ${date}.`,
    monthKey,
  });
}

export async function getBazarEntries(
  monthKey: string
): Promise<BazarEntry[]> {
  const q = query(bazarCollection(monthKey), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BazarEntry);
}

function normalizeBazarBuyerIds(entry: Omit<BazarEntry, "id">): string[] {
  const buyerIds = Array.isArray(entry.buyerIds)
    ? entry.buyerIds.filter((id): id is string => Boolean(id && String(id).trim()))
    : [];

  if (buyerIds.length > 0) return buyerIds;

  if (entry.buyerId && String(entry.buyerId).trim()) {
    return [String(entry.buyerId).trim()];
  }

  return [];
}

function validateMemberReferences(members: Member[], memberIds: string[]): void {
  const memberIdSet = new Set(members.map((member) => member.id));
  const missingIds = [...new Set(memberIds)].filter((memberId) => !memberIdSet.has(memberId));
  if (missingIds.length > 0) {
    throw new Error("One or more selected members no longer exist. Refresh the dashboard and try again.");
  }
}

function validateDepositMember(members: Member[], entry: Pick<DepositEntry, "memberId" | "memberName">): void {
  const memberExists = entry.memberId
    ? members.some((member) => member.id === entry.memberId)
    : members.some((member) => member.name === entry.memberName);
  if (!memberExists) {
    throw new Error("The selected deposit member no longer exists. Refresh the dashboard and try again.");
  }
}

export async function addBazarEntry(
  monthKey: string,
  entry: Omit<BazarEntry, "id">,
  performedBy?: string
): Promise<void> {
  assertEntryDate(monthKey, entry.date);
  assertPositiveAmount(entry.amount);
  const buyerIds = normalizeBazarBuyerIds(entry);
  await commitWithActivity(
    (transaction) => transaction.set(doc(bazarCollection(monthKey)), {
      ...entry,
      amount: Math.round(entry.amount),
      buyerIds,
      buyerId: buyerIds[0] ?? null,
    }),
    "Bazar Entry Added",
    `Added a bazar entry of ৳${Math.round(entry.amount)} for ${entry.date}${entry.description ? ` — ${entry.description}` : ""}${buyerIds.length ? ` by ${buyerIds.length} buyer(s)` : ""}.`,
    performedBy,
    (members) => validateMemberReferences(members, buyerIds)
  );
  recordAuditLog({
    action: "Bazar entry added",
    category: "bazar",
    summary: `Added a bazar entry of ৳${Math.round(entry.amount)} for ${entry.date}${entry.description ? `: ${entry.description}` : ""}.`,
    monthKey,
  });
}

export async function updateBazarEntry(
  monthKey: string,
  id: string,
  entry: Omit<BazarEntry, "id">,
  performedBy?: string
): Promise<void> {
  assertEntryDate(monthKey, entry.date);
  assertPositiveAmount(entry.amount);
  const buyerIds = normalizeBazarBuyerIds(entry);
  await commitWithActivity(
    (transaction) => transaction.update(doc(bazarCollection(monthKey), id), {
      ...entry,
      amount: Math.round(entry.amount),
      buyerIds,
      buyerId: buyerIds[0] ?? null,
    }),
    "Bazar Entry Updated",
    `Updated bazar entry for ${entry.date} to ৳${Math.round(entry.amount)}${entry.description ? ` — ${entry.description}` : ""}${buyerIds.length ? ` by ${buyerIds.length} buyer(s)` : ""}.`,
    performedBy,
    (members) => validateMemberReferences(members, buyerIds)
  );
  recordAuditLog({
    action: "Bazar entry updated",
    category: "bazar",
    summary: `Updated bazar entry for ${entry.date} to ৳${Math.round(entry.amount)}${entry.description ? `: ${entry.description}` : ""}.`,
    monthKey,
  });
}

export async function deleteBazarEntry(
  monthKey: string,
  id: string,
  performedBy?: string
): Promise<void> {
  await commitWithActivity(
    (batch) => batch.delete(doc(bazarCollection(monthKey), id)),
    "Bazar Entry Deleted",
    `Deleted a bazar entry from ${monthKey}.`,
    performedBy
  );
  recordAuditLog({
    action: "Bazar entry deleted",
    category: "bazar",
    summary: `Deleted a bazar entry from ${monthKey}.`,
    monthKey,
  });
}

export async function getDepositEntries(
  monthKey: string
): Promise<DepositEntry[]> {
  const q = query(depositsCollection(monthKey), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DepositEntry);
}

export async function applyCarryForwardBalances(
  sourceMonthKey: string,
  targetMonthKey: string,
  selectedBalances: CarryForwardBalance[]
): Promise<CarryForwardBalance[]> {
  if (
    !MONTH_KEY_PATTERN.test(sourceMonthKey) ||
    !MONTH_KEY_PATTERN.test(targetMonthKey) ||
    getPreviousMonthKey(targetMonthKey) !== sourceMonthKey
  ) {
    throw new Error("Carry-forward must use the immediately previous calendar month.");
  }

  const memberIds = new Set<string>();
  const balances = selectedBalances.map((balance) => {
    const amount = Math.round(balance.amount * 100) / 100;
    if (
      !balance.memberId.trim() ||
      !balance.memberName.trim() ||
      !Number.isFinite(amount) ||
      Math.abs(amount) < 0.01 ||
      (balance.kind !== "credit" && balance.kind !== "due") ||
      (balance.kind === "credit" && amount <= 0) ||
      (balance.kind === "due" && amount >= 0) ||
      memberIds.has(balance.memberId)
    ) {
      throw new Error("One or more carry-forward balances are invalid.");
    }
    memberIds.add(balance.memberId);
    return { ...balance, amount };
  });

  const createdBalances: CarryForwardBalance[] = [];
  const sourceMonthLabel = formatMonthLabel(sourceMonthKey);
  const targetDate = `${targetMonthKey}-01`;

  try {
    for (let offset = 0; offset < balances.length; offset += CARRY_FORWARD_CHUNK_SIZE) {
      const chunk = balances.slice(offset, offset + CARRY_FORWARD_CHUNK_SIZE);
      const createdInChunk = await runTransaction(db, async (transaction) => {
        const membersSnapshot = await transaction.get(doc(db, "settings", "members"));
        const currentMembers = parseMembers(
          membersSnapshot.exists() ? membersSnapshot.data() : undefined
        );
        const activeMemberById = new Map(
          getActiveMembers(currentMembers).map((member) => [member.id, member])
        );
        const refs = chunk.map((balance) => ({
          balance,
          ref: doc(
            depositsCollection(targetMonthKey),
            getCarryForwardDepositId(sourceMonthKey, balance.memberId)
          ),
        }));
        const snapshots = await Promise.all(
          refs.map(({ ref }) => transaction.get(ref))
        );

        refs.forEach(({ balance, ref }, index) => {
          if (snapshots[index].exists()) return;

          const member = activeMemberById.get(balance.memberId);
          if (!member) {
            throw new Error(
              `${balance.memberName} is no longer an active member. Refresh the preview and try again.`
            );
          }

          transaction.set(ref, {
            memberId: member.id,
            memberName: member.name,
            amount: balance.amount,
            date: targetDate,
            note: `Carry forward from ${sourceMonthLabel}`,
            carryForwardFrom: sourceMonthKey,
          });
        });

        return refs.flatMap(({ balance }, index) =>
          snapshots[index].exists() ? [] : [balance]
        );
      });
      createdBalances.push(...createdInChunk);
    }
  } finally {
    if (createdBalances.length > 0) {
      const totalCredit = createdBalances
        .filter((balance) => balance.amount > 0)
        .reduce((sum, balance) => sum + balance.amount, 0);
      const totalDue = createdBalances
        .filter((balance) => balance.amount < 0)
        .reduce((sum, balance) => sum + Math.abs(balance.amount), 0);

      recordAuditLog({
        action: "carry_forward_balance",
        category: "deposits",
        summary:
          `Carried forward ${createdBalances.length} member balance(s) from ${sourceMonthLabel} to ${formatMonthLabel(targetMonthKey)} ` +
          `(Credit: ৳${formatCurrency(totalCredit)}, Due: ৳${formatCurrency(totalDue)}).`,
        monthKey: targetMonthKey,
      });
    }
  }

  return createdBalances;
}

export async function addDepositEntry(
  monthKey: string,
  entry: Omit<DepositEntry, "id">,
  performedBy?: string
): Promise<void> {
  assertEntryDate(monthKey, entry.date);
  assertPositiveAmount(entry.amount);
  await commitWithActivity(
    (transaction) => transaction.set(doc(depositsCollection(monthKey)), {
      ...entry,
      amount: Math.round(entry.amount),
    }),
    "Deposit Added",
    `Added a deposit of ৳${Math.round(entry.amount)} for ${entry.memberName} on ${entry.date}${entry.note ? ` — ${entry.note}` : ""}.`,
    performedBy,
    (members) => validateDepositMember(members, entry)
  );
  recordAuditLog({
    action: "Deposit added",
    category: "deposits",
    summary: `Added a deposit of ৳${Math.round(entry.amount)} for ${entry.memberName} on ${entry.date}${entry.note ? `: ${entry.note}` : ""}.`,
    monthKey,
  });
}

export async function updateDepositEntry(
  monthKey: string,
  id: string,
  entry: Omit<DepositEntry, "id">,
  performedBy?: string
): Promise<void> {
  assertEntryDate(monthKey, entry.date);
  assertPositiveAmount(entry.amount);
  await commitWithActivity(
    (transaction) => transaction.update(doc(depositsCollection(monthKey), id), {
      ...entry,
      amount: Math.round(entry.amount),
    }),
    "Deposit Updated",
    `Updated deposit for ${entry.memberName} on ${entry.date} to ৳${Math.round(entry.amount)}${entry.note ? ` — ${entry.note}` : ""}.`,
    performedBy,
    (members) => validateDepositMember(members, entry)
  );
  recordAuditLog({
    action: "Deposit updated",
    category: "deposits",
    summary: `Updated ${entry.memberName}'s deposit to ৳${Math.round(entry.amount)} on ${entry.date}${entry.note ? `: ${entry.note}` : ""}.`,
    monthKey,
  });
}

export async function deleteDepositEntry(
  monthKey: string,
  id: string,
  performedBy?: string
): Promise<void> {
  await commitWithActivity(
    (batch) => batch.delete(doc(depositsCollection(monthKey), id)),
    "Deposit Deleted",
    `Deleted a deposit entry from ${monthKey}.`,
    performedBy
  );
  recordAuditLog({
    action: "Deposit deleted",
    category: "deposits",
    summary: `Deleted a deposit entry from ${monthKey}.`,
    monthKey,
  });
}

export interface MonthData {
  bills: MonthBills;
  dailyMeals: DailyMealRecord[];
  bazar: BazarEntry[];
  deposits: DepositEntry[];
  members: Member[];
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
}

function buildActivityLog(
  action: string,
  details: string,
  performedBy?: string
): { activityRef: ReturnType<typeof doc>; log: ActivityLog } {
  void performedBy;
  const activityRef = doc(collection(db, "activity_logs"));
  const authenticatedAuthor = getActivityAuthor();
  const log: ActivityLog = {
    id: activityRef.id,
    action: action.trim() || "Activity",
    details: details.trim() || "No details provided.",
    performedBy: authenticatedAuthor,
    timestamp: new Date().toISOString(),
  };

  return { activityRef, log };
}

async function commitWithActivity(
  writeOperation: (transaction: Transaction) => void,
  action: string,
  details: string,
  performedBy?: string,
  validateMembers?: (members: Member[]) => void
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    if (validateMembers) {
      const membersSnapshot = await transaction.get(doc(db, "settings", "members"));
      validateMembers(parseMembers(membersSnapshot.exists() ? membersSnapshot.data() : undefined));
    }

    writeOperation(transaction);
    const { activityRef, log } = buildActivityLog(action, details, performedBy);
    transaction.set(activityRef, log);
  });
}

export async function createActivityLog(
  action: string,
  details: string,
  performedBy?: string
): Promise<ActivityLog> {
  const { activityRef, log } = buildActivityLog(action, details, performedBy);

  await setDoc(activityRef, log);
  return log;
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const q = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<ActivityLog, "id">),
  })) as ActivityLog[];
}

export async function deleteActivityLog(logId: string): Promise<void> {
  await deleteDoc(doc(db, "activity_logs", logId));
}

export function getMonthKeyFromTimestamp(timestamp: string): string | null {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return null;

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isActivityLogForMonth(
  log: Pick<ActivityLog, "timestamp">,
  monthKey: string | null | undefined
): boolean {
  if (!monthKey) return true;
  const logMonthKey = getMonthKeyFromTimestamp(log.timestamp);
  return logMonthKey === monthKey;
}

export function subscribeToMonthData(
  monthKey: string,
  callback: (data: MonthData) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let bills: MonthBills = { houseRent: 0, buaBill: 0, otherBills: 0, otherBillsDescription: "" };
  let members: Member[] = [];
  let dailyMeals: DailyMealRecord[] = [];
  let bazar: BazarEntry[] = [];
  let deposits: DepositEntry[] = [];
  let errorReported = false;

  function handleError(error: Error) {
    if (errorReported) return;
    errorReported = true;
    onError?.(error);
  }

  function emit() {
    callback({ bills, dailyMeals, bazar, deposits, members });
  }

  const unsubMembers = onSnapshot(doc(db, "settings", "members"), (snap) => {
    members = parseMembers(snap.exists() ? snap.data() : undefined);
    emit();
  }, handleError);

  const unsubBills = onSnapshot(monthDoc(monthKey), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      bills = {
        houseRent: data.houseRent ?? 0,
        buaBill: data.buaBill ?? 0,
        otherBills: data.otherBills ?? 0,
        otherBillsDescription: String(data.otherBillsDescription ?? ""),
      };
    } else {
      bills = { houseRent: 0, buaBill: 0, otherBills: 0, otherBillsDescription: "" };
    }
    emit();
  }, handleError);

  const unsubMeals = onSnapshot(
    query(dailyMealsCollection(monthKey), orderBy("date", "asc")),
    (snap) => {
      dailyMeals = snap.docs.map((d) => d.data() as DailyMealRecord);
      emit();
    },
    handleError
  );

  const unsubBazar = onSnapshot(
    query(bazarCollection(monthKey), orderBy("date", "desc")),
    (snap) => {
      bazar = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as BazarEntry
      );
      emit();
    },
    handleError
  );

  const unsubDeposits = onSnapshot(
    query(depositsCollection(monthKey), orderBy("date", "desc")),
    (snap) => {
      deposits = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as DepositEntry
      );
      emit();
    },
    handleError
  );

  return () => {
    unsubMembers();
    unsubBills();
    unsubMeals();
    unsubBazar();
    unsubDeposits();
  };
}

export { createEmptyDailyMeals, getActiveMembers };
