"use client";

import { ShieldX, LogOut } from "lucide-react";

interface AccessDeniedScreenProps {
  email?: string | null;
  reason?: "inactive" | "not-member" | "removed";
  onLogout: () => void;
}

export function AccessDeniedScreen({
  email,
  reason = "not-member",
  onLogout,
}: AccessDeniedScreenProps) {
  const message =
    reason === "inactive"
      ? "Your account has been deactivated by the admin. Please contact the mess manager."
      : reason === "removed"
        ? "Access Denied: Account Removed"
        : "You are not a member of this mess.";

  const details =
    reason === "inactive"
      ? "Your account has been deactivated by the admin. Please contact the mess manager."
      : reason === "removed"
        ? "Your access has been revoked. Contact your mess admin for help."
        : "Contact your mess admin to register your email as a member.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="clay-card w-full max-w-md p-8 text-center sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-surface">
          <ShieldX className="h-8 w-8 text-danger" />
        </div>
        <h1 className="text-xl font-bold text-primary sm:text-2xl">
          Access Denied
        </h1>
        <p className="mt-3 text-sm text-secondary dark:text-muted sm:text-base">
          {message}
        </p>
        {email && (
          <p className="mt-2 truncate text-xs text-muted dark:text-muted">
            Signed in as {email}
          </p>
        )}
        <p className="mt-4 text-xs text-muted dark:text-muted">
          {details}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="clay-pill mt-6 flex h-12 w-full items-center justify-center gap-2 bg-brand text-sm font-semibold text-brand-on-fill transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
