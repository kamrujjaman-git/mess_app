"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AccessDeniedScreen } from "@/components/AccessDeniedScreen";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { SummaryTable } from "@/components/dashboard/SummaryTable";
import { DailyMealsSheet } from "@/components/dashboard/DailyMealsSheet";
import { BazarDepositLog } from "@/components/dashboard/BazarDepositLog";
import { AdminPanel } from "@/components/dashboard/AdminPanel";
import { toast } from "react-hot-toast";
import {
  calculateMessStats,
  formatMonthKey,
  formatMonthLabel,
  normalizeMealCount,
  type DailyMealRecord,
  type MemberMeals,
  type Member,
  type MonthBills,
  type BillField,
  type MonthlyArchiveData,
} from "@/lib/mess";
import {
  subscribeToMonthData,
  saveDailyMeals,
  deleteDailyMeals,
  addBazarEntry,
  updateBazarEntry,
  addDepositEntry,
  updateDepositEntry,
  updateMonthBills,
  updateBillField,
  deleteBillField,
  addMember,
  updateMember,
  setMemberStatus,
  deleteBazarEntry,
  deleteDepositEntry,
  deleteMember,
  archiveCurrentMonthData,
  getMonthlyArchive,
  listMonthlyArchives,
  deleteMonthData,
  createActivityLog,
  type MonthData,
} from "@/lib/firestore";

type Tab = "summary" | "meals" | "logs" | "admin";
type AdminSubTab = "entries" | "members";

const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: "summary", label: "Summary" },
  { id: "meals", label: "Meals" },
  { id: "logs", label: "Bazar & Deposits" },
  { id: "admin", label: "Admin", adminOnly: true },
];

function getTabFromUrl(tab: string | null): Tab {
  return tab === "summary" || tab === "meals" || tab === "logs" || tab === "admin"
    ? tab
    : "summary";
}

function getSubTabFromUrl(subTab: string | null): AdminSubTab {
  return subTab === "members" ? "members" : "entries";
}

function calculateTotalFromDailyMeals(dailyMeals: DailyMealRecord[] | undefined): number {
  if (!dailyMeals || dailyMeals.length === 0) return 0;

  return dailyMeals.reduce((sum, record) => {
    const memberMeals = Object.values(record.meals ?? {}) as unknown[];
    const dailyTotal = memberMeals.reduce<number>((memberSum, meals) => {
      if (!meals || typeof meals !== "object") {
        return memberSum + normalizeMealCount(meals);
      }

      const mealRecord = meals as Record<string, unknown>;
      const values: unknown[] = [
        mealRecord.breakfast,
        mealRecord.lunch,
        mealRecord.dinner,
        mealRecord.b,
        mealRecord.l,
        mealRecord.d,
      ];

      return memberSum + values.reduce<number>((fieldSum, value) => fieldSum + normalizeMealCount(value), 0);
    }, 0);

    return sum + dailyTotal;
  }, 0);
}

function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );
}

function DashboardContent() {
  const {
    user,
    loading,
    accessLoading,
    isAdmin,
    isSuperAdmin,
    hasAccess,
    accessDeniedReason,
    members,
    logout,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [monthKey, setMonthKey] = useState(formatMonthKey(new Date()));
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [archiveMonthKey, setArchiveMonthKey] = useState("");
  const [archiveData, setArchiveData] = useState<MonthlyArchiveData | null>(null);
  const [archiveKeys, setArchiveKeys] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const activeTab = getTabFromUrl(searchParams.get("tab"));
  const activeSubTab = getSubTabFromUrl(searchParams.get("subtab"));
  const currentMember = user?.email
    ? members.find(
      (member) =>
        member.email?.trim().toLowerCase() === user.email?.trim().toLowerCase()
    ) ?? null
    : null;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const currentTab = isAdmin && activeTab === "admin" ? "admin" : activeTab === "admin" ? "summary" : activeTab;
  const isArchiveView = archiveMonthKey !== "";

  useEffect(() => {
    if (!user || !hasAccess) return;
    setDataLoading(true);
    const unsub = subscribeToMonthData(monthKey, (data) => {
      setMonthData(data);
      setDataLoading(false);
    });
    return unsub;
  }, [monthKey, user, hasAccess]);

  useEffect(() => {
    const loadArchives = async () => {
      try {
        const keys = await listMonthlyArchives();
        setArchiveKeys(keys);
      } catch (error) {
        console.error("Failed to load archive list:", error);
      }
    };

    void loadArchives();
  }, []);

  useEffect(() => {
    if (!archiveMonthKey) {
      setArchiveData(null);
      return;
    }

    const loadArchive = async () => {
      setDataLoading(true);
      try {
        const archive = await getMonthlyArchive(archiveMonthKey);
        setArchiveData(archive);
      } catch (error) {
        console.error("Failed to load archive snapshot:", error);
      } finally {
        setDataLoading(false);
      }
    };

    void loadArchive();
  }, [archiveMonthKey]);

  const handleOptimisticMealToggle = useCallback(
    (date: string, memberId: string, mealType: keyof MemberMeals, nextStatus: boolean) => {
      setMonthData((previous) => {
        if (!previous) return previous;

        const nextDailyMeals = [...previous.dailyMeals];
        const existingIndex = nextDailyMeals.findIndex((record) => record.date === date);
        const targetRecord = existingIndex >= 0 ? nextDailyMeals[existingIndex] : { date, meals: {} };
        const updatedMeals = {
          ...targetRecord.meals,
          [memberId]: {
            ...(targetRecord.meals[memberId] ?? { breakfast: 0, lunch: 0, dinner: 0 }),
            [mealType]: nextStatus ? 1 : 0,
          },
        };

        const nextRecord: DailyMealRecord = {
          ...targetRecord,
          meals: updatedMeals,
        };

        if (existingIndex >= 0) {
          nextDailyMeals[existingIndex] = nextRecord;
        } else {
          nextDailyMeals.push(nextRecord);
        }

        nextDailyMeals.sort((a, b) => a.date.localeCompare(b.date));

        return {
          ...previous,
          dailyMeals: nextDailyMeals,
        };
      });
    },
    []
  );

  const shiftMonth = useCallback((delta: number) => {
    setMonthKey((prev) => {
      const [year, month] = prev.split("-").map(Number);
      const date = new Date(year, month - 1 + delta, 1);
      return formatMonthKey(date);
    });
  }, []);

  const updateTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      if (tab !== "admin") {
        params.delete("subtab");
      }
      router.replace(`/dashboard?${params.toString()}`);
    },
    [router, searchParams]
  );

  const updateAdminSubTab = useCallback(
    (subTab: AdminSubTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "admin");
      params.set("subtab", subTab);
      router.replace(`/dashboard?${params.toString()}`);
    },
    [router, searchParams]
  );

  const upsertMealsInLocalState = useCallback((date: string, meals: Record<string, MemberMeals>) => {
    setMonthData((previous) => {
      if (!previous) return previous;

      const nextDailyMeals = [...previous.dailyMeals];
      const existingIndex = nextDailyMeals.findIndex((record) => record.date === date);
      const nextRecord: DailyMealRecord = { date, meals };

      if (existingIndex >= 0) {
        nextDailyMeals[existingIndex] = {
          ...nextDailyMeals[existingIndex],
          meals: {
            ...nextDailyMeals[existingIndex].meals,
            ...meals,
          },
        };
      } else {
        nextDailyMeals.push(nextRecord);
      }

      nextDailyMeals.sort((a, b) => a.date.localeCompare(b.date));

      return {
        ...previous,
        dailyMeals: nextDailyMeals,
      };
    });
  }, []);

  const handleSaveMeals = useCallback(
    async (date: string, meals: Record<string, MemberMeals>) => {
      await saveDailyMeals(
        monthKey,
        { date, meals },
        currentMember?.name || user?.displayName || "Admin"
      );
      upsertMealsInLocalState(date, meals);
    },
    [currentMember?.name, monthKey, upsertMealsInLocalState, user?.displayName]
  );

  const handleEditMeals = useCallback(
    async (date: string, meals: Record<string, MemberMeals>) => {
      await saveDailyMeals(
        monthKey,
        { date, meals },
        currentMember?.name || user?.displayName || "Admin"
      );
      upsertMealsInLocalState(date, meals);
    },
    [currentMember?.name, monthKey, upsertMealsInLocalState, user?.displayName]
  );

  const handleDeleteMeals = useCallback(
    async (date: string) => {
      await deleteDailyMeals(
        monthKey,
        date,
        currentMember?.name || user?.displayName || "Admin"
      );
    },
    [currentMember?.name, monthKey, user?.displayName]
  );

  const handleAddBazar = useCallback(
    async (date: string, amount: number, description: string, buyerIds: string[] = []) => {
      await addBazarEntry(
        monthKey,
        { date, amount, description, buyerIds },
        currentMember?.name || user?.displayName || "Admin"
      );
    },
    [currentMember?.name, monthKey, user?.displayName]
  );

  const handleEditBazar = useCallback(
    async (id: string, entry: { date: string; amount: number; description: string; buyerIds?: string[]; buyerId?: string | null }) => {
      await updateBazarEntry(
        monthKey,
        id,
        entry,
        currentMember?.name || user?.displayName || "Admin"
      );
    },
    [currentMember?.name, monthKey, user?.displayName]
  );

  const handleAddDeposit = useCallback(
    async (
      memberId: string,
      memberName: string,
      amount: number,
      date: string,
      note: string
    ) => {
      await addDepositEntry(
        monthKey,
        {
          memberId,
          memberName,
          amount,
          date,
          note,
        },
        currentMember?.name || user?.displayName || "Admin"
      );
    },
    [currentMember?.name, monthKey, user?.displayName]
  );

  const handleEditDeposit = useCallback(
    async (
      id: string,
      entry: {
        memberId?: string;
        memberName: string;
        amount: number;
        date: string;
        note: string;
      }
    ) => {
      await updateDepositEntry(
        monthKey,
        id,
        entry,
        currentMember?.name || user?.displayName || "Admin"
      );
    },
    [currentMember?.name, monthKey, user?.displayName]
  );

  const handleUpdateBills = useCallback(
    async (bills: MonthBills) => {
      await updateMonthBills(monthKey, bills);
    },
    [monthKey]
  );

  const handleEditBill = useCallback(
    async (field: BillField, value: number) => {
      await updateBillField(monthKey, field, value);
    },
    [monthKey]
  );

  const handleDeleteBill = useCallback(
    async (field: BillField) => {
      await deleteBillField(monthKey, field);
    },
    [monthKey]
  );

  const handleAddMember = useCallback(async (name: string, email: string, whatsAppNumber?: string) => {
    await addMember(name, email, whatsAppNumber);
  }, []);

  const handleUpdateMember = useCallback(
    async (member: Member) => {
      const existingMember = members.find((m) => m.id === member.id);
      if (
        existingMember &&
        existingMember.isAdmin !== member.isAdmin &&
        !isSuperAdmin
      ) {
        throw new Error(
          "Only the Main Super Admin can change admin access."
        );
      }

      await updateMember(member);
    },
    [members, isSuperAdmin]
  );

  const handleDeleteMember = useCallback(
    async (memberId: string) => {
      await deleteMember(memberId);
    },
    []
  );

  const handleSetMemberStatus = useCallback(
    async (memberId: string, status: Member["status"]) => {
      await setMemberStatus(memberId, status);
    },
    []
  );

  const handleDeleteBazar = useCallback(
    async (id: string) => {
      await deleteBazarEntry(
        monthKey,
        id,
        currentMember?.name || user?.displayName || "Admin"
      );
    },
    [currentMember?.name, monthKey, user?.displayName]
  );

  const handleDeleteDeposit = useCallback(
    async (id: string) => {
      await deleteDepositEntry(
        monthKey,
        id,
        currentMember?.name || user?.displayName || "Admin"
      );
    },
    [currentMember?.name, monthKey, user?.displayName]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/");
  }, [logout, router]);

  const memberDisplayName = currentMember?.name?.trim() || user?.displayName?.trim() || "Member";

  const stats = monthData
    ? calculateMessStats(
      monthData.dailyMeals,
      monthData.bazar,
      monthData.deposits,
      monthData.bills,
      monthData.members
    )
    : null;

  const handleArchiveMonth = useCallback(async () => {
    if (!monthData || !stats) return;
    if (!confirm("Archive current month and reset data for the next month?")) return;

    setDataLoading(true);
    try {
      await archiveCurrentMonthData(monthKey, {
        bills: monthData.bills,
        dailyMeals: monthData.dailyMeals,
        bazar: monthData.bazar,
        deposits: monthData.deposits,
        members: monthData.members,
        stats,
      });

      await deleteMonthData(monthKey);

      const [year, month] = monthKey.split("-").map(Number);
      const nextDate = new Date(year, month, 1);
      const nextKey = formatMonthKey(nextDate);
      setMonthKey(nextKey);
      setArchiveMonthKey("");

      const keys = await listMonthlyArchives();
      setArchiveKeys(keys);
      toast.success("Month archived and reset for the next cycle.");
    } catch (error) {
      console.error("Archive failed:", error);
      toast.error("Could not archive the month. Please try again.");
    } finally {
      setDataLoading(false);
    }
  }, [monthData, monthKey, stats]);

  const archiveStats = archiveData?.stats ?? null;

  const displayedMonthData = archiveData ?? monthData;
  const displayedStats = isArchiveView ? archiveStats : stats;

  const computedTotalMeals = useMemo(() => {
    return calculateTotalFromDailyMeals(displayedMonthData?.dailyMeals);
  }, [displayedMonthData?.dailyMeals]);

  const dashboardStats = displayedStats
    ? { ...displayedStats, totalMeals: computedTotalMeals }
    : null;
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  if (loading || accessLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDeniedScreen
        email={user.email}
        reason={accessDeniedReason ?? "not-member"}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav
        monthKey={monthKey}
        onPrevMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
        user={user}
        isAdmin={isAdmin}
        memberName={memberDisplayName}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {dataLoading || !monthData || !stats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Viewing
                  </p>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {isArchiveView && archiveMonthKey
                      ? `Archived snapshot — ${formatMonthLabel(archiveMonthKey)}`
                      : `Current month — ${formatMonthLabel(monthKey)}`}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                    <span>Archive</span>
                    <select
                      value={archiveMonthKey}
                      onChange={(event) => setArchiveMonthKey(event.target.value)}
                      className="bg-transparent text-sm outline-none"
                    >
                      <option value="">Current month</option>
                      {archiveKeys.map((key) => (
                        <option key={key} value={key}>
                          {formatMonthLabel(key)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {isArchiveView ? (
                    <button
                      type="button"
                      onClick={() => setArchiveMonthKey("")}
                      className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                      Live view
                    </button>
                  ) : null}
                </div>
              </div>

              <OverviewCards
                stats={dashboardStats ?? stats}
                bills={displayedMonthData?.bills ?? monthData?.bills}
                isAdmin={isAdmin && !isArchiveView}
              />
            </div>

            <div className="mb-6 overflow-x-auto whitespace-nowrap scrollbar-none px-2 py-1">
              <div className="flex gap-2">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => updateTab(tab.id)}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${currentTab === tab.id
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                      : "bg-white/60 text-slate-600 hover:bg-white dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {currentTab === "summary" && (
              <SummaryTable members={stats.members} isAdmin={isAdmin} />
            )}

            {currentTab === "meals" && (
              <DailyMealsSheet
                records={monthData.dailyMeals}
                members={monthData.members}
                isAdmin={isAdmin}
                onEdit={handleEditMeals}
                onDelete={isAdmin ? handleDeleteMeals : undefined}
                onOptimisticToggle={handleOptimisticMealToggle}
              />
            )}

            {currentTab === "logs" && (
              <BazarDepositLog
                bazar={monthData.bazar}
                deposits={monthData.deposits}
                bills={monthData.bills}
                members={monthData.members}
                isAdmin={isAdmin}
                onEditBazar={isAdmin ? handleEditBazar : undefined}
                onDeleteBazar={isAdmin ? handleDeleteBazar : undefined}
                onEditDeposit={isAdmin ? handleEditDeposit : undefined}
                onDeleteDeposit={isAdmin ? handleDeleteDeposit : undefined}
                onEditBill={isAdmin ? handleEditBill : undefined}
                onDeleteBill={isAdmin ? handleDeleteBill : undefined}
              />
            )}

            {currentTab === "admin" && isAdmin && (
              <AdminPanel
                members={displayedMonthData?.members ?? monthData?.members ?? []}
                bills={displayedMonthData?.bills ?? monthData?.bills}
                subTab={activeSubTab}
                onSubTabChange={updateAdminSubTab}
                onSaveMeals={isArchiveView ? undefined : handleSaveMeals}
                onAddBazar={isArchiveView ? undefined : handleAddBazar}
                onAddDeposit={isArchiveView ? undefined : handleAddDeposit}
                onUpdateBills={isArchiveView ? undefined : handleUpdateBills}
                onAddMember={handleAddMember}
                onUpdateMember={handleUpdateMember}
                onSetMemberStatus={handleSetMemberStatus}
                onDeleteMember={handleDeleteMember}
                onArchiveMonth={handleArchiveMonth}
                isArchiveMode={isArchiveView}
                performedBy={memberDisplayName}
              />
            )}

          </>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
