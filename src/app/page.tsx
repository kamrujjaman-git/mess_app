"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2,
  Sparkles,
  Shield,
  TrendingUp,
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
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

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

  if (loading || user) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <main className="relative z-10 w-full max-w-md sm:max-w-lg">
        <div className="glass-card rounded-3xl p-6 sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 shadow-lg shadow-emerald-500/25">
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
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              Track meals, bazar costs &amp; balances — all in one place
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl bg-white/50 p-3 dark:bg-slate-800/40">
              <Sparkles className="h-5 w-5 shrink-0 text-emerald-500" />
              <span className="text-xs font-medium sm:text-sm">Live Stats</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/50 p-3 dark:bg-slate-800/40">
              <TrendingUp className="h-5 w-5 shrink-0 text-teal-500" />
              <span className="text-xs font-medium sm:text-sm">Smart Calc</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/50 p-3 dark:bg-slate-800/40">
              <Shield className="h-5 w-5 shrink-0 text-cyan-500" />
              <span className="text-xs font-medium sm:text-sm">Secure Auth</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white text-base font-semibold text-slate-800 shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:shadow-slate-900/50"
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

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
            6 members · 3 meals daily · Real-time balance tracking
          </p>
        </div>
      </main>
    </div>
  );
}
