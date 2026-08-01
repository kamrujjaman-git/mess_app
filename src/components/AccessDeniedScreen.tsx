"use client";

import { ShieldX, LogOut } from "lucide-react";

interface AccessDeniedScreenProps {
  email?: string | null;
  onLogout: () => void;
}

export function AccessDeniedScreen({ email, onLogout }: AccessDeniedScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="glass-card w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/40">
          <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
          Access Denied
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
          You are not a member of this mess.
        </p>
        {email && (
          <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-500">
            Signed in as {email}
          </p>
        )}
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
          Contact your mess admin to register your email as a member.
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 text-sm font-semibold text-white transition hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
