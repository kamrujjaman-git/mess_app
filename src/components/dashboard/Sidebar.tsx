"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import {
  Banknote,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShieldCheck,
  ShoppingBasket,
  TableProperties,
  type LucideIcon,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type DashboardTab = "cards" | "summary" | "meals" | "logs" | "admin";
export type DashboardLogSection = "bazar" | "deposits" | "bills";
export type AdminSection =
  | "daily-meals"
  | "add-bazar"
  | "add-deposit"
  | "fixed-bills"
  | "add-member"
  | "all-members"
  | "activity-log";

export interface SidebarDestination {
  tab: DashboardTab;
  section?: DashboardLogSection;
  adminSection?: AdminSection;
}

interface NavigationItem extends SidebarDestination {
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

interface NavigationGroup {
  label: string;
  icon: LucideIcon;
  items: NavigationItem[];
  adminOnly?: boolean;
}

interface SidebarProps {
  activeTab: DashboardTab;
  activeSection: DashboardLogSection | null;
  activeAdminSection: AdminSection | null;
  isAdmin: boolean;
  expanded: boolean;
  mobileOpen: boolean;
  onToggleExpanded: () => void;
  onCloseMobile: () => void;
  onNavigate: (destination: SidebarDestination) => void;
}

const navigationGroups: NavigationGroup[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { label: "Overview", icon: LayoutGrid, tab: "cards" },
      { label: "Summary Table", icon: TableProperties, tab: "summary" },
    ],
  },
  {
    label: "Meals",
    icon: Utensils,
    items: [{ label: "Daily Meal Sheet", icon: Utensils, tab: "meals" }],
  },
  {
    label: "Bazar & Deposits",
    icon: ShoppingBasket,
    items: [
      { label: "Bazar Log", icon: ShoppingBasket, tab: "logs", section: "bazar" },
      { label: "Deposit Log", icon: Wallet, tab: "logs", section: "deposits" },
      { label: "Monthly Fixed Bills", icon: ReceiptText, tab: "logs", section: "bills", adminOnly: true },
    ],
  },
  {
    label: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { label: "Daily Meals", icon: Utensils, tab: "admin", adminSection: "daily-meals" },
      { label: "Add Bazar", icon: ShoppingBasket, tab: "admin", adminSection: "add-bazar" },
      { label: "Add Deposit", icon: Banknote, tab: "admin", adminSection: "add-deposit" },
      { label: "Set Fixed Bills", icon: ReceiptText, tab: "admin", adminSection: "fixed-bills" },
      { label: "Add New Member", icon: UserPlus, tab: "admin", adminSection: "add-member" },
      { label: "All Members", icon: Users, tab: "admin", adminSection: "all-members" },
      { label: "Activity Log", icon: ClipboardList, tab: "admin", adminSection: "activity-log" },
    ],
  },
];

function isItemActive(
  item: NavigationItem,
  activeTab: DashboardTab,
  activeSection: DashboardLogSection | null,
  activeAdminSection: AdminSection | null
) {
  if (item.tab !== activeTab) return false;
  if (item.adminSection) return item.adminSection === activeAdminSection;
  if (item.section) {
    return item.section === activeSection || (item.section === "bazar" && activeSection === null);
  }
  return item.tab === "logs" ? !activeSection : true;
}

export function Sidebar({
  activeTab,
  activeSection,
  activeAdminSection,
  isAdmin,
  expanded,
  mobileOpen,
  onToggleExpanded,
  onCloseMobile,
  onNavigate,
}: SidebarProps) {
  const reduceMotion = useReducedMotion();
  const [openGroupOverride, setOpenGroupOverride] = useState<{
    routeKey: string;
    group: string;
  } | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  const routeKey = `${activeTab}:${activeSection ?? ""}:${activeAdminSection ?? ""}`;
  const activeGroup = navigationGroups.find((group) =>
    group.items.some((item) => isItemActive(item, activeTab, activeSection, activeAdminSection))
  )?.label;
  const openGroup = openGroupOverride?.routeKey === routeKey
    ? openGroupOverride.group
    : activeGroup ?? "Dashboard";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) onCloseMobile();
    };

    mediaQuery.addEventListener("change", closeOnDesktop);
    return () => mediaQuery.removeEventListener("change", closeOnDesktop);
  }, [onCloseMobile]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("button")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseMobile();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [mobileOpen, onCloseMobile]);

  function navigate(item: NavigationItem) {
    onNavigate({
      tab: item.tab,
      section: item.section,
      adminSection: item.adminSection,
    });
    onCloseMobile();
  }

  function renderNavigation(isMobile: boolean) {
    const canShowLabels = isMobile || expanded;

    return (
      <>
        <nav aria-label="Dashboard navigation" className="sidebar-navigation min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {navigationGroups
            .filter((group) => !group.adminOnly || isAdmin)
            .map((group) => {
              const GroupIcon = group.icon;
              const groupIsOpen = openGroup === group.label;
              const groupIsActive = group.items.some((item) =>
                isItemActive(item, activeTab, activeSection, activeAdminSection)
              );
              const contentId = `sidebar-group-${isMobile ? "mobile-" : ""}${group.label
                .toLowerCase()
                .replaceAll(" ", "-")}`;

              return (
                <div key={group.label}>
                  <button
                    type="button"
                    title={canShowLabels ? undefined : group.label}
                    aria-label={group.label}
                    aria-expanded={canShowLabels && groupIsOpen}
                    aria-controls={canShowLabels ? contentId : undefined}
                    onClick={() => {
                      if (!canShowLabels) {
                        onToggleExpanded();
                        setOpenGroupOverride({ routeKey, group: group.label });
                      } else {
                        setOpenGroupOverride({
                          routeKey,
                          group: groupIsOpen ? "" : group.label,
                        });
                      }
                    }}
                    className={`group relative isolate flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors duration-150 ease-out ${
                      groupIsActive
                        ? "text-brand"
                        : "text-secondary hover:bg-container/80 dark:text-secondary dark:hover:bg-elevated/80"
                    } ${canShowLabels ? "" : "justify-center px-0"}`}
                  >
                    {groupIsActive ? (
                      <motion.span
                        layoutId={`sidebar-group-active-${isMobile ? "mobile" : "desktop"}`}
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                        className="pointer-events-none absolute inset-0 rounded-xl bg-success-surface"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        groupIsActive
                          ? "text-brand"
                          : "text-muted dark:text-muted"
                      }`}
                    >
                      <GroupIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    {canShowLabels ? (
                      <>
                        <span className="relative z-10 min-w-0 flex-1">{group.label}</span>
                        <ChevronDown
                          className={`relative z-10 h-4 w-4 shrink-0 transition-transform duration-150 ease-out ${
                            groupIsOpen ? "rotate-180" : ""
                          }`}
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </>
                    ) : null}
                  </button>

                  {canShowLabels && groupIsOpen ? (
                    <div id={contentId} className="mt-1">
                      <div className="ml-6 space-y-0.5 border-l border-subtle/70 pl-3 dark:border-subtle/70">
                        {group.items
                          .filter((item) => !item.adminOnly || isAdmin)
                          .map((item) => {
                              const ItemIcon = item.icon;
                              const active = isItemActive(
                                item,
                                activeTab,
                                activeSection,
                                activeAdminSection
                              );
                              return (
                                <button
                                  key={item.label}
                                  type="button"
                                  onClick={() => navigate(item)}
                                  aria-current={active ? "page" : undefined}
                                  className={`relative isolate flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium leading-4 transition-colors duration-150 ${
                                    active
                                      ? "text-brand"
                                      : "text-secondary hover:bg-container/70 hover:text-primary dark:hover:bg-elevated/60"
                                  }`}
                                >
                                  {active ? (
                                    <motion.span
                                      layoutId={`sidebar-item-active-${isMobile ? "mobile" : "desktop"}`}
                                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                                      className="pointer-events-none absolute inset-0 rounded-md bg-success-surface"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  <ItemIcon className="relative z-10 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                                  <span className="relative z-10 min-w-0 flex-1 whitespace-normal">{item.label}</span>
                                  {active ? (
                                    <span className="relative z-10 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                                  ) : null}
                                </button>
                              );
                          })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
        </nav>
      </>
    );
  }

  return (
    <>
      <aside
        aria-label="Primary navigation"
        className={`sidebar-shell fixed inset-y-0 left-0 z-50 hidden flex-col overflow-visible border-r border-subtle/80 bg-surface/80 pt-2 backdrop-blur-xl transition-[width] duration-150 ease-out transform-gpu motion-reduce:transition-none dark:border-subtle dark:bg-surface/80 md:flex ${
          expanded ? "w-64" : "w-[72px]"
        }`}
      >
        <div className={`flex h-12 shrink-0 items-center ${expanded ? "justify-start px-3" : "justify-center px-0"}`}>
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? "Close sidebar" : "Open sidebar"}
            className={`group relative flex h-9 shrink-0 items-center rounded-lg text-secondary transition-colors duration-150 hover:bg-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              expanded ? "w-full justify-start gap-2 px-1" : "w-9 justify-center"
            }`}
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <Image
                src="/logo-512.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl object-cover transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0"
              />
              {expanded ? (
                <PanelLeftClose
                  className="absolute h-4 w-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              ) : (
                <PanelLeftOpen
                  className="absolute h-4 w-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              )}
            </span>
            {expanded ? (
              <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-primary">
                Mess App
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-subtle bg-surface/95 px-2.5 py-1.5 text-xs font-medium text-primary opacity-0 shadow-lg shadow-slate-900/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {expanded ? "Close sidebar" : "Open sidebar"}
            </span>
          </button>
        </div>
        {renderNavigation(false)}
      </aside>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-[60] md:hidden"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          >
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45 backdrop-blur-sm"
              aria-label="Close navigation menu"
              onClick={onCloseMobile}
            />
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard navigation"
              className="sidebar-shell absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] transform-gpu flex-col border-r border-subtle/80 bg-surface/95 pt-3 shadow-2xl backdrop-blur-xl will-change-transform dark:border-subtle dark:bg-surface/95"
              initial={reduceMotion ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 300, damping: 28 }
              }
            >
              <div className="flex h-12 shrink-0 items-center gap-2 px-4">
                <Image
                  src="/logo-512.png"
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-xl object-cover"
                />
                <span className="min-w-0 flex-1 text-sm font-semibold text-primary">
                  Mess App
                </span>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Close navigation menu"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-container dark:text-secondary dark:hover:bg-elevated"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
              {renderNavigation(true)}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
