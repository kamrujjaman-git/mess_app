"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  Sun,
  Moon,
} from "lucide-react";
import { formatMonthLabel } from "@/lib/mess";
import type { User } from "firebase/auth";

interface DashboardNavProps {
  monthKey: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  user: User;
  isAdmin: boolean;
  memberName?: string | null;
  onLogout: () => void;
}

export function DashboardNav({
  monthKey,
  onPrevMonth,
  onNextMonth,
  user,
  isAdmin,
  memberName,
  onLogout,
}: DashboardNavProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = storedTheme ? storedTheme === "dark" : prefersDark;

    setIsDark(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    window.localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const roleLabel = isAdmin ? "Admin" : "Member";
  const displayName = useMemo(() => {
    return memberName?.trim() || user?.displayName?.trim() || "Member";
  }, [memberName, user]);

  const avatarInitial = displayName?.trim()?.charAt(0)?.toUpperCase() ?? "M";

  return (
    <header className="glass sticky top-0 z-50 border-b border-white/20 dark:border-slate-700/50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-10 sm:w-10">
            <Image
              src="/logo-512.png"
              alt="Mess Logo"
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
          <span className="hidden text-lg font-bold sm:inline">Mess App</span>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-white/60 px-1 py-1 dark:bg-slate-800/60 sm:gap-2 sm:px-2">
          <button
            type="button"
            onClick={onPrevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-semibold sm:min-w-[160px] sm:text-base">
            {formatMonthLabel(monthKey)}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-700 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <span className="hidden items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 sm:flex">
            <Shield className="h-3 w-3" />
            {roleLabel}
          </span>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {user?.photoURL && !imageFailed ? (
              <img
                src={user.photoURL}
                alt={displayName}
                onError={() => setImageFailed(true)}
                className="h-8 w-8 rounded-full object-cover ring-2 ring-emerald-500/30 sm:h-9 sm:w-9"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white ring-2 ring-emerald-500/30 sm:h-9 sm:w-9">
                {avatarInitial}
              </div>
            )}

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
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:h-10 sm:w-10"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex justify-center pb-2 sm:hidden">
        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Shield className="h-3 w-3" />
          {roleLabel}
        </span>
      </div>
    </header>
  );
}
