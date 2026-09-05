"use client";

import { Download } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import type { MemberSummary, MessStats } from "@/lib/mess";
import { buildWhatsAppLink, formatMonthLabel } from "@/lib/mess";

interface SummaryTableProps {
  members: MemberSummary[];
  stats?: MessStats;
  monthKey?: string;
  isAdmin?: boolean;
}

function BalanceBadge({ amount }: { amount: number }) {
  if (amount === 0) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.75 py-1 text-[11px] font-semibold tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        ৳0 SETTLED
      </span>
    );
  }
  if (amount > 0) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.75 py-1 text-[11px] font-semibold tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        +৳{amount.toLocaleString()} REFUND
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-rose-100 px-2.75 py-1 text-[11px] font-semibold tracking-wide text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
      -৳{Math.abs(amount).toLocaleString()} DUE
    </span>
  );
}

function WhatsAppActionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="M12 3.2a8.8 8.8 0 0 0-7.4 13.7l-1 3.1 3.2-1A8.8 8.8 0 1 0 12 3.2Z"
        fill="currentColor"
      />
      <path
        d="M9 8.6h6M9 11.1h3.8"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SummaryTable({ members, stats, monthKey, isAdmin = false }: SummaryTableProps) {
  function handleDownloadPdf() {
    if (typeof window === "undefined") {
      return;
    }

    const summaryReport = document.getElementById("summary-report");
    if (!summaryReport) {
      const error = new Error("Summary report container is not ready.");
      console.error("PDF export failed:", error);
      toast.error("PDF export is unavailable right now. Please try again.");
      return;
    }

    try {
      window.print();
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("PDF download failed. Please check the browser console for details.");
    }
  }

  const exportDate = new Date().toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const reportMonthLabel = formatMonthLabel(monthKey);

  return (
    <div id="summary-report" className="summary-report-sheet glass-card overflow-hidden rounded-2xl">
      <div className="summary-print-header hidden border-b border-slate-200/60 px-4 py-4 dark:border-slate-700/60 sm:px-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Image
                src="/logo-512.png"
                alt="Mess App Logo"
                width={40}
                height={40}
                className="summary-print-logo h-full w-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Mess App
              </h2>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <p>{reportMonthLabel}</p>
            <p>Export Date: {exportDate}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">
            Summary &amp; Final Balance
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {reportMonthLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="summary-print-button inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <Download className="h-4 w-4" />
          Download PDF Summary
        </button>
      </div>

      <div className="summary-metrics print:mb-4 print:grid print:grid-cols-2 print:gap-3 print:border-b print:border-slate-200 print:px-4 print:py-4 hidden md:grid md:border-b md:border-slate-200/60 md:px-4 md:py-4 dark:md:border-slate-700/60">
        {stats && (
          <>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Meals</p>
              <p className="text-sm font-semibold">{stats.totalMeals}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Bazar</p>
              <p className="text-sm font-semibold">৳{stats.totalBazar}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">Meal Rate</p>
              <p className="text-sm font-semibold">৳{stats.mealRate}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
              <p className="text-xs text-slate-500 dark:text-slate-400">Meal Balance</p>
              <p className="text-sm font-semibold">৳{Math.abs(stats.remainingBalance).toLocaleString()}</p>
            </div>
          </>
        )}
      </div>

      <div className="summary-print-table hidden overflow-x-auto overflow-y-hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              <th className="px-4 py-3 font-medium sm:px-6">Member</th>
              <th className="px-4 py-3 font-medium">Meals</th>
              <th className="px-4 py-3 font-medium">Deposited</th>
              <th className="px-4 py-3 font-medium">Meal Cost</th>
              {isAdmin && <th className="px-4 py-3 font-medium">Rent Share</th>}
              <th className="px-4 py-3 font-medium">Final Balance</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${m.status === "inactive" ? "opacity-60" : ""
                  }`}
              >
                <td className="max-w-[180px] break-words px-4 py-3 font-medium sm:px-6">
                  <div className="flex items-center gap-2">
                    <span className="break-words">{m.name}</span>
                    {m.status === "inactive" && (
                      <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-700">
                        Inactive
                      </span>
                    )}
                    {isAdmin && m.whatsAppNumber && (
                      <a
                        href={buildWhatsAppLink({ name: m.name, whatsAppNumber: m.whatsAppNumber }, m.finalBalance)}
                        target="_blank"
                        rel="noreferrer"
                        className="summary-chat-link inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                        aria-label={`Open WhatsApp for ${m.name}`}
                        title={`Open WhatsApp for ${m.name}`}
                      >
                        <WhatsAppActionIcon />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{m.totalMeals}</td>
                <td className="px-4 py-3">৳{m.totalDeposited}</td>
                <td className="px-4 py-3">৳{m.mealCost}</td>
                {isAdmin && <td className="px-4 py-3">৳{m.fixedCostShare}</td>}
                <td className="px-4 py-3">
                  <BalanceBadge amount={m.finalBalance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="summary-mobile-cards relative space-y-3 p-4 md:hidden">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-slate-100/80 to-transparent dark:from-slate-900/70" />
        {members.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl bg-white/50 p-4 dark:bg-slate-800/40 ${m.status === "inactive" ? "opacity-60" : ""
              }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="break-words font-semibold">
                {m.name}
                {m.status === "inactive" && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    (Inactive)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {isAdmin && m.whatsAppNumber && (
                  <a
                    href={buildWhatsAppLink({ name: m.name, whatsAppNumber: m.whatsAppNumber }, m.finalBalance)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                    aria-label={`Open WhatsApp for ${m.name}`}
                    title={`Open WhatsApp for ${m.name}`}
                  >
                    <WhatsAppActionIcon />
                  </a>
                )}
                <BalanceBadge amount={m.finalBalance} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Meals</span>
                <p className="font-medium">{m.totalMeals}</p>
              </div>
              <div>
                <span className="text-slate-500">Deposited</span>
                <p className="font-medium">৳{m.totalDeposited}</p>
              </div>
              <div>
                <span className="text-slate-500">Meal Cost</span>
                <p className="font-medium">৳{m.mealCost}</p>
              </div>
              {isAdmin ? (
                <div>
                  <span className="text-slate-500">Rent Share</span>
                  <p className="font-medium">৳{m.fixedCostShare}</p>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
