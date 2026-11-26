"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AccessDeniedScreen } from "@/components/AccessDeniedScreen";
import {
  Loader2,
  Utensils,
  Calculator,
  CircleCheck,
} from "lucide-react";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const {
    user,
    loading,
    sessionLoading,
    sessionError,
    accessLoading,
    hasAccess,
    accessDeniedReason,
    logout,
    retrySessionSync,
    signInWithGoogle,
  } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !sessionLoading && !sessionError && !accessLoading && user && hasAccess) {
      router.replace("/dashboard");
    }
  }, [user, loading, sessionLoading, sessionError, accessLoading, hasAccess, router]);

  async function handleSignIn() {
    setSigningIn(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setSigningIn(false);
    }
  }

  if (loading || sessionLoading || accessLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (user && hasAccess && sessionError) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center px-4">
        <section className="clay-card w-full max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold">Secure session unavailable</h1>
          <p className="mt-2 text-sm text-secondary dark:text-muted">{sessionError}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={retrySessionSync}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-subtle px-4 py-2 text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (user && !hasAccess) {
    return (
      <div className="min-h-screen">
        <AccessDeniedScreen
          email={user.email}
          reason={accessDeniedReason ?? "inactive"}
          onLogout={logout}
        />
      </div>
    );
  }

  return (
    <div
      className="login-ambient relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
    >
      <main className="relative z-10 w-full max-w-md sm:max-w-lg">
        <div className="clay-card p-5 sm:p-10">
          <div className="mb-7 flex justify-center">
            <span className="clay-pill inline-flex items-center gap-2 border border-subtle bg-surface px-3 py-1.5 text-[11px] font-semibold tracking-wide text-brand-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_0_3px_rgba(223,108,67,0.14)]" />
              Mess Management &amp; Smart Split
            </span>
          </div>
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-container shadow-lg shadow-brand/20">
              <Image
                src="/logo-512.png"
                alt="Mess Logo"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Mess App
            </h1>
            <p className="mt-2 text-sm text-secondary sm:text-base">
              Track meals, bazar costs &amp; balances — all in one place
            </p>
          </div>

          <div className="mb-7 flex flex-wrap justify-center gap-2">
            <div className="clay-pill inline-flex items-center gap-2 border border-subtle bg-kpi-sage px-3 py-2 text-xs font-semibold text-brand-secondary sm:text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/80 text-brand-secondary">
                <Utensils className="h-4 w-4" />
              </span>
              <span>Live Meal Sheet</span>
            </div>
            <div className="clay-pill inline-flex items-center gap-2 border border-subtle bg-kpi-sand px-3 py-2 text-xs font-semibold text-secondary sm:text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/80 text-brand">
                <Calculator className="h-4 w-4" />
              </span>
              <span>Auto Rate &amp; Bazar</span>
            </div>
            <div className="clay-pill inline-flex items-center gap-2 border border-subtle bg-kpi-blush px-3 py-2 text-xs font-semibold text-secondary sm:text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/80 text-brand">
                <CircleCheck className="h-4 w-4" />
              </span>
              <span>Instant Settlement</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger-on-surface">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-brand/40 bg-surface text-base font-semibold text-primary shadow-[0_8px_24px_-10px_rgba(223,108,67,0.32)] transition-all duration-150 hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_12px_28px_-10px_rgba(223,108,67,0.42)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {signingIn ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                Sign in with Google
              </>
            )}
          </button>

          <p className="mt-6 text-center text-xs text-secondary">
            6 members · 3 meals daily · Real-time balance tracking
          </p>
        </div>
      </main>
    </div>
  );
}
