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
  breadcrumbLabel: string;
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
  breadcrumbLabel,
  totalBalance,
  onLogout,
  sidebarExpanded,
  onOpenMobileNav,
}: DashboardNavProps) {
  const {
    isAdmin: authIsAdmin,
    isSuperAdmin,
    canDeleteNotifications,
    members,
    userProfilePhotoURL,
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
  const memberPhotoURL = useMemo(() => {
    const email = user.email?.trim().toLowerCase();
    if (!email) return null;
    return members.find((member) => member.email.trim().toLowerCase() === email)?.photoURL ?? null;
  }, [members, user.email]);
  const displayName = useMemo(() => {
    if (profileOverride) return profileOverride.name;
    return memberName?.trim() || user?.displayName?.trim() || "Member";
  }, [memberName, profileOverride, user]);
  const avatarURL = profileOverride
    ? profileOverride.photoURL
    : memberPhotoURL ?? userProfilePhotoURL ?? user.photoURL;

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
      <header className={`glass-bar relative sticky top-0 z-40 w-full max-w-full overflow-visible transition-[margin,width] duration-150 ease-out motion-reduce:transition-none ${sidebarExpanded ? "md:ml-64 md:w-[calc(100%-16rem)]" : "md:ml-[72px] md:w-[calc(100%-72px)]"}`}>
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 px-3 py-3 sm:px-4 sm:py-4 md:flex md:flex-nowrap md:justify-between md:gap-3 lg:px-8">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="tactile-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-container"
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[10px] font-medium text-secondary sm:text-xs">
            <span className="shrink-0">Dashboard</span>
            <ChevronRight className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate text-primary">{breadcrumbLabel}</span>
          </nav>
        </div>

        <div className="col-span-2 row-start-2 flex w-full items-center justify-center gap-3 md:col-span-1 md:row-start-auto md:w-auto md:shrink-0 md:justify-start">
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-secondary md:flex">
            <span>Dashboard</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <span className="text-primary">{breadcrumbLabel}</span>
          </nav>
          <div className="clay-pill flex shrink-0 items-center justify-center gap-0.5 border border-subtle/90 bg-elevated/70 px-2.5 py-1.5 text-xs transition-colors sm:gap-1 sm:px-3 sm:text-sm">
            <button
              type="button"
              onClick={onPrevMonth}
              className="tactile-press flex shrink-0 items-center justify-center rounded-full p-1 text-secondary transition-colors hover:bg-container/60"
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
              className="tactile-press flex shrink-0 items-center justify-center rounded-full p-1 text-secondary transition-colors hover:bg-container/60"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        <div className="col-start-2 row-start-1 ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-1.5 md:ml-0">
          {typeof totalBalance === "number" && (
            <div className="clay-pill flex shrink-0 items-center gap-1 whitespace-nowrap border border-brand-secondary/30 bg-kpi-sage px-1.5 py-1 text-[10px] font-semibold text-brand-secondary sm:gap-1.5 sm:px-2.5 sm:text-xs" title="Current meal balance">
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap shrink-0 tabular-nums">৳{formatCurrency(Math.abs(totalBalance))}</span>
            </div>
          )}
          <div ref={notificationContainerRef} className="relative inline-block shrink-0">
            <button
              type="button"
              onClick={handleBellClick}
              className="tactile-press glass relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors duration-200"
              aria-label="Open notifications"
              title="Notifications"
            >
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-fill px-1 text-[9px] font-bold tabular-nums text-danger-on-fill sm:h-5 sm:min-w-5 sm:text-[10px]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
            <AnimatePresence>
              {showNotifications ? (
                <motion.aside
                  initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 300, damping: 28 }
                  }
                  className="clay-card fixed right-3 top-28 z-50 flex w-[calc(100vw-1.5rem)] max-w-sm origin-top-right transform-gpu flex-col overflow-hidden will-change-transform sm:right-6 sm:top-20 sm:w-96"
                >
                <div className="flex items-center justify-between border-b border-subtle/80 px-4 py-3 dark:border-subtle/80">
                  <div>
                    <h2 className="text-balance text-lg font-semibold text-primary">Activity Log</h2>
                    <p className="text-xs text-muted dark:text-muted">
                      {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                    }}
                    className="tactile-press flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-container hover:text-secondary dark:hover:bg-elevated"
                    aria-label="Close notifications"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div
                  className="custom-scrollbar flex-1 max-h-[70vh] min-h-[300px] space-y-1.5 overflow-y-auto p-3"
                >
                  {visibleActivityLogs.length === 0 ? (
                    <div className="clay-card p-4 text-sm text-secondary">
                      No notifications for this month yet.
                    </div>
                  ) : (
                    visibleActivityLogs.map((log) => {
                      const content = (
                        <div className="w-full text-primary">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold">{log.action}</p>
                              <p className="mt-1 text-[11px] text-muted dark:text-muted">{log.performedBy}</p>
                            </div>
                            <span className="shrink-0 text-[10px] text-muted">
                              {new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-muted dark:text-muted">{log.details}</p>
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
            className="tactile-press glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-colors duration-200"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>

          <span
            title={roleLabel}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-container text-secondary md:flex lg:h-auto lg:w-auto lg:gap-1 lg:px-2.5 lg:py-1 lg:text-xs lg:font-semibold"
          >
            <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only lg:not-sr-only">{roleLabel}</span>
          </span>

          <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              ref={profileTriggerRef}
              type="button"
              onClick={() => setProfileOpen((previous) => !previous)}
              className="tactile-press relative shrink-0 rounded-full"
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
                  className="h-8 w-8 rounded-full object-cover ring-2 ring-brand/30 sm:h-9 sm:w-9"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-fill text-xs font-bold text-brand-on-fill ring-2 ring-brand/30 sm:h-9 sm:w-9 sm:text-sm">
                  {avatarInitial}
                </div>
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand-secondary" aria-label="Online" />
            </button>

            <div className="hidden min-w-0 flex-col xl:flex">
              <span className="max-w-[110px] truncate text-xs font-semibold text-primary">
                {displayName}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted dark:text-muted">
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
                  className="clay-card absolute right-0 top-full z-50 mt-2 w-52 origin-top-right transform-gpu p-2 text-left will-change-transform sm:right-0"
                >
                <div className="flex items-center gap-2 border-b border-subtle/70 px-3 pb-2 dark:border-subtle/70">
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
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-fill text-sm font-bold text-brand-on-fill">
                      {avatarInitial}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-muted dark:text-muted">{roleLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setEditProfileOpen(true);
                  }}
                  className="tactile-press mt-2 flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-secondary transition-colors hover:bg-container dark:text-secondary dark:hover:bg-elevated"
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
                  className="tactile-press mt-2 flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-danger hover:bg-danger-surface"
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
        title="Delete this activity log?"
        confirmLabel="Yes, delete log"
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
