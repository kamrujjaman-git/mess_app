export const MEMBER_COUNT = 6;

export const DEFAULT_MEMBERS = [
  "Member 1",
  "Member 2",
  "Member 3",
  "Member 4",
  "Member 5",
  "Member 6",
] as const;

export type MemberName = string;

export type MemberStatus = "active" | "inactive";

export interface Member {
  id: string;
  name: string;
  email: string;
  status: MemberStatus;
  active?: boolean;
  isAdmin?: boolean;
  whatsAppNumber?: string;
}

export interface MemberMeals {
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface DailyMealRecord {
  date: string;
  meals: Record<string, MemberMeals>;
}

export interface BazarEntry {
  id: string;
  date: string;
  amount: number;
  description: string;
}

export interface DepositEntry {
  id: string;
  memberId?: string;
  memberName: MemberName;
  amount: number;
  date: string;
  note: string;
}

export interface MonthBills {
  houseRent: number;
  buaBill: number;
  otherBills: number;
}

export type BillField = keyof MonthBills;

export const BILL_LABELS: Record<BillField, string> = {
  houseRent: "House Rent",
  buaBill: "Bua Bill",
  otherBills: "Other Bills",
};

export interface MemberSummary {
  id: string;
  name: MemberName;
  totalMeals: number;
  totalDeposited: number;
  mealCost: number;
  fixedCostShare: number;
  mealBalance: number;
  finalBalance: number;
  status: MemberStatus;
  whatsAppNumber?: string;
}

export interface MessStats {
  totalMeals: number;
  totalBazar: number;
  totalDeposits: number;
  remainingBalance: number;
  mealRate: number;
  fixedCostPerPerson: number;
  totalFixedCosts: number;
  activeMemberCount: number;
  members: MemberSummary[];
}

export interface MonthlyArchiveData {
  monthKey: string;
  archivedAt: string;
  bills: MonthBills;
  dailyMeals: DailyMealRecord[];
  bazar: BazarEntry[];
  deposits: DepositEntry[];
  members: Member[];
  stats: MessStats;
}

export function createDefaultMembers(): Member[] {
  return DEFAULT_MEMBERS.map((name, i) => ({
    id: `member-${i + 1}`,
    name,
    email: "",
    status: "active" as const,
    active: true,
    isAdmin: false,
    whatsAppNumber: "",
  }));
}

export function normalizeMemberStatus(
  member: Pick<Member, "status" | "active"> | null | undefined
): MemberStatus {
  if (!member) return "inactive";
  if (member.status === "inactive") return "inactive";
  if (member.active === false) return "inactive";
  return "active";
}

export function isMemberActive(
  member: Pick<Member, "status" | "active"> | null | undefined
): boolean {
  return normalizeMemberStatus(member) === "active";
}

export function getActiveMembers(members: Member[]): Member[] {
  return members.filter((member) => isMemberActive(member));
}

export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `880${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppLink(
  member: Pick<Member, "name" | "whatsAppNumber">,
  balanceAmount: number
): string {
  const normalizedNumber = normalizeWhatsAppNumber(member.whatsAppNumber ?? "");
  if (!normalizedNumber) return "";
  const safeName = member.name.trim() || "Member";
  const message = `হ্যালো ${safeName}, এই মাসের আপনার বর্তমান মেস ব্যালেন্স ${Math.round(balanceAmount)} টাকা। অনুগ্রহ করে ড্যাশবোর্ড দেখুন।`;
  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;
}

export function getAllowedMemberEmails(members: Member[]): string[] {
  return members
    .filter((member) => isMemberActive(member) && member.email.trim())
    .map((member) => member.email.trim().toLowerCase());
}

export function userHasMessAccess(
  userEmail: string | null | undefined,
  adminEmail: string,
  members: Member[]
): boolean {
  if (!userEmail) return false;
  const normalized = userEmail.trim().toLowerCase();
  if (adminEmail && normalized === adminEmail.trim().toLowerCase()) return true;
  return getAllowedMemberEmails(members).includes(normalized);
}

export function normalizeMealCount(value: unknown): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? 1 : 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return 1;
    }
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      return numeric > 0 ? 1 : 0;
    }
    return 0;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const values: unknown[] = [
      record.breakfast,
      record.lunch,
      record.dinner,
      record.b,
      record.l,
      record.d,
      record.B,
      record.L,
      record.D,
    ];
    return values.reduce<number>((sum, item) => sum + normalizeMealCount(item), 0);
  }
  return 0;
}

export function getMemberTotalMeals(meals: unknown): number {
  if (!meals || typeof meals !== "object") {
    return normalizeMealCount(meals);
  }

  const record = meals as Record<string, unknown>;
  const values: unknown[] = [
    record.breakfast,
    record.lunch,
    record.dinner,
    record.b,
    record.l,
    record.d,
  ];

  return values.reduce<number>((sum, value) => sum + normalizeMealCount(value), 0);
}

export function sumDailyMealsForMember(
  dailyRecords: DailyMealRecord[],
  memberId: string
): number {
  return dailyRecords.reduce((sum, record) => {
    const memberMeals = record.meals[memberId];
    if (!memberMeals) return sum;
    return sum + getMemberTotalMeals(memberMeals);
  }, 0);
}

function safeRound(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function calculateMessStats(
  dailyRecords: DailyMealRecord[],
  bazarEntries: BazarEntry[],
  depositEntries: DepositEntry[],
  bills: MonthBills,
  members: Member[]
): MessStats {
  const activeMembers = getActiveMembers(members);
  const activeMemberCount = activeMembers.length;

  const totalBazar = safeRound(
    bazarEntries.reduce((sum, entry) => sum + safeRound(entry.amount), 0)
  );

  const totalDeposits = safeRound(
    depositEntries.reduce((sum, entry) => sum + safeRound(entry.amount), 0)
  );

  const remainingBalance = safeRound(totalDeposits - totalBazar);

  const totalMeals = dailyRecords.reduce((sum, record) => {
    return (
      sum +
      activeMembers.reduce((memberSum, member) => {
        const meals = record.meals[member.id];
        if (!meals) return memberSum;
        return memberSum + getMemberTotalMeals(meals);
      }, 0)
    );
  }, 0);

  const mealRate = totalMeals > 0 ? safeRound(totalBazar / totalMeals) : 0;

  const totalFixedCosts = safeRound(
    safeRound(bills.houseRent) +
    safeRound(bills.buaBill) +
    safeRound(bills.otherBills)
  );
  const fixedCostPerPerson =
    activeMemberCount > 0
      ? safeRound(totalFixedCosts / activeMemberCount)
      : 0;

  const memberSummaries: MemberSummary[] = members.map((member) => {
    const personalTotalMeals = sumDailyMealsForMember(
      dailyRecords,
      member.id
    );
    const totalDeposited = safeRound(
      depositEntries
        .filter(
          (d) =>
            d.memberId === member.id ||
            (!d.memberId && d.memberName === member.name)
        )
        .reduce((sum, d) => sum + safeRound(d.amount), 0)
    );
    const mealCost = safeRound(personalTotalMeals * mealRate);
    const mealBalance = safeRound(totalDeposited - mealCost);
    const fixedShare = isMemberActive(member) ? fixedCostPerPerson : 0;
    const finalBalance = safeRound(totalDeposited - (mealCost + fixedShare));

    return {
      id: member.id,
      name: member.name,
      totalMeals: personalTotalMeals,
      totalDeposited,
      mealCost,
      fixedCostShare: fixedShare,
      mealBalance,
      finalBalance,
      status: normalizeMemberStatus(member),
      whatsAppNumber: member.whatsAppNumber ?? "",
    };
  });

  return {
    totalMeals,
    totalBazar,
    totalDeposits,
    remainingBalance,
    mealRate,
    fixedCostPerPerson,
    totalFixedCosts,
    activeMemberCount,
    members: memberSummaries,
  };
}

export function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function formatMonthLabel(monthKey?: string): string {
  if (!monthKey || !monthKey.includes("-")) {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  const [year, month] = monthKey.split("-");
  const yearNum = Number(year);
  const monthNum = Number(month);
  if (!Number.isFinite(yearNum) || !Number.isFinite(monthNum)) {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  const date = new Date(yearNum, monthNum - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyMemberMeals(): MemberMeals {
  return { breakfast: 0, lunch: 0, dinner: 0 };
}

export function createEmptyDailyMeals(
  date: string,
  members: Member[]
): DailyMealRecord {
  const meals: Record<string, MemberMeals> = {};
  getActiveMembers(members).forEach((member) => {
    meals[member.id] = emptyMemberMeals();
  });
  return { date, meals };
}

export function migrateMealKeys(
  record: DailyMealRecord,
  members: Member[]
): DailyMealRecord {
  const migrated: Record<string, MemberMeals> = { ...record.meals };

  for (const member of members) {
    if (migrated[member.id]) continue;
    if (migrated[member.name]) {
      migrated[member.id] = migrated[member.name];
      delete migrated[member.name];
    }
  }

  return { ...record, meals: migrated };
}
