"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  calculateMessStats,
  formatCurrency,
  formatMonthLabel,
  getPreviousMonthKey,
  previewCarryForwardBalances,
  type CarryForwardBalance,
  type Member,
} from "@/lib/mess";
import {
  applyCarryForwardBalances,
  getBazarEntries,
  getCarryForwardDepositId,
  getDailyMeals,
  getDepositEntries,
  getMonthBills,
} from "@/lib/firestore";

interface CarryForwardModalProps {
  targetMonthKey: string;
  members: Member[];
  onClose: () => void;
}

function getAppliedMemberIds(
  balances: CarryForwardBalance[],
  deposits: Awaited<ReturnType<typeof getDepositEntries>>,
  sourceMonthKey: string
): Set<string> {
  return new Set(
    balances
      .filter((balance) =>
        deposits.some((deposit) =>
          deposit.id === getCarryForwardDepositId(sourceMonthKey, balance.memberId) ||
          (
            deposit.carryForwardFrom === sourceMonthKey &&
            deposit.memberId === balance.memberId
          )
        )
      )
      .map((balance) => balance.memberId)
  );
}

export function CarryForwardModal({
  targetMonthKey,
  members,
  onClose,
}: CarryForwardModalProps) {
  const sourceMonthKey = getPreviousMonthKey(targetMonthKey);
  const [balances, setBalances] = useState<CarryForwardBalance[]>([]);
  const [appliedMemberIds, setAppliedMemberIds] = useState<Set<string>>(new Set());
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [applyErrorMessage, setApplyErrorMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const submissionInFlight = useRef(false);

  const loadPreview = useCallback(async (isCurrent: () => boolean) => {
    try {
      const [
        dailyMeals,
        bazar,
        sourceDeposits,
        bills,
        targetDeposits,
      ] = await Promise.all([
        getDailyMeals(sourceMonthKey),
        getBazarEntries(sourceMonthKey),
        getDepositEntries(sourceMonthKey),
        getMonthBills(sourceMonthKey),
        getDepositEntries(targetMonthKey),
      ]);
      if (!isCurrent()) return;

      const stats = calculateMessStats(
        dailyMeals,
        bazar,
        sourceDeposits,
        bills,
        members
      );
      const nextBalances = previewCarryForwardBalances(stats.members);
      const nextAppliedMemberIds = getAppliedMemberIds(
        nextBalances,
        targetDeposits,
        sourceMonthKey
      );

      setBalances(nextBalances);
      setAppliedMemberIds(nextAppliedMemberIds);
      setSelectedMemberIds(
        new Set(
          nextBalances
            .filter((balance) => !nextAppliedMemberIds.has(balance.memberId))
            .map((balance) => balance.memberId)
        )
      );
    } catch (error) {
      console.error("Load carry-forward preview failed:", error);
      if (isCurrent()) {
        setLoadErrorMessage("Could not load the previous month's balance data. Try again.");
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [members, sourceMonthKey, targetMonthKey]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => loadPreview(() => active));
    return () => {
      active = false;
    };
  }, [loadAttempt, loadPreview]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  const toggleMember = useCallback((memberId: string) => {
    setSelectedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  async function refreshAppliedStatus(): Promise<void> {
    try {
      const targetDeposits = await getDepositEntries(targetMonthKey);
      const nextAppliedMemberIds = getAppliedMemberIds(
        balances,
        targetDeposits,
        sourceMonthKey
      );
      setAppliedMemberIds(nextAppliedMemberIds);
      setSelectedMemberIds((current) =>
        new Set([...current].filter((memberId) => !nextAppliedMemberIds.has(memberId)))
      );
    } catch (error) {
      console.error("Refresh carry-forward status failed:", error);
      setApplyErrorMessage(
        "The write status could not be refreshed. Close and reopen the preview before retrying."
      );
    }
  }

  async function handleApply(): Promise<void> {
    if (submissionInFlight.current || selectedMemberIds.size === 0) return;
    submissionInFlight.current = true;
    setSubmitting(true);
    setApplyErrorMessage("");

    const selectedBalances = balances.filter((balance) =>
      selectedMemberIds.has(balance.memberId)
    );

    try {
      const createdBalances = await applyCarryForwardBalances(
        sourceMonthKey,
        targetMonthKey,
        selectedBalances
      );
      setAppliedMemberIds((current) =>
        new Set([...current, ...selectedBalances.map((balance) => balance.memberId)])
      );
      setSelectedMemberIds((current) =>
        new Set([...current].filter((memberId) => !selectedMemberIds.has(memberId)))
      );

      if (createdBalances.length > 0) {
        const credits = createdBalances
          .filter((balance) => balance.amount > 0)
          .reduce((sum, balance) => sum + balance.amount, 0);
        const dues = createdBalances
          .filter((balance) => balance.amount < 0)
          .reduce((sum, balance) => sum + Math.abs(balance.amount), 0);
        toast.success(
          `Carried forward ${createdBalances.length} balance(s): Credit ৳${formatCurrency(credits)}, Due ৳${formatCurrency(dues)}.`
        );
      } else {
        toast.success("The selected balances were already carried forward.");
      }
    } catch (error) {
      console.error("Apply carry-forward balances failed:", error);
      setApplyErrorMessage(
        "Carry-forward did not finish. Completed entries are preserved; refresh status and retry the remaining members."
      );
      toast.error("Could not complete the carry-forward.");
      await refreshAppliedStatus();
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  const allApplied = balances.length > 0 &&
    balances.every((balance) => appliedMemberIds.has(balance.memberId));
  const selectedCount = selectedMemberIds.size;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#141210]/70 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="carry-forward-title"
        className="clay-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 text-primary sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="carry-forward-title" className="text-xl font-bold sm:text-2xl">
              Carry Forward Balance
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-secondary">
              <span>{formatMonthLabel(sourceMonthKey)}</span>
              <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
              <span>{formatMonthLabel(targetMonthKey)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close carry-forward preview"
            className="tactile-press rounded-full p-2 text-secondary transition hover:bg-container disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-secondary">
            <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden="true" />
            Loading previous-month balances...
          </div>
        ) : loadErrorMessage ? (
          <div className="rounded-2xl border border-danger-border bg-danger-surface p-4 text-sm text-danger-on-surface">
            <p>{loadErrorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setLoadErrorMessage("");
                setLoadAttempt((attempt) => attempt + 1);
              }}
              className="tactile-press mt-3 inline-flex items-center gap-2 rounded-xl border border-danger-border px-3 py-2 font-semibold"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry preview
            </button>
          </div>
        ) : balances.length === 0 ? (
          <div className="rounded-2xl border border-subtle bg-container/70 p-6 text-center">
            <p className="font-semibold">No balances to carry forward</p>
            <p className="mt-1 text-sm text-secondary">
              Active members have no non-zero closing balances for {formatMonthLabel(sourceMonthKey)}.
            </p>
          </div>
        ) : allApplied ? (
          <div className="rounded-2xl border border-brand-secondary/30 bg-kpi-sage p-6 text-center text-brand-secondary">
            <Check className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
            <p className="font-semibold">Already applied</p>
            <p className="mt-1 text-sm">
              All eligible balances from {formatMonthLabel(sourceMonthKey)} have already been carried forward.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-secondary">
              Review the closing balances. Uncheck anyone who has settled in cash.
            </p>
            {balances.map((balance) => {
              const isApplied = appliedMemberIds.has(balance.memberId);
              const isSelected = selectedMemberIds.has(balance.memberId);
              const isCredit = balance.kind === "credit";

              return (
                <label
                  key={balance.memberId}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition sm:p-4 ${
                    isApplied
                      ? "cursor-not-allowed border-subtle bg-container/50 opacity-70"
                      : isSelected
                        ? "border-brand bg-kpi-terracotta/40"
                        : "border-subtle bg-surface hover:bg-container/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isApplied || submitting}
                    onChange={() => toggleMember(balance.memberId)}
                    className="h-4 w-4 shrink-0 accent-brand"
                    aria-label={`Carry forward ${balance.memberName}'s balance`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {balance.memberName}
                    </span>
                    {isApplied ? (
                      <span className="mt-0.5 block text-[10px] font-medium text-muted sm:text-xs">
                        Already carried
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold tabular-nums sm:text-sm ${
                      isCredit
                        ? "bg-kpi-sage text-brand-secondary"
                        : "bg-danger-surface text-danger-on-surface"
                    }`}
                  >
                    {isCredit ? "+" : "-"}৳{formatCurrency(Math.abs(balance.amount))}{" "}
                    {isCredit ? "Credit" : "Due"}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {applyErrorMessage ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger-border bg-danger-surface px-4 py-3 text-sm text-danger-on-surface"
          >
            {applyErrorMessage}
          </div>
        ) : null}

        {!loading && !loadErrorMessage && balances.length > 0 && !allApplied ? (
          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              {appliedMemberIds.size} already applied · {selectedCount} selected
            </p>
            <button
              type="button"
              onClick={handleApply}
              disabled={submitting || selectedCount === 0}
              className="clay-pill tactile-press inline-flex min-h-11 items-center justify-center gap-2 bg-brand px-5 py-2.5 text-sm font-semibold text-brand-on-fill transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {submitting
                ? "Applying..."
                : `Apply ${selectedCount} selected balance${selectedCount === 1 ? "" : "s"}`}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
