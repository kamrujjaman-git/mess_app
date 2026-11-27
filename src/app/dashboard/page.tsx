"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { createIdempotencyKey } from "@/lib/idempotency";
import { useAuth } from "@/context/AuthContext";
import { AccessDeniedScreen } from "@/components/AccessDeniedScreen";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import {
  Sidebar,
  type AdminSection,
  type DashboardLogSection,
  type DashboardTab,
  type SidebarDestination,
} from "@/components/dashboard/Sidebar";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { SummaryTable } from "@/components/dashboard/SummaryTable";
import { DailyMealsSheet } from "@/components/dashboard/DailyMealsSheet";
import { BazarDepositLog } from "@/components/dashboard/BazarDepositLog";
import { AdminPanel } from "@/components/dashboard/AdminPanel";
import { LogCardSkeleton, MealSheetSkeleton, SummaryCardSkeleton } from "@/components/dashboard/Skeletons";
import {
  calculateMessStats,
  formatMonthKey,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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
        "X-Idempotency-Key": createIdempotencyKey(),
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

function getTabFromUrl(tab: string | null): DashboardTab {
  return tab === "cards" || tab === "summary" || tab === "meals" || tab === "logs" || tab === "admin"
    ? tab
    : tab === null
      ? "cards"
      : "summary";
}

function getSectionFromUrl(section: string | null): DashboardLogSection | null {
  return section === "bazar" || section === "deposits" || section === "bills"
    ? section
    : null;
}

function getAdminSectionFromUrl(section: string | null): AdminSection | null {
  return section === "daily-meals" ||
    section === "add-bazar" ||
    section === "add-deposit" ||
    section === "fixed-bills" ||
    section === "add-member" ||
    section === "all-members" ||
    section === "activity-log"
    ? section
    : null;
}

function getDashboardBreadcrumbLabel(
  tab: DashboardTab,
  section: DashboardLogSection | null,
  adminSection: AdminSection | null
): string {
  if (tab === "cards") return "Overview";
  if (tab === "summary") return "Summary Table";
  if (tab === "meals") return "Daily Meal Sheet";
  if (tab === "logs") {
    if (section === "deposits") return "Deposit Log";
    if (section === "bills") return "Monthly Fixed Bills";
    return "Bazar Log";
  }

  const adminLabels: Record<AdminSection, string> = {
    "daily-meals": "Daily Meals",
    "add-bazar": "Add Bazar",
    "add-deposit": "Add Deposit",
    "fixed-bills": "Set Fixed Bills",
    "add-member": "Add New Member",
    "all-members": "All Members",
    "activity-log": "Activity Log",
  };
  return adminLabels[adminSection ?? "daily-meals"];
}

function DashboardLoading() {
  return (
    <div className="min-h-screen flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="h-16 animate-pulse rounded-2xl bg-container/70 dark:bg-elevated/70" />
        <SummaryCardSkeleton count={7} />
        <LogCardSkeleton />
      </div>
    </div>
  );
}

function DashboardContent() {
  const {
    user,
    loading,
    sessionLoading,
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
  const [resolvedMemberPhotoState, setResolvedMemberPhotoState] = useState<{
    uid: string;
    photos: Map<string, string>;
  } | null>(null);
  const activeTab = getTabFromUrl(searchParams.get("tab"));
  const requestedAdminSection = getAdminSectionFromUrl(searchParams.get("adminSection"));
  const legacyAdminSubTab = searchParams.get("subtab");
  const activeSection = getSectionFromUrl(searchParams.get("section"));
  const activeAdminSection = requestedAdminSection ??
    (activeTab === "admin"
      ? legacyAdminSubTab === "members"
        ? "all-members"
        : "daily-meals"
      : null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentMember = user?.email
    ? members.find(
      (member) =>
        member.email?.trim().toLowerCase() === user.email?.trim().toLowerCase()
    ) ?? null
    : null;

  useEffect(() => {
    if (!user || !hasAccess) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/member-avatars", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
          signal: controller.signal,
        });

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new Error("Member photo service returned an invalid response.");
        }
        if (!response.ok || !isRecord(body) || !Array.isArray(body.photos)) {
          throw new Error(
            isRecord(body) && typeof body.error === "string"
              ? body.error
              : "Could not load member photos."
          );
        }

        const photos = new Map<string, string>();
        for (const photo of body.photos) {
          if (
            isRecord(photo) &&
            typeof photo.memberId === "string" &&
            typeof photo.photoURL === "string" &&
            photo.photoURL.trim()
          ) {
            photos.set(photo.memberId, photo.photoURL.trim());
          }
        }
        if (!controller.signal.aborted) {
          setResolvedMemberPhotoState({ uid: user.uid, photos });
        }
      } catch {
        if (!controller.signal.aborted) {
          console.error("Could not load member profile photos.");
        }
      }
    })();

    return () => controller.abort();
  }, [user, hasAccess]);
  const resolvedMemberPhotos = user &&
    hasAccess &&
    resolvedMemberPhotoState &&
    resolvedMemberPhotoState.uid === user.uid
    ? resolvedMemberPhotoState.photos
    : null;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const currentTab = isAdmin && activeTab === "admin"
    ? "admin"
    : activeTab === "admin"
      ? "summary"
      : activeTab;
  const breadcrumbLabel = getDashboardBreadcrumbLabel(
    currentTab,
    activeSection,
    activeAdminSection
  );
  useEffect(() => {
    if (!user || !hasAccess) return;
    const unsub = subscribeToMonthData(
      monthKey,
      (data) => {
        setMonthData(data);
        setMonthLoadedKey(monthKey);
        setDataLoading(false);
        setDataError(null);
      },
      (error) => {
        const code = "code" in error && typeof error.code === "string"
          ? error.code
          : "unknown";
        console.error("Failed to load month data:", { code });
        if (
          sessionLoading &&
          (code === "permission-denied" || code.endsWith("/permission-denied"))
        ) {
          return;
        }
        setDataLoading(false);
        setDataError({
          monthKey,
          message: "Could not load this month right now. Please try again.",
        });
        toast.error("Could not load dashboard data.");
      }
    );
    return unsub;
  }, [monthKey, user, hasAccess, sessionLoading]);

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

  const updateDestination = useCallback(
    (destination: SidebarDestination) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", destination.tab);
      if (destination.tab === "logs" && destination.section) {
        params.set("section", destination.section);
      } else {
        params.delete("section");
      }

      if (destination.tab === "admin") {
        const adminSection = destination.adminSection;
        params.set(
          "subtab",
          adminSection === "add-member" || adminSection === "all-members" ? "members" : "entries"
        );
        if (adminSection) params.set("adminSection", adminSection);
        else params.delete("adminSection");
      } else {
        params.delete("subtab");
        params.delete("adminSection");
      }
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

  const stats = useMemo(
    () => monthData
      ? calculateMessStats(
        monthData.dailyMeals,
        monthData.bazar,
        monthData.deposits,
        monthData.bills,
        monthData.members
      )
      : null,
    [monthData]
  );
  const summaryMemberProfiles = useMemo(
    () => (monthData?.members ?? []).map((member) => ({
      ...member,
      photoURL: member.photoURL || resolvedMemberPhotos?.get(member.id) || null,
    })),
    [monthData?.members, resolvedMemberPhotos]
  );

  const currentDataReady = monthLoadedKey === monthKey;
  const closeMobileNav = useCallback(
    () => setMobileNavOpen(false),
    [setMobileNavOpen]
  );

  if (loading || accessLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
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
        breadcrumbLabel={breadcrumbLabel}
        totalBalance={stats?.remainingBalance ?? null}
        onLogout={handleLogout}
        sidebarExpanded={sidebarExpanded}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />
      <Sidebar
        activeTab={currentTab}
        activeSection={activeSection}
        activeAdminSection={activeAdminSection}
        isAdmin={isAdmin}
        expanded={sidebarExpanded}
        mobileOpen={mobileNavOpen}
        onToggleExpanded={() => setSidebarExpanded((expanded) => !expanded)}
        onCloseMobile={closeMobileNav}
        onNavigate={updateDestination}
      />

      <main
        className={`w-full min-w-0 flex-1 px-4 py-6 transition-[margin,width] duration-150 ease-out motion-reduce:transition-none sm:px-6 lg:px-8 ${
          sidebarExpanded
            ? "md:ml-64 md:w-[calc(100%-16rem)]"
            : "md:ml-[72px] md:w-[calc(100%-72px)]"
        }`}
      >
        <div className="mx-auto w-full min-w-0 max-w-7xl">
        {currentDataError ? (
          <div className="rounded-2xl border border-danger-border bg-danger-surface px-4 py-6 text-center text-sm leading-relaxed text-danger-on-surface">
            {currentDataError}
          </div>
        ) : dataLoading || !currentDataReady || !monthData || !stats ? (
          <div className="space-y-6">
            {currentTab === "cards" ? (
              <SummaryCardSkeleton count={isAdmin ? 7 : 6} />
            ) : currentTab === "meals" ? (
              <MealSheetSkeleton />
            ) : currentTab === "summary" ? (
              <div className="h-72 animate-pulse rounded-3xl border border-subtle/70 bg-container/50 dark:border-subtle dark:bg-elevated/50" />
            ) : (
              <LogCardSkeleton />
            )}
          </div>
        ) : (
          <>
            {currentTab === "cards" ? (
              <section aria-label="Overview" className="mb-6 min-w-0">
                <OverviewCards
                  stats={stats}
                  bills={monthData.bills}
                  isAdmin={isAdmin}
                />
              </section>
            ) : null}

            {currentTab === "summary" && (
              <SummaryTable
                members={stats.members}
                memberProfiles={summaryMemberProfiles}
                monthKey={monthKey}
                isAdmin={isAdmin}
              />
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
                onAddBazar={isAdmin ? () => updateDestination({ tab: "admin", adminSection: "add-bazar" }) : undefined}
                onAddDeposit={isAdmin ? () => updateDestination({ tab: "admin", adminSection: "add-deposit" }) : undefined}
                activeSection={activeSection}
              />
            )}

            {currentTab === "admin" && isAdmin && (
              <AdminPanel
                key={monthKey}
                members={monthData.members}
                bills={monthData.bills}
                selectedMonthKey={monthKey}
                activeSection={activeAdminSection}
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
        </div>
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
