"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import {
  deleteActivityLog,
  isActivityLogForMonth,
  type ActivityLog,
} from "@/lib/firestore";
import { SwipeableListItem } from "./SwipeableListItem";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";

interface DashboardNavProps {
  monthKey: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthChange: (monthKey: string) => void;
  user: User;
  isAdmin: boolean;
  memberName?: string | null;
  onLogout: () => void;
}

export function DashboardNav({
  monthKey,
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  user,
  isAdmin,
  memberName,
  onLogout,
}: DashboardNavProps) {
  const { isAdmin: authIsAdmin, isSuperAdmin, canDeleteNotifications } = useAuth();
  const [imageFailed, setImageFailed] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedTheme = window.localStorage.getItem("theme");
    return storedTheme ? storedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("mess_activity_last_seen")
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    window.localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "activity_logs"), orderBy("timestamp", "desc")),
      (snapshot) => {
        const logs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ActivityLog, "id">),
        })) as ActivityLog[];
        setActivityLogs(logs);
      },
      (error) => {
        console.error("Could not subscribe to activity logs:", error);
      }
    );

    return () => unsubscribe();
  }, []);


  const visibleActivityLogs = useMemo(
    () => activityLogs.filter((log) => isActivityLogForMonth(log, monthKey)),
    [activityLogs, monthKey]
  );

  const unreadCount = useMemo(() => {
    if (!visibleActivityLogs.length) return 0;
    const threshold = lastSeenTimestamp ? new Date(lastSeenTimestamp).getTime() : 0;
    return visibleActivityLogs.filter((log) => new Date(log.timestamp).getTime() > threshold).length;
  }, [visibleActivityLogs, lastSeenTimestamp]);

  const roleLabel = isSuperAdmin ? "Super Admin" : isAdmin || authIsAdmin ? "Admin" : "Member";
  const displayName = useMemo(() => {
    return memberName?.trim() || user?.displayName?.trim() || "Member";
  }, [memberName, user]);

  const avatarInitial = displayName?.trim()?.charAt(0)?.toUpperCase() ?? "M";

  function handleBellClick() {
    const nextState = !showNotifications;
    setShowNotifications(nextState);

    if (nextState) {
      const newestTimestamp = visibleActivityLogs[0]?.timestamp ?? new Date().toISOString();
      setLastSeenTimestamp(newestTimestamp);
      window.localStorage.setItem("mess_activity_last_seen", newestTimestamp);
    }
  }

  async function handleDeleteActivityLog(logId: string) {
    if (!canDeleteNotifications) return;
    if (!window.confirm("Delete this notification?")) return;

    try {
      await deleteActivityLog(logId);
    } catch (error) {
      console.error("Failed to delete activity log:", error);
    }
  }

  return (
    <header className="glass sticky top-0 z-50 w-full max-w-full overflow-hidden">
      <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-2 gap-y-2 p-3 sm:p-4 md:flex-nowrap md:gap-3 lg:px-8">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-10 sm:w-10">
            <Image
              src="/logo-512.png"
              alt="Mess Logo"
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <span className="truncate text-base font-bold sm:text-lg">Mess App</span>
        </div>

        <div className="order-3 mt-3 flex w-full justify-center md:absolute md:left-1/2 md:top-1/2 md:order-none md:mt-0 md:w-auto md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="flex w-auto max-w-fit items-center justify-center gap-0.5 rounded-full border border-slate-200/90 bg-slate-50/70 px-3 py-1.5 text-xs shadow-sm transition-all hover:shadow dark:border-slate-800/80 dark:bg-slate-900/80 dark:hover:bg-slate-800 sm:gap-1 sm:text-sm">
            <button
              type="button"
              onClick={onPrevMonth}
              className="flex shrink-0 items-center justify-center rounded-full p-1 text-slate-600 transition-colors hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="min-w-0 w-auto max-w-fit">
              <PremiumDatePicker value={monthKey} onChange={onMonthChange} mode="month" />
            </div>
            <button
              type="button"
              onClick={onNextMonth}
              className="flex shrink-0 items-center justify-center rounded-full p-1 text-slate-600 transition-colors hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        <div className="order-2 ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2 md:order-3 md:flex-1">
          <button
            type="button"
            onClick={handleBellClick}
            className="glass relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition-all duration-200 hover:scale-105 dark:text-slate-100"
            aria-label="Open notifications"
            title="Notifications"
          >
            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white sm:h-5 sm:min-w-5 sm:text-[10px]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition-all duration-200 hover:scale-105 dark:text-slate-100"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>

          <span className="hidden items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 sm:flex">
            <Shield className="h-3 w-3" />
            {roleLabel}
          </span>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <div className="relative shrink-0">
              {user?.photoURL && !imageFailed ? (
                <Image
                  src={user.photoURL}
                  alt={displayName}
                  width={36}
                  height={36}
                  unoptimized
                  onError={() => setImageFailed(true)}
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-emerald-500/30 sm:h-9 sm:w-9"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white ring-2 ring-emerald-500/30 sm:h-9 sm:w-9 sm:text-sm">
                  {avatarInitial}
                </div>
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" aria-label="Online" />
            </div>

            <div className="hidden min-w-0 flex-col sm:flex">
              <span className="max-w-[110px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                {displayName}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {roleLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:h-10 sm:w-10"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
      {showNotifications ? (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-[1px]">
          <button
            type="button"
            aria-label="Close notifications"
            className="absolute inset-0 h-full w-full"
            onClick={() => setShowNotifications(false)}
          />
          <aside className="glass absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l transition-transform duration-300 sm:rounded-l-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold">Activity Log</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifications(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {visibleActivityLogs.length === 0 ? (
                <div className="glass-card rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-200">
                  No notifications for this month yet.
                </div>
              ) : (
                visibleActivityLogs.map((log) => {
                  const content = (
                    <div className="glass-card rounded-2xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {log.action}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {log.performedBy}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                        {log.details}
                      </p>
                    </div>
                  );

                  if (!canDeleteNotifications) {
                    return <div key={log.id}>{content}</div>;
                  }

                  return (
                    <SwipeableListItem
                      key={log.id}
                      onDelete={() => handleDeleteActivityLog(log.id)}
                      deleteLabel="Delete"
                      className="rounded-2xl"
                    >
                      {content}
                    </SwipeableListItem>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
