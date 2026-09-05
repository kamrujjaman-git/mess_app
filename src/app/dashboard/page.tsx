"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
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
  formatMonthLabel,
  type DailyMealRecord,
  type MemberMeals,
  type Member,
  type MonthBills,
  type BillField,
} from "@/lib/mess";
import {
  subscribeToMonthData,
  saveDailyMeals,
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
  type MonthData,
} from "@/lib/firestore";

type Tab = "summary" | "meals" | "logs" | "admin";
type AdminSubTab = "entries" | "members";

async function notifyByEmail(
  user: { getIdToken: () => Promise<string> } | null,
  emails: string[],
  subject: string,
  html: string
): Promise<void> {
  const recipients = [...new Set(emails.map((email) => email.trim()).filter((email) => email.includes("@")))];
  if (!user || recipients.length === 0) return;

  try {
    const idToken = await user.getIdToken();
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ emails: recipients, subject, html }),
    });
    if (!response.ok) {
      console.error("Background email notification failed with status:", response.status);
    }
  } catch (error) {
    console.error("Background email notification failed:", error);
  }
}

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
  const [monthLoadedKey, setMonthLoadedKey] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<{ monthKey: string; message: string } | null>(null);
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
  useEffect(() => {
    if (!user || !hasAccess) return;
    const unsub = subscribeToMonthData(
      monthKey,
      (data) => {
        setMonthData(data);
        setMonthLoadedKey(monthKey);
        setDataLoading(false);
      },
      (error) => {
        console.error("Failed to load month data:", error);
        setDataLoading(false);
        setDataError({
          monthKey,
          message: "Could not load this month right now. Please try again.",
        });
        toast.error("Could not load dashboard data.");
      }
    );
    return unsub;
  }, [monthKey, user, hasAccess]);

  const currentDataError = dataError?.monthKey === monthKey ? dataError.message : null;

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
        user?.email || "System"
      );
      upsertMealsInLocalState(date, meals);
    },
    [monthKey, upsertMealsInLocalState, user?.email]
  );

  const handleEditMeals = useCallback(
    async (date: string, meals: Record<string, MemberMeals>) => {
      await saveDailyMeals(
        monthKey,
        { date, meals },
        user?.email || "System"
      );
      upsertMealsInLocalState(date, meals);
    },
    [monthKey, upsertMealsInLocalState, user?.email]
  );

  const handleAddBazar = useCallback(
    async (date: string, amount: number, description: string, buyerIds: string[] = []) => {
      await addBazarEntry(
        monthKey,
        { date, amount, description, buyerIds },
        user?.email || "System"
      );
      const buyerNames = buyerIds
        .map((id) => members.find((member) => member.id === id)?.name ?? id)
        .join(", ");
      notifyByEmail(
        user,
        buyerIds
          .map((id) => members.find((member) => member.id === id)?.email ?? "")
          .filter(Boolean),
        `Bazar update for ${date}`,
        `<p>Bazar entry added for ${date}: ৳${amount}. Buyers: ${buyerNames}.${description ? ` Description: ${description}` : ""}</p>`
      );
    },
    [members, monthKey, user]
  );

  const handleEditBazar = useCallback(
    async (id: string, entry: { date: string; amount: number; description: string; buyerIds?: string[]; buyerId?: string | null }) => {
      await updateBazarEntry(
        monthKey,
        id,
        entry,
        user?.email || "System"
      );
      const buyerIds = entry.buyerIds ?? (entry.buyerId ? [entry.buyerId] : []);
      const buyerNames = buyerIds
        .map((buyerId) => members.find((member) => member.id === buyerId)?.name ?? buyerId)
        .join(", ");
      notifyByEmail(
        user,
        buyerIds
          .map((buyerId) => members.find((member) => member.id === buyerId)?.email ?? "")
          .filter(Boolean),
        `Bazar update for ${entry.date}`,
        `<p>Bazar entry updated for ${entry.date}: ৳${entry.amount}. Buyers: ${buyerNames}.${entry.description ? ` Description: ${entry.description}` : ""}</p>`
      );
    },
    [members, monthKey, user]
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
        user?.email || "System"
      );
      notifyByEmail(
        user,
        [members.find((member) => member.id === memberId)?.email ?? ""],
        `Deposit received on ${date}`,
        `<p>Deposit received by ${memberName}: ৳${amount} on ${date}.${note ? ` Note: ${note}` : ""}</p>`
      );
    },
    [members, monthKey, user]
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
        user?.email || "System"
      );
      notifyByEmail(
        user,
        [members.find((member) =>
          member.id === entry.memberId ||
          (!entry.memberId && member.name === entry.memberName)
        )?.email ?? ""],
        `Deposit updated on ${entry.date}`,
        `<p>Deposit updated for ${entry.memberName}: ৳${entry.amount} on ${entry.date}.${entry.note ? ` Note: ${entry.note}` : ""}</p>`
      );
    },
    [members, monthKey, user]
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
        user?.email || "System"
      );
    },
    [monthKey, user]
  );

  const handleDeleteDeposit = useCallback(
    async (id: string) => {
      await deleteDepositEntry(
        monthKey,
        id,
        user?.email || "System"
      );
    },
    [monthKey, user]
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

  const currentDataReady = monthLoadedKey === monthKey;
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
        onMonthChange={setMonthKey}
        user={user}
        isAdmin={isAdmin}
        memberName={memberDisplayName}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {currentDataError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {currentDataError}
          </div>
        ) : dataLoading || !currentDataReady || !monthData || !stats ? (
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
                    {`Selected month — ${formatMonthLabel(monthKey)}`}
                  </h2>
                </div>
              </div>

              <OverviewCards
                stats={stats}
                bills={monthData.bills}
                isAdmin={isAdmin}
              />
            </div>

            <div className="glass mb-6 overflow-x-auto whitespace-nowrap rounded-2xl px-2 py-1 scrollbar-none">
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
              <SummaryTable members={stats.members} monthKey={monthKey} isAdmin={isAdmin} />
            )}

            {currentTab === "meals" && (
              <DailyMealsSheet
                records={monthData.dailyMeals}
                members={monthData.members}
                selectedMonthKey={monthKey}
                isAdmin={isAdmin}
                onEdit={handleEditMeals}
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
                key={monthKey}
                members={monthData.members}
                bills={monthData.bills}
                selectedMonthKey={monthKey}
                subTab={activeSubTab}
                onSubTabChange={updateAdminSubTab}
                onSaveMeals={handleSaveMeals}
                onAddBazar={handleAddBazar}
                onAddDeposit={handleAddDeposit}
                onUpdateBills={handleUpdateBills}
                onAddMember={handleAddMember}
                onUpdateMember={handleUpdateMember}
                onSetMemberStatus={handleSetMemberStatus}
                onDeleteMember={handleDeleteMember}
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
