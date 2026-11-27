"use client";

import { memo, useMemo, useState } from "react";
import { Download } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";
import type { Member, MemberSummary } from "@/lib/mess";
import { buildWhatsAppLink, formatCurrency, formatMonthLabel } from "@/lib/mess";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

interface SummaryTableProps {
  members: MemberSummary[];
  memberProfiles: Pick<Member, "id" | "photoURL">[];
  monthKey?: string;
  isAdmin?: boolean;
}

function decodeImage(image: HTMLImageElement): Promise<void> {
  return Promise.resolve()
    .then(() => image.decode())
    .then(() => undefined, () => undefined);
}

function waitForImageDecode(image: HTMLImageElement): Promise<void> {
  if (image.complete) return decodeImage(image);

  return new Promise((resolve) => {
    const finish = () => {
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      void decodeImage(image).then(resolve);
    };
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });
}

async function waitForAvatarImages(report: HTMLElement): Promise<void> {
  const images = Array.from(
    report.querySelectorAll<HTMLImageElement>("img.summary-member-avatar")
  );
  let timeoutId: number | undefined;
  const timeout = new Promise<void>((resolve) => {
    timeoutId = window.setTimeout(resolve, 800);
  });

  await Promise.race([
    Promise.all(images.map(waitForImageDecode)).then(() => undefined),
    timeout,
  ]);
  if (timeoutId !== undefined) window.clearTimeout(timeoutId);
}

function BalanceBadge({ amount }: { amount: number }) {
  if (amount === 0) {
    return (
      <span className="summary-balance-badge summary-balance-settled inline-flex max-w-full items-center rounded-full border border-subtle bg-container px-3 py-1 text-xs font-semibold tabular-nums text-secondary">
        ৳0.00 SETTLED
      </span>
    );
  }
  if (amount > 0) {
    return (
      <span className="summary-balance-badge summary-balance-refund inline-flex max-w-full items-center rounded-full border border-brand-secondary/30 bg-kpi-sage px-3 py-1 text-xs font-semibold tabular-nums text-brand-secondary">
        +৳{formatCurrency(amount)} REFUND
      </span>
    );
  }
  return (
    <span className="summary-balance-badge summary-balance-due inline-flex max-w-full items-center rounded-full border border-danger-border bg-danger-surface px-3 py-1 text-xs font-semibold tabular-nums text-danger-on-surface">
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
  memberProfiles,
  monthKey,
  isAdmin = false,
}: SummaryTableProps) {
  const photoURLById = useMemo(
    () => new Map(memberProfiles.map((member) => [member.id, member.photoURL])),
    [memberProfiles]
  );
  const [failedPhotoKeys, setFailedPhotoKeys] = useState<Set<string>>(() => new Set());
  const visibleMembers = useMemo(
    () => isAdmin ? members : members.filter((member) => member.status === "active"),
    [isAdmin, members]
  );
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  function renderMemberIdentity(member: MemberSummary) {
    const photoURL = photoURLById.get(member.id);
    const photoKey = `${member.id}\u0000${photoURL ?? ""}`;
    const inactive = member.status !== "active";
    return (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {photoURL && !failedPhotoKeys.has(photoKey) ? (
          <Image
            src={photoURL}
            alt=""
            width={24}
            height={24}
            loading="eager"
            decoding="async"
            unoptimized
            referrerPolicy="no-referrer"
            onError={() => {
              setFailedPhotoKeys((failed) => {
                if (failed.has(photoKey)) return failed;
                const next = new Set(failed);
                next.add(photoKey);
                return next;
              });
            }}
            className={`summary-member-avatar h-6 w-6 shrink-0 rounded-full object-cover ${inactive ? "grayscale opacity-60" : ""}`}
          />
        ) : (
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-container text-[10px] font-semibold text-secondary dark:bg-container dark:text-secondary ${inactive ? "grayscale opacity-60" : ""}`}>
            {(member.name.trim().charAt(0) || "M").toUpperCase()}
          </span>
        )}
        <span className={`min-w-0 flex-1 truncate ${inactive ? "text-muted line-through decoration-border-strong" : ""}`} title={member.name}>{member.name}</span>
      </span>
    );
  }

  function renderMemberRow(member: MemberSummary) {
    const inactive = member.status !== "active";
    const cellClass = inactive
      ? "border-b border-subtle/80 bg-elevated/80 px-6 py-4 text-muted transition-colors group-hover:bg-elevated dark:bg-elevated/60 dark:text-muted dark:group-hover:bg-elevated/80"
      : "border-b border-subtle/80 px-6 py-4 transition-colors group-hover:bg-elevated/80 dark:border-subtle dark:group-hover:bg-elevated/50";

    return (
      <tr key={member.id} className={`group ${inactive ? "border-l-4 border-l-amber-400/80 bg-elevated/70 dark:bg-elevated/50 print:hidden" : ""}`}>
        <td className={`${cellClass} break-words font-medium ${inactive ? "border-l-4 border-l-amber-400/80" : ""}`}>
          <div className="flex items-center gap-2">
            {renderMemberIdentity(member)}
            {inactive && (
              <span className="rounded-full border border-amber-300/80 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:border-amber-700/80 dark:bg-amber-950 dark:text-amber-200">
                INACTIVE
              </span>
            )}
            {isAdmin && member.whatsAppNumber && (
              <a
                href={buildWhatsAppLink({ name: member.name, whatsAppNumber: member.whatsAppNumber }, member.finalBalance)}
                target="_blank"
                rel="noreferrer"
                className="summary-chat-link inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-secondary/30 bg-kpi-sage text-brand-secondary transition hover:bg-kpi-sage/80"
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

  async function handleDownloadPdf() {
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
      await waitForAvatarImages(summaryReport);
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
      className="summary-responsive-container summary-report-sheet clay-card w-full overflow-hidden p-4 sm:p-8"
    >
      <div className="summary-print-header hidden border-b border-subtle/60 px-4 py-4 dark:border-subtle/60 sm:px-6">
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
              <h2 className="text-balance text-xl font-bold text-primary">
                Mess App
              </h2>
            </div>
          </div>
          <div className="text-right text-xs text-muted dark:text-muted">
            <p>Export Date: {exportDate}</p>
          </div>
        </div>
      </div>

      <DashboardSectionHeader
        title="Summary Table"
        description={`Member meals, deposits, costs, and final balances for ${reportMonthLabel}.`}
        className="summary-report-heading border-b border-subtle/60 py-3 dark:border-subtle/60"
        action={
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="summary-print-button clay-pill print:hidden inline-flex items-center justify-center gap-2 bg-brand px-4 py-2 text-sm font-semibold text-brand-on-fill transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Download className="h-4 w-4" />
            Print / Save as PDF
          </button>
        }
      />

      <div className="summary-print-table summary-desktop-table overflow-x-auto overflow-y-hidden">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-subtle/60 bg-elevated/80 text-left text-xs uppercase tracking-wide text-muted dark:border-subtle/60 dark:text-muted">
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

      <div className="summary-mobile-cards space-y-2 pt-4">
        {visibleMembers.map((member) => {
          const inactive = member.status !== "active";
          const expanded = expandedMemberId === member.id;
          const detailsId = `summary-member-details-${member.id}`;
          return (
            <div
              key={member.id}
              className={`summary-mobile-member rounded-xl border p-3 transition-colors ${
                inactive
                  ? "border-l-4 border-l-amber-400/80 border-y-subtle border-r-subtle bg-elevated/80 text-muted dark:border-subtle dark:bg-elevated/50 dark:text-muted"
                  : "border-subtle/60 bg-surface/50 hover:bg-elevated/80 dark:border-subtle/60 dark:bg-elevated/40 dark:hover:bg-elevated/50"
              }`}
            >
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={expanded ? detailsId : undefined}
                onClick={() => setExpandedMemberId(expanded ? null : member.id)}
                className="summary-mobile-row-toggle flex min-h-[72px] w-full items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="flex min-w-0 w-full items-center font-semibold">
                    {renderMemberIdentity(member)}
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="tabular-nums text-secondary">Meals: {member.totalMeals}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      inactive
                        ? "bg-container text-secondary"
                        : "bg-kpi-sage text-brand-secondary"
                    }`}>
                      {inactive ? "Inactive" : "Active"}
                    </span>
                  </span>
                </span>
                <span className="flex w-36 shrink-0 justify-end text-right">
                  <BalanceBadge amount={member.finalBalance} />
                </span>
              </button>
              {expanded ? (
                <div id={detailsId} className="row-detail-reveal mt-3 border-t border-subtle/70 pt-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted">Total meals</dt>
                      <dd className="font-medium tabular-nums">{member.totalMeals}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Deposited</dt>
                      <dd className="font-medium tabular-nums">৳{formatCurrency(member.totalDeposited)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Meal cost</dt>
                      <dd className="font-medium tabular-nums">৳{formatCurrency(member.mealCost)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Fixed-cost share</dt>
                      <dd className="font-medium tabular-nums">৳{formatCurrency(member.fixedCostShare)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Meal balance</dt>
                      <dd className="font-medium tabular-nums">৳{formatCurrency(member.mealBalance)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Final balance</dt>
                      <dd className="font-medium tabular-nums"><BalanceBadge amount={member.finalBalance} /></dd>
                    </div>
                  </dl>
                  {isAdmin && member.whatsAppNumber && (
                    <a
                      href={buildWhatsAppLink({ name: member.name, whatsAppNumber: member.whatsAppNumber }, member.finalBalance)}
                      target="_blank"
                      rel="noreferrer"
                      className="clay-pill mt-3 inline-flex h-9 items-center gap-2 border border-brand-secondary/30 bg-kpi-sage px-3 text-sm font-medium text-brand-secondary transition hover:bg-kpi-sage/80"
                      aria-label={`Open WhatsApp for ${member.name}`}
                    >
                      <WhatsAppActionIcon />
                      Contact member
                    </a>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
});
