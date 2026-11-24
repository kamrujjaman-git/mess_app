"use client";

import { memo, useMemo } from "react";
import { Download } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import type { MemberSummary } from "@/lib/mess";
import { buildWhatsAppLink, formatCurrency, formatMonthLabel } from "@/lib/mess";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

interface SummaryTableProps {
  members: MemberSummary[];
  monthKey?: string;
  isAdmin?: boolean;
}

function BalanceBadge({ amount }: { amount: number }) {
  if (amount === 0) {
    return (
      <span className="summary-balance-badge summary-balance-settled inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        ৳0.00 SETTLED
      </span>
    );
  }
  if (amount > 0) {
    return (
      <span className="summary-balance-badge summary-balance-refund inline-flex max-w-full items-center rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-semibold tabular-nums text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
        +৳{formatCurrency(amount)} REFUND
      </span>
    );
  }
  return (
    <span className="summary-balance-badge summary-balance-due inline-flex max-w-full items-center rounded-full border border-rose-200/60 bg-rose-50 px-3 py-1 text-xs font-semibold tabular-nums text-rose-600 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-400">
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

export const SummaryTable = memo(function SummaryTable({
  members,
  monthKey,
  isAdmin = false,
}: SummaryTableProps) {
  const visibleMembers = useMemo(
    () => isAdmin ? members : members.filter((member) => member.status === "active"),
    [isAdmin, members]
  );

  function renderMemberRow(member: MemberSummary) {
    const inactive = member.status !== "active";
    const cellClass = inactive
      ? "border-b border-slate-200/80 bg-slate-50/70 px-6 py-4 text-slate-500 transition-colors group-hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400 dark:group-hover:bg-slate-900/50"
      : "border-b border-slate-100/80 px-6 py-4 transition-colors group-hover:bg-slate-50/80 dark:border-slate-800 dark:group-hover:bg-slate-800/50";

    return (
      <tr key={member.id} className={`group ${inactive ? "print:hidden" : ""}`}>
        <td className={`${cellClass} break-words font-medium`}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 break-words">{member.name}</span>
            {inactive && (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                INACTIVE
              </span>
            )}
            {isAdmin && member.whatsAppNumber && (
              <a
                href={buildWhatsAppLink({ name: member.name, whatsAppNumber: member.whatsAppNumber }, member.finalBalance)}
                target="_blank"
                rel="noreferrer"
                className="summary-chat-link inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                aria-label={`Open WhatsApp for ${member.name}`}
                title={`Open WhatsApp for ${member.name}`}
              >
                <WhatsAppActionIcon />
              </a>
            )}
          </div>
        </td>
        <td className={`${cellClass} tabular-nums`}>{member.totalMeals}</td>
        <td className={`${cellClass} tabular-nums`}>৳{formatCurrency(member.totalDeposited)}</td>
        <td className={`${cellClass} tabular-nums`}>৳{formatCurrency(member.mealCost)}</td>
        <td className={`${cellClass} text-right`}>
          <BalanceBadge amount={member.finalBalance} />
        </td>
      </tr>
    );
  }

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

      <DashboardSectionHeader
        title="Summary Table"
        description={`Member meals, deposits, costs, and final balances for ${reportMonthLabel}.`}
        className="summary-report-heading border-b border-slate-200/60 py-3 dark:border-slate-700/60"
        action={
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="summary-print-button print:hidden inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:bg-emerald-800"
          >
            <Download className="h-4 w-4" />
            Print / Save as PDF
          </button>
        }
      />

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
          <tbody>{visibleMembers.map(renderMemberRow)}</tbody>
        </table>
      </div>

      <div className="summary-mobile-cards relative space-y-3 pt-4 md:hidden">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-slate-100/80 to-transparent dark:from-slate-900/70" />
        {visibleMembers.map((member) => {
          const inactive = member.status !== "active";
          return (
            <div
              key={member.id}
              className={`rounded-xl border p-4 transition-colors ${
                inactive
                  ? "border-slate-200 bg-slate-100/70 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400 dark:hover:bg-slate-900/50"
                  : "border-slate-200/60 bg-white/50 hover:bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words font-semibold">{member.name}</span>
                <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
                  {inactive && (
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      INACTIVE
                    </span>
                  )}
                  {isAdmin && member.whatsAppNumber && (
                    <a
                      href={buildWhatsAppLink({ name: member.name, whatsAppNumber: member.whatsAppNumber }, member.finalBalance)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                      aria-label={`Open WhatsApp for ${member.name}`}
                      title={`Open WhatsApp for ${member.name}`}
                    >
                      <WhatsAppActionIcon />
                    </a>
                  )}
                  <BalanceBadge amount={member.finalBalance} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Meals</span>
                  <p className="font-medium tabular-nums">{member.totalMeals}</p>
                </div>
                <div>
                  <span className="text-slate-500">Deposited</span>
                  <p className="truncate font-medium tabular-nums">৳{formatCurrency(member.totalDeposited)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Meal Cost</span>
                  <p className="truncate font-medium tabular-nums">৳{formatCurrency(member.mealCost)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
