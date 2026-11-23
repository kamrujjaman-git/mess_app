"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Save, Plus } from "lucide-react";
import type { Member, MemberMeals, MonthBills } from "@/lib/mess";
import { getActiveMembers, getTodayDateString, isDateOnOrBeforeToday } from "@/lib/mess";
import { ManageMembers } from "./ManageMembers";
import { inputClass } from "./InlineActions";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";
import type { AdminSection } from "./Sidebar";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

interface AdminPanelProps {
  members: Member[];
  bills: MonthBills;
  selectedMonthKey: string;
  activeSection?: AdminSection | null;
  onSaveMeals?: (
    date: string,
    meals: Record<string, MemberMeals>
  ) => Promise<void>;
  onAddBazar?: (date: string, amount: number, description: string, buyerIds: string[]) => Promise<void>;
  onAddDeposit?: (
    memberId: string,
    memberName: string,
    amount: number,
    date: string,
    note: string
  ) => Promise<void>;
  onUpdateBills?: (bills: MonthBills) => Promise<void>;
  onAddMember: (name: string, email: string, whatsAppNumber?: string) => Promise<void>;
  onUpdateMember: (member: Member) => Promise<void>;
  onSetMemberStatus: (memberId: string, status: Member["status"]) => Promise<void>;
  onDeleteMember: (memberId: string) => Promise<void>;
}

export function AdminPanel({
  members,
  bills,
  selectedMonthKey,
  activeSection,
  onSaveMeals,
  onAddBazar,
  onAddDeposit,
  onUpdateBills,
  onAddMember,
  onUpdateMember,
  onSetMemberStatus,
  onDeleteMember,
}: AdminPanelProps) {
  const activeMembers = getActiveMembers(members);
  const selectedSection = activeSection ?? "daily-meals";

  const [mealDate, setMealDate] = useState(`${selectedMonthKey}-01`);
  const [mealInputs, setMealInputs] = useState<Record<string, MemberMeals>>(
    () => {
      const initial: Record<string, MemberMeals> = {};
      activeMembers.forEach((m) => {
        initial[m.id] = { breakfast: 0, lunch: 0, dinner: 0 };
      });
      return initial;
    }
  );

  const [bazarDate, setBazarDate] = useState(`${selectedMonthKey}-01`);
  const [bazarAmount, setBazarAmount] = useState("");
  const [bazarDesc, setBazarDesc] = useState("");
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);

  const [depositMemberId, setDepositMemberId] = useState(
    activeMembers[0]?.id ?? ""
  );
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState(`${selectedMonthKey}-01`);
  const [depositNote, setDepositNote] = useState("");

  const [billDraft, setBillDraft] = useState<MonthBills | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const billInputs = billDraft ?? bills;
  const selectedDepositMemberId = activeMembers.some((member) => member.id === depositMemberId)
    ? depositMemberId
    : activeMembers[0]?.id ?? "";

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
    if (!isDateOnOrBeforeToday(mealDate)) {
      toast.error("Meal entries can only be saved through today.");
      return;
    }
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

  function toggleBuyerSelection(memberId: string) {
    setSelectedBuyerIds((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : [...previous, memberId]
    );
  }

  async function handleAddBazar() {
    if (!onAddBazar) return;
    const amount = Math.round(parseFloat(bazarAmount));
    if (!amount || amount <= 0 || !isDateOnOrBeforeToday(bazarDate)) {
      toast.error("Please enter a valid bazar amount.");
      return;
    }
    if (selectedBuyerIds.length === 0) {
      toast.error("Please select at least one buyer for this bazar entry.");
      return;
    }
    setSaving("bazar");
    try {
      await onAddBazar(bazarDate, amount, bazarDesc, selectedBuyerIds);
      setBazarAmount("");
      setBazarDesc("");
      setSelectedBuyerIds([]);
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
    if (!amount || amount <= 0 || !member || !isDateOnOrBeforeToday(depositDate)) {
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
      setBillDraft(null);
      toast.success("Bills saved successfully.");
    } catch (error) {
      console.error("Save bills failed:", error);
      toast.error("Failed to save bills. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {selectedSection === "add-member" || selectedSection === "all-members" ? (
        <ManageMembers
          members={members}
          activeView={selectedSection === "add-member" ? "add" : "all"}
          onAddMember={onAddMember}
          onUpdateMember={onUpdateMember}
          onSetMemberStatus={onSetMemberStatus}
          onDeleteMember={onDeleteMember}
        />
      ) : (
        <>
          <DashboardSectionHeader
            title={
              selectedSection === "daily-meals"
                ? "Daily Meals"
                : selectedSection === "add-bazar"
                  ? "Add Bazar"
                  : selectedSection === "add-deposit"
                    ? "Add Deposit"
                    : "Set Fixed Bills"
            }
            description={
              selectedSection === "daily-meals"
                ? "Log breakfast, lunch, and dinner for each active member."
                : selectedSection === "add-bazar"
                  ? "Record a bazar expense and the members who shared it."
                  : selectedSection === "add-deposit"
                    ? "Record a deposit for a member."
                    : "Set monthly rent, service, and other shared charges."
            }
          />
          {selectedSection === "daily-meals" ? (
            <div id="admin-daily-meals" className="glass-card rounded-2xl p-4 sm:p-6">
            <div className="mb-4">
              <PremiumDatePicker value={mealDate} onChange={setMealDate} label="Date" maxDate={getTodayDateString()} />
            </div>
            {activeMembers.length === 0 ? (
              <p className="text-sm text-slate-500">No active members.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_repeat(3,64px)] items-end gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[1fr_repeat(3,80px)]">
                  <span>Member</span>
                  <span className="text-center">Breakfast</span>
                  <span className="text-center">Lunch</span>
                  <span className="text-center">Dinner</span>
                </div>
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
                          aria-label={`${member.name} ${field}`}
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
          ) : null}

          <div className="space-y-4">
            {selectedSection === "add-bazar" ? (
              <div id="admin-add-bazar" className="glass-card rounded-2xl p-4 sm:p-6">
              <div className="space-y-3">
                <PremiumDatePicker value={bazarDate} onChange={setBazarDate} label="Date" maxDate={getTodayDateString()} />
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Amount (৳)</span>
                  <input
                    type="number"
                    value={bazarAmount}
                    onChange={(e) => setBazarAmount(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Description (optional)</span>
                  <input
                    type="text"
                    value={bazarDesc}
                    onChange={(e) => setBazarDesc(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <div className="space-y-2">
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Buyers
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeMembers.length === 0 ? (
                      <p className="text-sm text-slate-500">No active members available.</p>
                    ) : (
                      activeMembers.map((member) => {
                        const isSelected = selectedBuyerIds.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleBuyerSelection(member.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${isSelected
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-600/60 dark:hover:bg-slate-700"
                              }`}
                          >
                            {member.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
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
            ) : null}

            {selectedSection === "add-deposit" ? (
              <div id="admin-add-deposit" className="glass-card rounded-2xl p-4 sm:p-6">
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Member</span>
                  <select
                    value={selectedDepositMemberId}
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
                </label>
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Amount (৳)</span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <PremiumDatePicker value={depositDate} onChange={setDepositDate} label="Date" maxDate={getTodayDateString()} />
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">Note (optional)</span>
                  <input
                    type="text"
                    value={depositNote}
                    onChange={(e) => setDepositNote(e.target.value)}
                    className={inputClass}
                  />
                </label>
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
            ) : null}
          </div>

          {selectedSection === "fixed-bills" ? (
            <div id="admin-fixed-bills" className="glass-card rounded-2xl p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  House Rent (৳)
                </label>
                <input
                  type="number"
                  value={billInputs.houseRent || ""}
                  onChange={(e) =>
                    setBillDraft((prev) => ({
                      ...(prev ?? bills),
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
                    setBillDraft((prev) => ({
                      ...(prev ?? bills),
                      buaBill: Math.round(parseFloat(e.target.value) || 0),
                    }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Other Bills Description/Title
                </label>
                <input
                  type="text"
                  placeholder="Electricity & Water"
                  value={billInputs.otherBillsDescription}
                  onChange={(e) =>
                    setBillDraft((prev) => ({
                      ...(prev ?? bills),
                      otherBillsDescription: e.target.value,
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
                    setBillDraft((prev) => ({
                      ...(prev ?? bills),
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
          ) : null}
        </>
      )}
    </div>
  );
}
