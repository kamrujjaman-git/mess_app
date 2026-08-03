"use client";

import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import type {
  BazarEntry,
  DepositEntry,
  MonthBills,
  Member,
  BillField,
} from "@/lib/mess";
import { BILL_LABELS } from "@/lib/mess";
import { getActiveMembers } from "@/lib/mess";
import { InlineActions, inputClass } from "./InlineActions";

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
  }

  async function saveBazar(id: string) {
    if (!onEditBazar) return;
    const amount = Math.round(parseFloat(bazarAmount));
    if (!amount || amount <= 0) return;
    setSaving(id);
    try {
      await onEditBazar(id, {
        date: bazarDate,
        amount,
        description: bazarDesc,
      });
      setEditingBazarId(null);
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
    if (!amount || amount <= 0 || !member) return;
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
    } finally {
      setSaving(null);
    }
  }

  async function handleDeleteBill(field: BillField) {
    if (
      !onDeleteBill ||
      !confirm(`Clear ${BILL_LABELS[field]} for this month?`)
    )
      return;
    await onDeleteBill(field);
  }

  const billFields: BillField[] = ["houseRent", "buaBill", "otherBills"];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6">
            <h2 className="text-base font-semibold sm:text-lg">Bazar Log</h2>
          </div>
          {bazar.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No bazar entries
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {bazar.map((entry) => (
                <li key={entry.id} className="px-4 py-3 sm:px-6">
                  {editingBazarId === entry.id ? (
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={bazarDate}
                        onChange={(e) => setBazarDate(e.target.value)}
                        className={inputClass}
                      />
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">৳{entry.amount}</p>
                        <p className="truncate text-xs text-slate-500">
                          {entry.date}
                          {entry.description ? ` · ${entry.description}` : ""}
                        </p>
                      </div>
                      {isAdmin && (
                        <InlineActions
                          onEdit={() => startEditBazar(entry)}
                          onDelete={() => onDeleteBazar?.(entry.id)}
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6">
            <h2 className="text-base font-semibold sm:text-lg">Deposit Log</h2>
          </div>
          {deposits.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No deposits
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
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
                      <input
                        type="date"
                        value={depositDate}
                        onChange={(e) => setDepositDate(e.target.value)}
                        className={inputClass}
                      />
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {entry.memberName} — ৳{entry.amount}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {entry.date}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </div>
                      {isAdmin && (
                        <InlineActions
                          onEdit={() => startEditDeposit(entry)}
                          onDelete={() => onDeleteDeposit?.(entry.id)}
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6">
            <h2 className="text-base font-semibold sm:text-lg">
              Monthly Fixed Bills
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
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
