"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Save, Plus, Users, NotebookPen } from "lucide-react";
import type { Member, MemberMeals, MonthBills } from "@/lib/mess";
import { getActiveMembers, getTodayDateString } from "@/lib/mess";
import { ManageMembers } from "./ManageMembers";
import { inputClass } from "./InlineActions";

type AdminSubTab = "entries" | "members";

interface AdminPanelProps {
  members: Member[];
  bills: MonthBills;
  subTab: AdminSubTab;
  onSubTabChange: (subTab: AdminSubTab) => void;
  onSaveMeals?: (
    date: string,
    meals: Record<string, MemberMeals>
  ) => Promise<void>;
  onAddBazar?: (date: string, amount: number, description: string) => Promise<void>;
  onAddDeposit?: (
    memberId: string,
    memberName: string,
    amount: number,
    date: string,
    note: string
  ) => Promise<void>;
  onUpdateBills?: (bills: MonthBills) => Promise<void>;
  onArchiveMonth?: () => Promise<void>;
  isArchiveMode?: boolean;
  onAddMember: (name: string, email: string, whatsAppNumber?: string) => Promise<void>;
  onUpdateMember: (member: Member) => Promise<void>;
  onSetMemberStatus: (memberId: string, status: Member["status"]) => Promise<void>;
}

export function AdminPanel({
  members,
  bills,
  subTab,
  onSubTabChange,
  onSaveMeals,
  onAddBazar,
  onAddDeposit,
  onUpdateBills,
  onArchiveMonth,
  isArchiveMode = false,
  onAddMember,
  onUpdateMember,
  onSetMemberStatus,
}: AdminPanelProps) {
  const activeMembers = getActiveMembers(members);

  const [mealDate, setMealDate] = useState(getTodayDateString());
  const [mealInputs, setMealInputs] = useState<Record<string, MemberMeals>>(
    () => {
      const initial: Record<string, MemberMeals> = {};
      activeMembers.forEach((m) => {
        initial[m.id] = { breakfast: 0, lunch: 0, dinner: 0 };
      });
      return initial;
    }
  );

  const [bazarDate, setBazarDate] = useState(getTodayDateString());
  const [bazarAmount, setBazarAmount] = useState("");
  const [bazarDesc, setBazarDesc] = useState("");

  const [depositMemberId, setDepositMemberId] = useState(
    activeMembers[0]?.id ?? ""
  );
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState(getTodayDateString());
  const [depositNote, setDepositNote] = useState("");

  const [billInputs, setBillInputs] = useState(bills);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setBillInputs(bills);
  }, [bills]);

  useEffect(() => {
    setMealInputs(() => {
      const initial: Record<string, MemberMeals> = {};
      getActiveMembers(members).forEach((m) => {
        initial[m.id] = { breakfast: 0, lunch: 0, dinner: 0 };
      });
      return initial;
    });
    const active = getActiveMembers(members);
    setDepositMemberId(active[0]?.id ?? "");
  }, [members]);

  function updateMeal(
    memberId: string,
    field: keyof MemberMeals,
    value: string
  ) {
    const num = value === "" ? 0 : parseFloat(value);
    setMealInputs((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: isNaN(num) ? 0 : num,
      },
    }));
  }

  async function handleSaveMeals() {
    if (!onSaveMeals) return;
    setSaving("meals");
    try {
      await onSaveMeals(mealDate, mealInputs);
      toast.success("Daily meals saved successfully.");
    } catch (error) {
      console.error("Save meals failed:", error);
      toast.error("Failed to save daily meals. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function handleAddBazar() {
    if (!onAddBazar) return;
    const amount = Math.round(parseFloat(bazarAmount));
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid bazar amount.");
      return;
    }
    setSaving("bazar");
    try {
      await onAddBazar(bazarDate, amount, bazarDesc);
      setBazarAmount("");
      setBazarDesc("");
      toast.success("Bazar entry added successfully.");
    } catch (error) {
      console.error("Add bazar failed:", error);
      toast.error("Failed to add bazar entry. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function handleAddDeposit() {
    if (!onAddDeposit) return;
    const amount = Math.round(parseFloat(depositAmount));
    const member = members.find((m) => m.id === depositMemberId);
    if (!amount || amount <= 0 || !member) {
      toast.error("Please enter a valid deposit amount and member.");
      return;
    }
    setSaving("deposit");
    try {
      await onAddDeposit(
        member.id,
        member.name,
        amount,
        depositDate,
        depositNote
      );
      setDepositAmount("");
      setDepositNote("");
      toast.success("Deposit added successfully.");
    } catch (error) {
      console.error("Add deposit failed:", error);
      toast.error("Failed to add deposit. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveBills() {
    if (!onUpdateBills) return;
    setSaving("bills");
    try {
      await onUpdateBills(billInputs);
      toast.success("Bills saved successfully.");
    } catch (error) {
      console.error("Save bills failed:", error);
      toast.error("Failed to save bills. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  const subTabs: { id: AdminSubTab; label: string; icon: typeof NotebookPen }[] = [
    { id: "entries", label: "Add Entries", icon: NotebookPen },
    { id: "members", label: "Manage Members", icon: Users },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="grid grid-cols-2 gap-1">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSubTabChange(tab.id)}
                className={`relative flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${isActive
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {subTab === "members" ? (
        <ManageMembers
          members={members}
          onAddMember={onAddMember}
          onUpdateMember={onUpdateMember}
          onSetMemberStatus={onSetMemberStatus}
        />
      ) : (
        <>
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold">Daily Meals</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a date and update meal entries for all members.
                </p>
              </div>
              {onArchiveMonth && !isArchiveMode ? (
                <button
                  type="button"
                  onClick={onArchiveMonth}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Archive &amp; Start New Month
                </button>
              ) : null}
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Date
              </label>
              <input
                type="date"
                value={mealDate}
                onChange={(e) => setMealDate(e.target.value)}
                className={inputClass}
              />
            </div>
            {activeMembers.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active members. Add members in the Manage Members tab.
              </p>
            ) : (
              <div className="space-y-3">
                {activeMembers.map((member) => (
                  <div
                    key={member.id}
                    className="grid grid-cols-[1fr_repeat(3,64px)] items-center gap-2 sm:grid-cols-[1fr_repeat(3,80px)]"
                  >
                    <span className="truncate text-sm font-medium">
                      {member.name}
                    </span>
                    {(["breakfast", "lunch", "dinner"] as const).map(
                      (field) => (
                        <input
                          key={field}
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder={field[0].toUpperCase()}
                          value={mealInputs[member.id]?.[field] || ""}
                          onChange={(e) =>
                            updateMeal(member.id, field, e.target.value)
                          }
                          className={inputClass}
                        />
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleSaveMeals}
              disabled={saving === "meals" || activeMembers.length === 0}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving === "meals" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Daily Meals
                </>
              )}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="glass-card rounded-2xl p-4 sm:p-6">
              <h3 className="mb-4 text-base font-semibold">Add Bazar</h3>
              <div className="space-y-3">
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
                  placeholder="Description (optional)"
                  value={bazarDesc}
                  onChange={(e) => setBazarDesc(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={handleAddBazar}
                disabled={saving === "bazar"}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving === "bazar" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Bazar Entry
                  </>
                )}
              </button>
            </div>

            <div className="glass-card rounded-2xl p-4 sm:p-6">
              <h3 className="mb-4 text-base font-semibold">Add Deposit</h3>
              <div className="space-y-3">
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
                  placeholder="Note (optional)"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={handleAddDeposit}
                disabled={saving === "deposit"}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
              >
                {saving === "deposit" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Deposit
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <h3 className="mb-4 text-base font-semibold">
              Monthly Fixed Bills (Quick Set)
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  House Rent (৳)
                </label>
                <input
                  type="number"
                  value={billInputs.houseRent || ""}
                  onChange={(e) =>
                    setBillInputs((prev) => ({
                      ...prev,
                      houseRent: Math.round(parseFloat(e.target.value) || 0),
                    }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Bua Bill (৳)
                </label>
                <input
                  type="number"
                  value={billInputs.buaBill || ""}
                  onChange={(e) =>
                    setBillInputs((prev) => ({
                      ...prev,
                      buaBill: Math.round(parseFloat(e.target.value) || 0),
                    }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Other Bills (৳)
                </label>
                <input
                  type="number"
                  value={billInputs.otherBills || ""}
                  onChange={(e) =>
                    setBillInputs((prev) => ({
                      ...prev,
                      otherBills: Math.round(parseFloat(e.target.value) || 0),
                    }))
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveBills}
              disabled={saving === "bills"}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60 sm:w-auto sm:px-8"
            >
              {saving === "bills" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Bills
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
