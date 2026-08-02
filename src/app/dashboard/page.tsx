"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
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
import {
  calculateMessStats,
  formatMonthKey,
  type MemberMeals,
  type Member,
  type MonthBills,
  type BillField,
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
  type MonthData,
} from "@/lib/firestore";

type Tab = "summary" | "meals" | "logs" | "admin";

const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: "summary", label: "Summary" },
  { id: "meals", label: "Meals" },
  { id: "logs", label: "Bazar & Deposits" },
  { id: "admin", label: "Admin", adminOnly: true },
];

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
    hasAccess,
    accessDeniedReason,
    members,
    logout,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [monthKey, setMonthKey] = useState(formatMonthKey(new Date()));
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tabFromUrl = searchParams.get("tab");
    return (tabFromUrl === "summary" ||
      tabFromUrl === "meals" ||
      tabFromUrl === "logs" ||
      tabFromUrl === "admin")
      ? tabFromUrl
      : "summary";
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (
      tabFromUrl === "summary" ||
      tabFromUrl === "meals" ||
      tabFromUrl === "logs" ||
      tabFromUrl === "admin"
    ) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user || !hasAccess) return;
    setDataLoading(true);
    const unsub = subscribeToMonthData(monthKey, (data) => {
      setMonthData(data);
      setDataLoading(false);
    });
    return unsub;
  }, [monthKey, user, hasAccess]);

  const shiftMonth = useCallback((delta: number) => {
    setMonthKey((prev) => {
      const [year, month] = prev.split("-").map(Number);
      const date = new Date(year, month - 1 + delta, 1);
      return formatMonthKey(date);
    });
  }, []);

  const updateTab = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`/dashboard?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSaveMeals = useCallback(
    async (date: string, meals: Record<string, MemberMeals>) => {
      await saveDailyMeals(monthKey, { date, meals });
    },
    [monthKey]
  );

  const handleEditMeals = useCallback(
    async (date: string, meals: Record<string, MemberMeals>) => {
      await saveDailyMeals(monthKey, { date, meals });
    },
    [monthKey]
  );

  const handleDeleteMeals = useCallback(
    async (date: string) => {
      await deleteDailyMeals(monthKey, date);
    },
    [monthKey]
  );

  const handleAddBazar = useCallback(
    async (date: string, amount: number, description: string) => {
      await addBazarEntry(monthKey, { date, amount, description });
    },
    [monthKey]
  );

  const handleEditBazar = useCallback(
    async (id: string, entry: { date: string; amount: number; description: string }) => {
      await updateBazarEntry(monthKey, id, entry);
    },
    [monthKey]
  );

  const handleAddDeposit = useCallback(
    async (
      memberId: string,
      memberName: string,
      amount: number,
      date: string,
      note: string
    ) => {
      await addDepositEntry(monthKey, {
        memberId,
        memberName,
        amount,
        date,
        note,
      });
    },
    [monthKey]
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
      await updateDepositEntry(monthKey, id, entry);
    },
    [monthKey]
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

  const handleAddMember = useCallback(async (name: string, email: string) => {
    await addMember(name, email);
  }, []);

  const handleUpdateMember = useCallback(async (member: Member) => {
    await updateMember(member);
  }, []);

  const handleSetMemberStatus = useCallback(
    async (memberId: string, status: Member["status"]) => {
      await setMemberStatus(memberId, status);
    },
    []
  );

  const handleDeleteBazar = useCallback(
    async (id: string) => {
      await deleteBazarEntry(monthKey, id);
    },
    [monthKey]
  );

  const handleDeleteDeposit = useCallback(
    async (id: string) => {
      await deleteDepositEntry(monthKey, id);
    },
    [monthKey]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace("/");
  }, [logout, router]);

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

  const currentMember = user?.email
    ? members.find(
      (member) =>
        member.email?.trim().toLowerCase() === user.email?.trim().toLowerCase()
    ) ?? null
    : null;

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

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

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
              <OverviewCards
                stats={stats}
                bills={monthData.bills}
                isAdmin={isAdmin}
              />
            </div>

            <div className="mb-6 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 pb-1">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => updateTab(tab.id)}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${activeTab === tab.id
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                      : "bg-white/60 text-slate-600 hover:bg-white dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "summary" && (
              <SummaryTable members={stats.members} isAdmin={isAdmin} />
            )}

            {activeTab === "meals" && (
              <DailyMealsSheet
                records={monthData.dailyMeals}
                members={monthData.members}
                isAdmin={isAdmin}
                onEdit={isAdmin ? handleEditMeals : undefined}
                onDelete={isAdmin ? handleDeleteMeals : undefined}
              />
            )}

            {activeTab === "logs" && (
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

            {activeTab === "admin" && isAdmin && (
              <AdminPanel
                members={monthData.members}
                bills={monthData.bills}
                onSaveMeals={handleSaveMeals}
                onAddBazar={handleAddBazar}
                onAddDeposit={handleAddDeposit}
                onUpdateBills={handleUpdateBills}
                onAddMember={handleAddMember}
                onUpdateMember={handleUpdateMember}
                onSetMemberStatus={handleSetMemberStatus}
              />
            )}

            {!isAdmin && (
              <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-500">
                Read-only mode — contact admin to make changes
              </p>
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
