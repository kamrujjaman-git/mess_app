"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Pencil,
  Shield,
  Sun,
  Moon,
  Menu,
  X,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { useToast } from "@/components/ui/ToastProvider";
import { formatCurrency } from "@/lib/mess";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";
import { EditProfileModal } from "./EditProfileModal";

interface DashboardNavProps {
  monthKey: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthChange: (monthKey: string) => void;
  user: User;
  isAdmin: boolean;
  memberName?: string | null;
  totalBalance?: number | null;
  onLogout: () => void;
  sidebarExpanded: boolean;
  onOpenMobileNav: () => void;
}

export function DashboardNav({
  monthKey,
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  user,
  isAdmin,
  memberName,
  totalBalance,
  onLogout,
  sidebarExpanded,
  onOpenMobileNav,
}: DashboardNavProps) {
  const {
    isAdmin: authIsAdmin,
    isSuperAdmin,
    canDeleteNotifications,
    refreshUserProfile,
  } = useAuth();
  const reduceMotion = useReducedMotion();
  const { undo, error } = useToast();
  const [imageFailed, setImageFailed] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedTheme = window.localStorage.getItem("theme");
    return storedTheme ? storedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileOverride, setProfileOverride] = useState<{
    name: string;
    photoURL: string | null;
  } | null>(null);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("mess_activity_last_seen")
  );
  const [hiddenLogIds, setHiddenLogIds] = useState<string[]>([]);
  const [pendingDeleteLogId, setPendingDeleteLogId] = useState<string | null>(null);
  const notificationContainerRef = useRef<HTMLDivElement | null>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const profilePopoverRef = useRef<HTMLDivElement | null>(null);
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!showNotifications) return;

    function handleOutsidePointerDown(event: PointerEvent) {
      if (!notificationContainerRef.current?.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [showNotifications]);

  useEffect(() => {
    if (!profileOpen) return;

    function handleOutsidePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !profileTriggerRef.current?.contains(target) &&
        !profilePopoverRef.current?.contains(target)
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [profileOpen]);

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
    () => activityLogs.filter((log) => isActivityLogForMonth(log, monthKey) && !hiddenLogIds.includes(log.id)),
    [activityLogs, hiddenLogIds, monthKey]
  );

  const unreadCount = useMemo(() => {
    if (!visibleActivityLogs.length) return 0;
    const threshold = lastSeenTimestamp ? new Date(lastSeenTimestamp).getTime() : 0;
    return visibleActivityLogs.filter((log) => new Date(log.timestamp).getTime() > threshold).length;
  }, [visibleActivityLogs, lastSeenTimestamp]);

  const roleLabel = isSuperAdmin ? "Super Admin" : isAdmin || authIsAdmin ? "Admin" : "Member";
  const displayName = useMemo(() => {
    if (profileOverride) return profileOverride.name;
    return memberName?.trim() || user?.displayName?.trim() || "Member";
  }, [memberName, profileOverride, user]);
  const avatarURL = profileOverride ? profileOverride.photoURL : user.photoURL;

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

  function queueDeleteActivityLog(logId: string) {
    if (!canDeleteNotifications) return;
    setHiddenLogIds((previous) => [...previous, logId]);
    const timer = setTimeout(async () => {
      try {
        await deleteActivityLog(logId);
        setHiddenLogIds((previous) => previous.filter((id) => id !== logId));
      } catch (deleteError) {
        console.error("Failed to delete activity log:", deleteError);
        setHiddenLogIds((previous) => previous.filter((id) => id !== logId));
        error("Failed to delete notification.");
      }
      pendingDeletes.current.delete(logId);
    }, 5000);
    pendingDeletes.current.set(logId, timer);
    undo("Notification deleted", () => {
      const pendingTimer = pendingDeletes.current.get(logId);
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingDeletes.current.delete(logId);
      setHiddenLogIds((previous) => previous.filter((id) => id !== logId));
    });
  }

  function requestDeleteActivityLog(logId: string) {
    if (canDeleteNotifications) setPendingDeleteLogId(logId);
  }

  useEffect(() => () => {
    pendingDeletes.current.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <>
      <header className={`relative sticky top-0 z-40 w-full max-w-full overflow-visible border-b border-slate-200/50 bg-white/80 shadow-md shadow-slate-900/5 backdrop-blur-lg transition-[margin,width] duration-150 ease-out motion-reduce:transition-none dark:border-slate-800/50 dark:bg-slate-900/80 ${sidebarExpanded ? "md:ml-64 md:w-[calc(100%-16rem)]" : "md:ml-[72px] md:w-[calc(100%-72px)]"}`}>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 px-3 py-3 sm:px-4 sm:py-4 md:flex md:flex-nowrap md:justify-between md:gap-3 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="col-start-1 row-start-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="col-span-2 row-start-2 flex w-full justify-center md:col-span-1 md:row-start-auto md:w-auto md:shrink-0 md:justify-start">
          <div className="flex shrink-0 items-center justify-center gap-0.5 rounded-full border border-slate-200/90 bg-slate-50/70 px-2.5 py-1.5 text-xs shadow-sm transition-colors dark:border-slate-800/80 dark:bg-slate-900/80 sm:gap-1 sm:px-3 sm:text-sm">
            <button
              type="button"
              onClick={onPrevMonth}
              className="flex shrink-0 items-center justify-center rounded-full p-1 text-slate-600 transition-colors hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <div className="min-w-[9rem] w-auto max-w-fit xl:min-w-[12rem]">
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

        <div className="col-start-2 row-start-1 ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-1.5 md:ml-0">
          {typeof totalBalance === "number" && (
            <div className="flex shrink-0 max-w-[5rem] items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-1.5 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300 sm:max-w-none sm:gap-1.5 sm:px-2.5 sm:text-xs" title="Current meal balance">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">৳{formatCurrency(Math.abs(totalBalance))}</span>
            </div>
          )}
          <div ref={notificationContainerRef} className="relative inline-block shrink-0">
            <button
              type="button"
              onClick={handleBellClick}
              className="glass relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors duration-200 dark:text-slate-100"
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
            <AnimatePresence>
              {showNotifications ? (
                <motion.aside
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 300, damping: 28 }
                  }
                  className="fixed right-3 top-28 z-50 flex w-[calc(100vw-1.5rem)] max-w-sm transform-gpu flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl will-change-transform dark:border-slate-800 dark:bg-slate-900 sm:right-6 sm:top-20 sm:w-96"
                >
                <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-800/80">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Activity Log</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label="Close notifications"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className="custom-scrollbar flex-1 max-h-[70vh] min-h-[300px] space-y-1.5 overflow-y-auto p-3"
                >
                  {visibleActivityLogs.length === 0 ? (
                    <div className="rounded-xl border border-slate-200/80 bg-white/95 p-4 text-sm text-slate-700 shadow-lg shadow-slate-200/50 dark:border-slate-800/80 dark:bg-slate-900/95 dark:text-slate-200 dark:shadow-black/40">
                      No notifications for this month yet.
                    </div>
                  ) : (
                    visibleActivityLogs.map((log) => {
                      const content = (
                        <div className="w-full text-slate-800 dark:text-slate-100">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold">{log.action}</p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{log.performedBy}</p>
                            </div>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{log.details}</p>
                        </div>
                      );
                      if (!canDeleteNotifications) {
                        return <div key={log.id}>{content}</div>;
                      }
                      return (
                        <SwipeableListItem
                          key={log.id}
                          onDelete={() => requestDeleteActivityLog(log.id)}
                          deleteLabel="Delete"
                          className="my-1.5"
                        >
                          {content}
                        </SwipeableListItem>
                      );
                    })
                  )}
                </div>
                </motion.aside>
              ) : null}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors duration-200 dark:text-slate-100"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>

          <span
            title={roleLabel}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 md:flex lg:h-auto lg:w-auto lg:gap-1 lg:px-2.5 lg:py-1 lg:text-xs lg:font-semibold"
          >
            <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only lg:not-sr-only">{roleLabel}</span>
          </span>

          <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              ref={profileTriggerRef}
              type="button"
              onClick={() => setProfileOpen((previous) => !previous)}
              className="relative shrink-0 rounded-full"
              aria-label={profileOpen ? "Close profile menu" : "Open profile menu"}
              aria-expanded={profileOpen}
            >
              {avatarURL && !imageFailed ? (
                <Image
                  src={avatarURL}
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
            </button>

            <div className="hidden min-w-0 flex-col xl:flex">
              <span className="max-w-[110px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                {displayName}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {roleLabel}
              </span>
            </div>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  ref={profilePopoverRef}
                  initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 300, damping: 28 }
                  }
                  className="absolute right-0 top-full z-50 mt-2 w-52 transform-gpu rounded-2xl border border-slate-200/70 bg-white/95 p-2 text-left shadow-xl backdrop-blur-lg will-change-transform dark:border-slate-700/70 dark:bg-slate-900/95 sm:right-0"
                >
                <div className="flex items-center gap-2 border-b border-slate-200/70 px-3 pb-2 dark:border-slate-700/70">
                  {avatarURL && !imageFailed ? (
                    <Image
                      src={avatarURL}
                      alt=""
                      width={36}
                      height={36}
                      unoptimized
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
                      {avatarInitial}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{roleLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setEditProfileOpen(true);
                  }}
                  className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                  className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
      <DeleteConfirmationModal
        open={Boolean(pendingDeleteLogId)}
        onConfirm={() => {
          if (pendingDeleteLogId) queueDeleteActivityLog(pendingDeleteLogId);
          setPendingDeleteLogId(null);
        }}
        onCancel={() => setPendingDeleteLogId(null)}
      />
      </header>
      <AnimatePresence>
        {editProfileOpen ? (
          <EditProfileModal
            user={user}
            initialName={displayName}
            initialPhotoURL={avatarURL}
            onClose={() => {
              setEditProfileOpen(false);
              requestAnimationFrame(() => profileTriggerRef.current?.focus());
            }}
            onSaved={(name, photoURL) => {
              setProfileOverride({ name, photoURL });
              setImageFailed(false);
              void refreshUserProfile().catch((error) => {
                console.error("Could not refresh the signed-in profile:", error);
              });
            }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
