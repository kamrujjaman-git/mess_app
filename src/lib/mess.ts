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
}

export interface MessStats {
  totalMeals: number;
  totalBazar: number;
  mealRate: number;
  fixedCostPerPerson: number;
  totalFixedCosts: number;
  activeMemberCount: number;
  members: MemberSummary[];
}

export function createDefaultMembers(): Member[] {
  return DEFAULT_MEMBERS.map((name, i) => ({
    id: `member-${i + 1}`,
    name,
    email: "",
    status: "active" as const,
  }));
}

export function getActiveMembers(members: Member[]): Member[] {
  return members.filter((m) => m.status === "active");
}

export function getMemberTotalMeals(meals: MemberMeals): number {
  return meals.breakfast + meals.lunch + meals.dinner;
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

export function calculateMessStats(
  dailyRecords: DailyMealRecord[],
  bazarEntries: BazarEntry[],
  depositEntries: DepositEntry[],
  bills: MonthBills,
  members: Member[]
): MessStats {
  const activeMembers = getActiveMembers(members);
  const activeMemberCount = activeMembers.length;

  const totalBazar = Math.round(
    bazarEntries.reduce((sum, entry) => sum + entry.amount, 0)
  );

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

  const mealRate =
    totalMeals > 0 ? Math.round(totalBazar / totalMeals) : 0;

  const totalFixedCosts = Math.round(
    bills.houseRent + bills.buaBill + bills.otherBills
  );
  const fixedCostPerPerson =
    activeMemberCount > 0
      ? Math.round(totalFixedCosts / activeMemberCount)
      : 0;

  const memberSummaries: MemberSummary[] = members.map((member) => {
    const personalTotalMeals = sumDailyMealsForMember(
      dailyRecords,
      member.id
    );
    const totalDeposited = Math.round(
      depositEntries
        .filter(
          (d) =>
            d.memberId === member.id ||
            (!d.memberId && d.memberName === member.name)
        )
        .reduce((sum, d) => sum + d.amount, 0)
    );
    const mealCost = Math.round(personalTotalMeals * mealRate);
    const mealBalance = Math.round(totalDeposited - mealCost);
    const fixedShare =
      member.status === "active" ? fixedCostPerPerson : 0;
    const finalBalance = Math.round(
      totalDeposited - (mealCost + fixedShare)
    );

    return {
      id: member.id,
      name: member.name,
      totalMeals: personalTotalMeals,
      totalDeposited,
      mealCost,
      fixedCostShare: fixedShare,
      mealBalance,
      finalBalance,
      status: member.status,
    };
  });

  return {
    totalMeals,
    totalBazar,
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

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
