import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  type WriteBatch,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  BazarEntry,
  DailyMealRecord,
  DepositEntry,
  MonthBills,
  Member,
  BillField,
  createDefaultMembers,
  createEmptyDailyMeals,
  getActiveMembers,
  isDateOnOrBeforeToday,
} from "./mess";

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

function parseMembers(data: Record<string, unknown> | undefined): Member[] {
  if (!data) return createDefaultMembers();

  if (Array.isArray(data.members)) {
    return (data.members as Partial<Member>[]).map((member, index) => ({
      id: member.id ?? `member-${index + 1}`,
      name: String(member.name ?? `Member ${index + 1}`),
      email: String(member.email ?? ""),
      status: member.status === "removed"
        ? "removed"
        : member.status === "inactive" || member.active === false
          ? "inactive"
          : "active",
      active:
        member.active === false
          ? false
          : member.status !== "inactive" && member.status !== "removed",
      isAdmin: Boolean(member.isAdmin),
      isBlocked: Boolean(member.isBlocked),
      isRemoved: Boolean(member.isRemoved) || member.status === "removed",
      whatsAppNumber: String(member.whatsAppNumber ?? "").trim(),
    }));
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
  return members
    .filter(
      (member) =>
        member.status === "active" &&
        typeof member.email === "string" &&
        member.email.trim().length > 0
    )
    .map((member) => member.email.trim());
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
  };
}

export async function updateUserEmail(userDocId: string, email: string, name?: string): Promise<void> {
  const userRef = doc(db, "users", userDocId);
  const payload: Record<string, unknown> = { email };
  if (typeof name !== "undefined") payload.name = name;
  await setDoc(userRef, payload, { merge: true });
}

export async function setMembers(members: Member[]): Promise<void> {
  const adminEmails = members
    .filter((member) => member.isAdmin === true && member.email.trim())
    .map((member) => member.email.trim().toLowerCase());
  await setDoc(doc(db, "settings", "members"), { members, adminEmails });
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
  const members = await getMembers();
  const newMember: Member = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    status: "active",
    active: true,
    isAdmin: false,
    whatsAppNumber: String(whatsAppNumber ?? "").trim(),
  };
  await setMembers([...members, newMember]);
  return newMember;
}

export async function updateMember(updated: Member): Promise<void> {
  const members = await getMembers();
  const index = members.findIndex((m) => m.id === updated.id);
  if (index === -1) return;
  const previousMember = members[index];
  members[index] = {
    ...updated,
    name: updated.name.trim(),
    email: updated.email.trim().toLowerCase(),
  };
  await setMembers(members);
  try {
    const emails = [previousMember.email, updated.email]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const userSnapshots = await Promise.all(
      [...new Set(emails)].map((email) =>
        getDocs(query(collection(db, "users"), where("email", "==", email)))
      )
    );
    const userDocs = userSnapshots.flatMap((snapshot) => snapshot.docs);
    await Promise.all(
      userDocs.map((userDoc) =>
        updateDoc(userDoc.ref, {
          email: updated.email.trim().toLowerCase(),
          name: updated.name.trim(),
          isAdmin: Boolean(updated.isAdmin),
          status: updated.status,
          active: updated.active !== false,
          isBlocked: Boolean(updated.isBlocked),
          isRemoved: Boolean(updated.isRemoved),
        })
      )
    );
  } catch (error) {
    console.error("Failed to sync user doc email for member:", error);
  }
}

export async function deleteMember(memberId: string): Promise<void> {
  const members = await getMembers();
  const remainingMembers = members.filter((member) => member.id !== memberId);
  const userDoc = doc(db, "users", memberId);
  await Promise.all([deleteDoc(userDoc), setMembers(remainingMembers)]);
}

export async function setMemberStatus(
  memberId: string,
  status: Member["status"]
): Promise<void> {
  const members = await getMembers();
  const index = members.findIndex((m) => m.id === memberId);
  if (index === -1) return;
  members[index] = {
    ...members[index],
    status,
    active: status === "active",
    ...(status === "active"
      ? { isRemoved: false, isBlocked: false }
      : {}),
  };
  await setMembers(members);
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
}

export async function updateBillField(
  monthKey: string,
  field: BillField,
  value: number
): Promise<void> {
  const bills = await getMonthBills(monthKey);
  bills[field] = Math.round(value);
  await updateMonthBills(monthKey, bills);
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
  performedBy: string = "System"
): Promise<void> {
  assertEntryDate(monthKey, record.date);
  await commitWithActivity(
    (batch) => batch.set(doc(dailyMealsCollection(monthKey), record.date), record, { merge: true }),
    "Meal Entry Saved",
    `Saved meal entries for ${record.date}.`,
    performedBy
  );
}

export async function deleteDailyMeals(
  monthKey: string,
  date: string,
  performedBy: string = "System"
): Promise<void> {
  assertEntryDate(monthKey, date);
  await commitWithActivity(
    (batch) => batch.delete(doc(dailyMealsCollection(monthKey), date)),
    "Meal Entry Deleted",
    `Deleted meal entries for ${date}.`,
    performedBy
  );
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

export async function addBazarEntry(
  monthKey: string,
  entry: Omit<BazarEntry, "id">,
  performedBy: string = "System"
): Promise<void> {
  assertEntryDate(monthKey, entry.date);
  assertPositiveAmount(entry.amount);
  const buyerIds = normalizeBazarBuyerIds(entry);
  await commitWithActivity(
    (batch) => batch.set(doc(bazarCollection(monthKey)), {
      ...entry,
      amount: Math.round(entry.amount),
      buyerIds,
      buyerId: buyerIds[0] ?? null,
    }),
    "Bazar Entry Added",
    `Added a bazar entry of ৳${Math.round(entry.amount)} for ${entry.date}${entry.description ? ` — ${entry.description}` : ""}${buyerIds.length ? ` by ${buyerIds.length} buyer(s)` : ""}.`,
    performedBy
  );
}

export async function updateBazarEntry(
  monthKey: string,
  id: string,
  entry: Omit<BazarEntry, "id">,
  performedBy: string = "System"
): Promise<void> {
  assertEntryDate(monthKey, entry.date);
  assertPositiveAmount(entry.amount);
  const buyerIds = normalizeBazarBuyerIds(entry);
  await commitWithActivity(
    (batch) => batch.update(doc(bazarCollection(monthKey), id), {
      ...entry,
      amount: Math.round(entry.amount),
      buyerIds,
      buyerId: buyerIds[0] ?? null,
    }),
    "Bazar Entry Updated",
    `Updated bazar entry for ${entry.date} to ৳${Math.round(entry.amount)}${entry.description ? ` — ${entry.description}` : ""}${buyerIds.length ? ` by ${buyerIds.length} buyer(s)` : ""}.`,
    performedBy
  );
}

export async function deleteBazarEntry(
  monthKey: string,
  id: string,
  performedBy: string = "System"
): Promise<void> {
  await commitWithActivity(
    (batch) => batch.delete(doc(bazarCollection(monthKey), id)),
    "Bazar Entry Deleted",
    `Deleted a bazar entry from ${monthKey}.`,
    performedBy
  );
}

export async function getDepositEntries(
  monthKey: string
): Promise<DepositEntry[]> {
  const q = query(depositsCollection(monthKey), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DepositEntry);
}

export async function addDepositEntry(
  monthKey: string,
  entry: Omit<DepositEntry, "id">,
  performedBy: string = "System"
): Promise<void> {
  assertEntryDate(monthKey, entry.date);
  assertPositiveAmount(entry.amount);
  await commitWithActivity(
    (batch) => batch.set(doc(depositsCollection(monthKey)), {
      ...entry,
      amount: Math.round(entry.amount),
    }),
    "Deposit Added",
    `Added a deposit of ৳${Math.round(entry.amount)} for ${entry.memberName} on ${entry.date}${entry.note ? ` — ${entry.note}` : ""}.`,
    performedBy
  );
}

export async function updateDepositEntry(
  monthKey: string,
  id: string,
  entry: Omit<DepositEntry, "id">,
  performedBy: string = "System"
): Promise<void> {
  assertEntryDate(monthKey, entry.date);
  assertPositiveAmount(entry.amount);
  await commitWithActivity(
    (batch) => batch.update(doc(depositsCollection(monthKey), id), {
      ...entry,
      amount: Math.round(entry.amount),
    }),
    "Deposit Updated",
    `Updated deposit for ${entry.memberName} on ${entry.date} to ৳${Math.round(entry.amount)}${entry.note ? ` — ${entry.note}` : ""}.`,
    performedBy
  );
}

export async function deleteDepositEntry(
  monthKey: string,
  id: string,
  performedBy: string = "System"
): Promise<void> {
  await commitWithActivity(
    (batch) => batch.delete(doc(depositsCollection(monthKey), id)),
    "Deposit Deleted",
    `Deleted a deposit entry from ${monthKey}.`,
    performedBy
  );
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
  performedBy: string
): { activityRef: ReturnType<typeof doc>; log: ActivityLog } {
  const activityRef = doc(collection(db, "activity_logs"));
  const log: ActivityLog = {
    id: activityRef.id,
    action: action.trim() || "Activity",
    details: details.trim() || "No details provided.",
    performedBy: performedBy.trim() || "System",
    timestamp: new Date().toISOString(),
  };

  return { activityRef, log };
}

async function commitWithActivity(
  writeOperation: (batch: WriteBatch) => void,
  action: string,
  details: string,
  performedBy: string
): Promise<void> {
  const batch = writeBatch(db);
  writeOperation(batch);
  const { activityRef, log } = buildActivityLog(action, details, performedBy);
  batch.set(activityRef, log);
  await batch.commit();
}

export async function createActivityLog(
  action: string,
  details: string,
  performedBy: string
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
