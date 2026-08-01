import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
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
  migrateMealKeys,
  getActiveMembers,
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

function parseMembers(data: Record<string, unknown> | undefined): Member[] {
  if (!data) return createDefaultMembers();

  if (Array.isArray(data.members)) {
    return data.members as Member[];
  }

  if (Array.isArray(data.names)) {
    return (data.names as string[]).map((name, i) => ({
      id: `member-${i + 1}`,
      name,
      email: "",
      status: "active" as const,
    }));
  }

  return createDefaultMembers();
}

export async function getMembers(): Promise<Member[]> {
  const snap = await getDoc(doc(db, "settings", "members"));
  return parseMembers(snap.exists() ? snap.data() : undefined);
}

export async function setMembers(members: Member[]): Promise<void> {
  await setDoc(doc(db, "settings", "members"), { members });
}

export function subscribeToMembers(
  callback: (members: Member[]) => void
): Unsubscribe {
  return onSnapshot(doc(db, "settings", "members"), (snap) => {
    callback(parseMembers(snap.exists() ? snap.data() : undefined));
  });
}

export async function addMember(
  name: string,
  email: string
): Promise<Member> {
  const members = await getMembers();
  const newMember: Member = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    status: "active",
  };
  await setMembers([...members, newMember]);
  return newMember;
}

export async function updateMember(updated: Member): Promise<void> {
  const members = await getMembers();
  const index = members.findIndex((m) => m.id === updated.id);
  if (index === -1) return;
  members[index] = {
    ...updated,
    name: updated.name.trim(),
    email: updated.email.trim().toLowerCase(),
  };
  await setMembers(members);
}

export async function setMemberStatus(
  memberId: string,
  status: Member["status"]
): Promise<void> {
  const members = await getMembers();
  const index = members.findIndex((m) => m.id === memberId);
  if (index === -1) return;
  members[index] = { ...members[index], status };
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
    };
  }
  return { houseRent: 0, buaBill: 0, otherBills: 0 };
}

export async function updateMonthBills(
  monthKey: string,
  bills: MonthBills
): Promise<void> {
  await setDoc(
    monthDoc(monthKey),
    {
      houseRent: Math.round(bills.houseRent),
      buaBill: Math.round(bills.buaBill),
      otherBills: Math.round(bills.otherBills),
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
  record: DailyMealRecord
): Promise<void> {
  await setDoc(doc(dailyMealsCollection(monthKey), record.date), record);
}

export async function deleteDailyMeals(
  monthKey: string,
  date: string
): Promise<void> {
  await deleteDoc(doc(dailyMealsCollection(monthKey), date));
}

export async function getBazarEntries(
  monthKey: string
): Promise<BazarEntry[]> {
  const q = query(bazarCollection(monthKey), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BazarEntry);
}

export async function addBazarEntry(
  monthKey: string,
  entry: Omit<BazarEntry, "id">
): Promise<void> {
  await addDoc(bazarCollection(monthKey), {
    ...entry,
    amount: Math.round(entry.amount),
  });
}

export async function updateBazarEntry(
  monthKey: string,
  id: string,
  entry: Omit<BazarEntry, "id">
): Promise<void> {
  await updateDoc(doc(bazarCollection(monthKey), id), {
    ...entry,
    amount: Math.round(entry.amount),
  });
}

export async function deleteBazarEntry(
  monthKey: string,
  id: string
): Promise<void> {
  await deleteDoc(doc(bazarCollection(monthKey), id));
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
  entry: Omit<DepositEntry, "id">
): Promise<void> {
  await addDoc(depositsCollection(monthKey), {
    ...entry,
    amount: Math.round(entry.amount),
  });
}

export async function updateDepositEntry(
  monthKey: string,
  id: string,
  entry: Omit<DepositEntry, "id">
): Promise<void> {
  await updateDoc(doc(depositsCollection(monthKey), id), {
    ...entry,
    amount: Math.round(entry.amount),
  });
}

export async function deleteDepositEntry(
  monthKey: string,
  id: string
): Promise<void> {
  await deleteDoc(doc(depositsCollection(monthKey), id));
}

export interface MonthData {
  bills: MonthBills;
  dailyMeals: DailyMealRecord[];
  bazar: BazarEntry[];
  deposits: DepositEntry[];
  members: Member[];
}

export function subscribeToMonthData(
  monthKey: string,
  callback: (data: MonthData) => void
): Unsubscribe {
  let bills: MonthBills = { houseRent: 0, buaBill: 0, otherBills: 0 };
  let dailyMeals: DailyMealRecord[] = [];
  let bazar: BazarEntry[] = [];
  let deposits: DepositEntry[] = [];
  let members: Member[] = createDefaultMembers();

  const emit = () => {
    const migratedMeals = dailyMeals.map((r) => migrateMealKeys(r, members));
    callback({ bills, dailyMeals: migratedMeals, bazar, deposits, members });
  };

  const unsubMembers = onSnapshot(doc(db, "settings", "members"), (snap) => {
    members = parseMembers(snap.exists() ? snap.data() : undefined);
    emit();
  });

  const unsubBills = onSnapshot(monthDoc(monthKey), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      bills = {
        houseRent: data.houseRent ?? 0,
        buaBill: data.buaBill ?? 0,
        otherBills: data.otherBills ?? 0,
      };
    } else {
      bills = { houseRent: 0, buaBill: 0, otherBills: 0 };
    }
    emit();
  });

  const unsubMeals = onSnapshot(
    query(dailyMealsCollection(monthKey), orderBy("date", "asc")),
    (snap) => {
      dailyMeals = snap.docs.map((d) => d.data() as DailyMealRecord);
      emit();
    }
  );

  const unsubBazar = onSnapshot(
    query(bazarCollection(monthKey), orderBy("date", "desc")),
    (snap) => {
      bazar = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as BazarEntry
      );
      emit();
    }
  );

  const unsubDeposits = onSnapshot(
    query(depositsCollection(monthKey), orderBy("date", "desc")),
    (snap) => {
      deposits = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as DepositEntry
      );
      emit();
    }
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
