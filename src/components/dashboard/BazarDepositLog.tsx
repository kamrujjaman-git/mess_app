"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Save, X } from "lucide-react";
import type {
  BazarEntry,
  DepositEntry,
  MonthBills,
  Member,
  BillField,
} from "@/lib/mess";
import { BILL_LABELS, getBazarBuyerLabel, normalizeBazarBuyerIds } from "@/lib/mess";
import { getActiveMembers } from "@/lib/mess";
import { InlineActions, inputClass } from "./InlineActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";
import { SwipeableListItem } from "./SwipeableListItem";
import { Wallet2, ReceiptText } from "lucide-react";

interface BazarDepositLogProps {
  bazar: BazarEntry[];
  deposits: DepositEntry[];
  bills: MonthBills;
  members: Member[];
  isAdmin: boolean;
  onEditBazar?: (
    id: string,
    entry: Omit<BazarEntry, "id">
  ) => Promise<void>;
  onDeleteBazar?: (id: string) => void;
  onEditDeposit?: (
    id: string,
    entry: Omit<DepositEntry, "id">
  ) => Promise<void>;
  onDeleteDeposit?: (id: string) => void;
  onEditBill?: (field: BillField, value: number) => Promise<void>;
  onDeleteBill?: (field: BillField) => Promise<void>;
}

export function BazarDepositLog({
  bazar,
  deposits,
  bills,
  members,
  isAdmin,
  onEditBazar,
  onDeleteBazar,
  onEditDeposit,
  onDeleteDeposit,
  onEditBill,
  onDeleteBill,
}: BazarDepositLogProps) {
  const activeMembers = getActiveMembers(members);

  const [editingBazarId, setEditingBazarId] = useState<string | null>(null);
  const [bazarDate, setBazarDate] = useState("");
  const [bazarAmount, setBazarAmount] = useState("");
  const [bazarDesc, setBazarDesc] = useState("");
  const [bazarBuyerIds, setBazarBuyerIds] = useState<string[]>([]);

  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [depositMemberId, setDepositMemberId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [depositNote, setDepositNote] = useState("");

  const [editingBillField, setEditingBillField] = useState<BillField | null>(
    null
  );
  const [billValue, setBillValue] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  function startEditBazar(entry: BazarEntry) {
    setEditingBazarId(entry.id);
    setBazarDate(entry.date);
    setBazarAmount(String(entry.amount));
    setBazarDesc(entry.description);
    setBazarBuyerIds(normalizeBazarBuyerIds(entry));
  }

  function toggleBazarBuyerSelection(memberId: string) {
    setBazarBuyerIds((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : [...previous, memberId]
    );
  }

  const buyerNames = (entry: BazarEntry) => getBazarBuyerLabel(entry, members);

  async function saveBazar(id: string) {
    if (!onEditBazar) return;
    const amount = Math.round(parseFloat(bazarAmount));
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid bazar amount.");
      return;
    }
    if (bazarBuyerIds.length === 0) {
      toast.error("Please select at least one buyer for this bazar entry.");
      return;
    }
    setSaving(id);
    try {
      await onEditBazar(id, {
        date: bazarDate,
        amount,
        description: bazarDesc,
        buyerIds: bazarBuyerIds,
      });
      setEditingBazarId(null);
      setBazarBuyerIds([]);
      toast.success("Bazar log saved successfully.");
    } catch (error) {
      console.error("Update bazar log failed:", error);
      toast.error("Failed to save bazar log. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  function startEditDeposit(entry: DepositEntry) {
    setEditingDepositId(entry.id);
    const member = members.find(
      (m) =>
        m.id === entry.memberId ||
        (!entry.memberId && m.name === entry.memberName)
    );
    setDepositMemberId(member?.id ?? activeMembers[0]?.id ?? "");
    setDepositAmount(String(entry.amount));
    setDepositDate(entry.date);
    setDepositNote(entry.note);
  }

  async function saveDeposit(id: string) {
    if (!onEditDeposit) return;
    const amount = Math.round(parseFloat(depositAmount));
    const member = members.find((m) => m.id === depositMemberId);
    if (!amount || amount <= 0 || !member) {
      toast.error("Please enter a valid deposit amount and member.");
      return;
    }
    setSaving(id);
    try {
      await onEditDeposit(id, {
        memberId: member.id,
        memberName: member.name,
        amount,
        date: depositDate,
        note: depositNote,
      });
      setEditingDepositId(null);
      toast.success("Deposit saved successfully.");
    } catch (error) {
      console.error("Update deposit failed:", error);
      toast.error("Failed to save deposit. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  function startEditBill(field: BillField) {
    setEditingBillField(field);
    setBillValue(String(bills[field] || ""));
  }

  async function saveBill(field: BillField) {
    if (!onEditBill) return;
    const value = Math.round(parseFloat(billValue) || 0);
    setSaving(field);
    try {
      await onEditBill(field, value);
      setEditingBillField(null);
      toast.success(`${BILL_LABELS[field]} updated successfully.`);
    } catch (error) {
      console.error("Update bill failed:", error);
      toast.error(`Failed to update ${BILL_LABELS[field]}. Please try again.`);
    } finally {
      setSaving(null);
    }
  }

  async function handleDeleteBill(field: BillField) {
    if (!onDeleteBill || !confirm(`Clear ${BILL_LABELS[field]} for this month?`)) {
      return;
    }

    try {
      await onDeleteBill(field);
      toast.success(`${BILL_LABELS[field]} cleared successfully.`);
    } catch (error) {
      console.error("Delete bill failed:", error);
      toast.error(`Failed to clear ${BILL_LABELS[field]}. Please try again.`);
    }
  }

  const billFields: BillField[] = ["houseRent", "buaBill", "otherBills"];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm dark:border-slate-700/70">
          <div className="border-b border-slate-200/60 bg-slate-50/70 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/40 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold sm:text-lg">Bazar Log</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Track daily bazar spending
                </p>
              </div>
              <div className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                {bazar.length} items
              </div>
            </div>
          </div>
          {bazar.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={ReceiptText}
                title="No bazar records found"
                description="Add a bazar entry to get started."
              />
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden px-2 py-2 sm:px-4">
              <ul className="min-w-[280px] divide-y divide-slate-300/50 dark:divide-slate-700/60">
                {bazar.map((entry) => (
                  <li key={entry.id} className="px-4 py-3 sm:px-6">
                    {editingBazarId === entry.id ? (
                      <div className="space-y-2">
                        <PremiumDatePicker value={bazarDate} onChange={setBazarDate} label="Date" />
                        <input
                          type="number"
                          placeholder="Amount (৳)"
                          value={bazarAmount}
                          onChange={(e) => setBazarAmount(e.target.value)}
                          className={inputClass}
                        />
                        <input
                          type="text"
                          placeholder="Description"
                          value={bazarDesc}
                          onChange={(e) => setBazarDesc(e.target.value)}
                          className={inputClass}
                        />
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                            Buyers
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {activeMembers.map((member) => {
                              const isSelected = bazarBuyerIds.includes(member.id);
                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => toggleBazarBuyerSelection(member.id)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${isSelected
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-600/60 dark:hover:bg-slate-700"
                                    }`}
                                >
                                  {member.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveBazar(entry.id)}
                            disabled={saving === entry.id}
                            className="flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {saving === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-4 w-4" />
                                Save
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBazarId(null)}
                            className="flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-slate-600"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <SwipeableListItem
                        onEdit={() => startEditBazar(entry)}
                        onDelete={async () => {
                          if (!onDeleteBazar) return;
                          try {
                            await onDeleteBazar(entry.id);
                            toast.success("Bazar entry deleted successfully.");
                          } catch (error) {
                            console.error("Delete bazar entry failed:", error);
                            toast.error("Failed to delete bazar entry. Please try again.");
                          }
                        }}
                        editLabel="Edit"
                        deleteLabel="Delete"
                        className="rounded-3xl"
                      >
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-2 py-2 transition-colors hover:bg-slate-50 dark:bg-slate-900/30 dark:hover:bg-slate-800/60">
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-semibold text-slate-800 dark:text-slate-100">
                              ৳{entry.amount}
                            </p>
                            <p className="break-words text-xs text-slate-500 dark:text-slate-400">
                              {entry.date}
                              {entry.description ? ` · ${entry.description}` : ""}
                            </p>
                            <p className="mt-1 break-words text-[11px] text-slate-500 dark:text-slate-400">
                              Buyers: {buyerNames(entry)}
                            </p>
                          </div>
                          {isAdmin && (
                            <InlineActions
                              onEdit={() => startEditBazar(entry)}
                              onDelete={async () => {
                                if (!onDeleteBazar) return;
                                try {
                                  await onDeleteBazar(entry.id);
                                  toast.success("Bazar entry deleted successfully.");
                                } catch (error) {
                                  console.error("Delete bazar entry failed:", error);
                                  toast.error("Failed to delete bazar entry. Please try again.");
                                }
                              }}
                            />
                          )}
                        </div>
                      </SwipeableListItem>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="glass-card overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm dark:border-slate-700/70">
          <div className="border-b border-slate-200/60 bg-slate-50/70 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/40 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold sm:text-lg">Deposit Log</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Member deposits and notes
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                {deposits.length} items
              </div>
            </div>
          </div>
          {deposits.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={Wallet2}
                title="No deposits found"
                description="Deposit activity will show up here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden px-2 py-2 sm:px-4">
              <ul className="min-w-[280px] divide-y divide-slate-300/50 dark:divide-slate-700/60">
                {deposits.map((entry) => (
                  <li key={entry.id} className="px-4 py-3 sm:px-6">
                    {editingDepositId === entry.id ? (
                      <div className="space-y-2">
                        <select
                          value={depositMemberId}
                          onChange={(e) => setDepositMemberId(e.target.value)}
                          className={inputClass}
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                              {m.status === "inactive" ? " (Inactive)" : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Amount (৳)"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className={inputClass}
                        />
                        <PremiumDatePicker value={depositDate} onChange={setDepositDate} label="Date" />
                        <input
                          type="text"
                          placeholder="Note"
                          value={depositNote}
                          onChange={(e) => setDepositNote(e.target.value)}
                          className={inputClass}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveDeposit(entry.id)}
                            disabled={saving === entry.id}
                            className="flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {saving === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-4 w-4" />
                                Save
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDepositId(null)}
                            className="flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-slate-600"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <SwipeableListItem
                        onEdit={() => startEditDeposit(entry)}
                        onDelete={async () => {
                          if (!onDeleteDeposit) return;
                          try {
                            await onDeleteDeposit(entry.id);
                            toast.success("Deposit entry deleted successfully.");
                          } catch (error) {
                            console.error("Delete deposit entry failed:", error);
                            toast.error("Failed to delete deposit entry. Please try again.");
                          }
                        }}
                        editLabel="Edit"
                        deleteLabel="Delete"
                        className="rounded-3xl"
                      >
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-2 py-2 transition-colors hover:bg-slate-50 dark:bg-slate-900/30 dark:hover:bg-slate-800/60">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {entry.memberName} — ৳{entry.amount}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {entry.date}
                              {entry.note ? ` · ${entry.note}` : ""}
                            </p>
                          </div>
                          {isAdmin && (
                            <InlineActions
                              onEdit={() => startEditDeposit(entry)}
                              onDelete={async () => {
                                if (!onDeleteDeposit) return;
                                try {
                                  await onDeleteDeposit(entry.id);
                                  toast.success("Deposit entry deleted successfully.");
                                } catch (error) {
                                  console.error("Delete deposit entry failed:", error);
                                  toast.error("Failed to delete deposit entry. Please try again.");
                                }
                              }}
                            />
                          )}
                        </div>
                      </SwipeableListItem>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="glass-card overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm dark:border-slate-700/70">
          <div className="border-b border-slate-200/60 bg-slate-50/70 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/40 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold sm:text-lg">
                  Monthly Fixed Bills
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Shared household charges
                </p>
              </div>
              <div className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                {billFields.length} items
              </div>
            </div>
          </div>
          <ul className="divide-y divide-slate-300/50 dark:divide-slate-700/60">
            {billFields.map((field) => (
              <li key={field} className="px-4 py-3 sm:px-6">
                {editingBillField === field ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="min-w-[120px] text-sm font-medium">
                      {BILL_LABELS[field]}
                    </span>
                    <input
                      type="number"
                      value={billValue}
                      onChange={(e) => setBillValue(e.target.value)}
                      className={`${inputClass} sm:max-w-[200px]`}
                      placeholder="Amount (৳)"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveBill(field)}
                        disabled={saving === field}
                        className="flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {saving === field ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBillField(null)}
                        className="flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-slate-600"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{BILL_LABELS[field]}</p>
                      <p className="text-lg font-bold">
                        ৳{Math.round(bills[field])}
                      </p>
                    </div>
                    {isAdmin && bills[field] > 0 && (
                      <InlineActions
                        onEdit={() => startEditBill(field)}
                        onDelete={() => handleDeleteBill(field)}
                        editLabel={`Edit ${BILL_LABELS[field]}`}
                        deleteLabel={`Clear ${BILL_LABELS[field]}`}
                      />
                    )}
                    {isAdmin && bills[field] === 0 && (
                      <InlineActions
                        onEdit={() => startEditBill(field)}
                        editLabel={`Set ${BILL_LABELS[field]}`}
                      />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
