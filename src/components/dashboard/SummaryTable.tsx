"use client";

import { Download } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import type { MemberSummary } from "@/lib/mess";
import { buildWhatsAppLink, formatCurrency, formatMonthLabel } from "@/lib/mess";

interface SummaryTableProps {
  members: MemberSummary[];
  monthKey?: string;
  isAdmin?: boolean;
}

function BalanceBadge({ amount }: { amount: number }) {
  if (amount === 0) {
    return (
      <span className="summary-balance-badge summary-balance-settled inline-flex max-w-full items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        ৳0.00 SETTLED
      </span>
    );
  }
  if (amount > 0) {
    return (
      <span className="summary-balance-badge summary-balance-refund inline-flex max-w-full items-center rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
        +৳{formatCurrency(amount)} REFUND
      </span>
    );
  }
  return (
    <span className="summary-balance-badge summary-balance-due inline-flex max-w-full items-center rounded-full border border-rose-200/60 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-400">
      -৳{formatCurrency(Math.abs(amount))} DUE
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

export function SummaryTable({ members, monthKey, isAdmin = false }: SummaryTableProps) {
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
    <div
      id="summary-report"
      className="summary-report-sheet w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8"
    >
      <div className="summary-print-header hidden border-b border-slate-200/60 px-4 py-4 dark:border-slate-700/60 sm:px-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-512.png"
              alt="Mess App Logo"
              width={48}
              height={48}
              loading="eager"
              unoptimized
              className="summary-print-logo h-12 w-12 shrink-0 rounded-xl object-cover"
            />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Mess App
              </h2>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <p>Export Date: {exportDate}</p>
          </div>
        </div>
      </div>

      <div className="summary-report-heading flex flex-col gap-3 border-b border-slate-200/60 py-3 dark:border-slate-700/60 md:flex-row md:items-center md:justify-between">
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
          className="summary-print-button print:hidden inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:bg-emerald-800"
        >
          <Download className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      <div className="summary-print-table hidden overflow-x-auto overflow-y-hidden md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              <th className="px-6 py-4 font-medium">Member</th>
              <th className="px-6 py-4 font-medium">Meals</th>
              <th className="px-6 py-4 font-medium">Deposited</th>
              <th className="px-6 py-4 font-medium">Meal Cost</th>
              <th className="px-6 py-4 text-right font-medium">Final Balance</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className={`group ${m.status === "inactive" ? "opacity-60" : ""
                  }`}
              >
                <td className="break-words border-b border-slate-100/80 px-6 py-4 font-medium transition-colors group-hover:bg-slate-50/80 dark:border-slate-800 dark:group-hover:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 break-words">{m.name}</span>
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
                <td className="border-b border-slate-100/80 px-6 py-4 transition-colors group-hover:bg-slate-50/80 dark:border-slate-800 dark:group-hover:bg-slate-800/50">
                  {m.totalMeals}
                </td>
                <td className="border-b border-slate-100/80 px-6 py-4 transition-colors group-hover:bg-slate-50/80 dark:border-slate-800 dark:group-hover:bg-slate-800/50">
                  ৳{formatCurrency(m.totalDeposited)}
                </td>
                <td className="border-b border-slate-100/80 px-6 py-4 transition-colors group-hover:bg-slate-50/80 dark:border-slate-800 dark:group-hover:bg-slate-800/50">
                  ৳{formatCurrency(m.mealCost)}
                </td>
                <td className="border-b border-slate-100/80 px-6 py-4 text-right transition-colors group-hover:bg-slate-50/80 dark:border-slate-800 dark:group-hover:bg-slate-800/50">
                  <BalanceBadge amount={m.finalBalance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="summary-mobile-cards relative space-y-3 pt-4 md:hidden">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-slate-100/80 to-transparent dark:from-slate-900/70" />
        {members.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border border-slate-200/60 bg-white/50 p-4 transition-colors hover:bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:bg-slate-800/50 ${m.status === "inactive" ? "opacity-60" : ""
              }`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words font-semibold">
                {m.name}
                {m.status === "inactive" && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    (Inactive)
                  </span>
                )}
              </span>
              <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
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
                <p className="truncate font-medium">৳{formatCurrency(m.totalDeposited)}</p>
              </div>
              <div>
                <span className="text-slate-500">Meal Cost</span>
                <p className="truncate font-medium">৳{formatCurrency(m.mealCost)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
