"use client";

import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { ArrowRightLeft, ChevronDown, Loader2, Save, Plus } from "lucide-react";
import type { Member, MemberMeals, MonthBills } from "@/lib/mess";
import { getActiveMembers, getTodayDateString, isDateOnOrBeforeToday } from "@/lib/mess";
import { AnimatedFormError } from "@/components/ui/AnimatedFormError";
import { ManageMembers } from "./ManageMembers";
import { ActivityLog } from "./ActivityLog";
import { CarryForwardModal } from "./CarryForwardModal";
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

type EntryFormKey = "meals" | "bazar" | "deposit";

interface FormErrorState {
  message: string;
  attempt: number;
}

const DEPOSIT_QUICK_AMOUNTS = [500, 1000, 2000, 5000];
const BAZAR_QUICK_PICKS = ["Vegetables", "Rice", "Cooking oil", "Groceries"];

function getDefaultEntryDate(monthKey: string) {
  const today = getTodayDateString();
  return today.slice(0, 7) === monthKey ? today : `${monthKey}-01`;
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

  const [bazarDate, setBazarDate] = useState(() => getDefaultEntryDate(selectedMonthKey));
  const [bazarAmount, setBazarAmount] = useState("");
  const [bazarDesc, setBazarDesc] = useState("");
  const [bazarMoreOptionsOpen, setBazarMoreOptionsOpen] = useState(false);
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);

  const [depositMemberId, setDepositMemberId] = useState(
    activeMembers[0]?.id ?? ""
  );
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState(() => getDefaultEntryDate(selectedMonthKey));
  const [depositNote, setDepositNote] = useState("");
  const [depositNoteOpen, setDepositNoteOpen] = useState(false);

  const [billDraft, setBillDraft] = useState<MonthBills | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<EntryFormKey, FormErrorState>>>({});
  const [carryForwardOpen, setCarryForwardOpen] = useState(false);
  const inFlightSubmissionsRef = useRef(new Set<string>());
  const billInputs = billDraft ?? bills;
  const selectedDepositMemberId = activeMembers.some((member) => member.id === depositMemberId)
    ? depositMemberId
    : activeMembers[0]?.id ?? "";

  function beginSubmission(key: string) {
    if (inFlightSubmissionsRef.current.has(key)) return false;
    inFlightSubmissionsRef.current.add(key);
    setSaving(key);
    return true;
  }

  function finishSubmission(key: string) {
    inFlightSubmissionsRef.current.delete(key);
    setSaving((current) => current === key ? null : current);
  }

  function showFormError(form: EntryFormKey, message: string) {
    setFormErrors((previous) => ({
      ...previous,
      [form]: {
        message,
        attempt: (previous[form]?.attempt ?? 0) + 1,
      },
    }));
    toast.error(message);
  }

  function clearFormError(form: EntryFormKey) {
    setFormErrors((previous) => {
      if (!previous[form]) return previous;
      const next = { ...previous };
      delete next[form];
      return next;
    });
  }

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
      showFormError("meals", "Meal entries can only be saved through today.");
      return;
    }
    clearFormError("meals");
    if (!beginSubmission("meals")) return;
    try {
      await onSaveMeals(mealDate, mealInputs);
      toast.success("Daily meals saved successfully.");
    } catch (error) {
      console.error("Save meals failed:", error);
      toast.error("Failed to save daily meals. Please try again.");
    } finally {
      finishSubmission("meals");
    }
  }

  function toggleBuyerSelection(memberId: string) {
    clearFormError("bazar");
    setSelectedBuyerIds((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : [...previous, memberId]
    );
  }

  async function handleAddBazar() {
    if (!onAddBazar) return;
    const amount = Math.round(parseFloat(bazarAmount));
    if (!amount || amount <= 0) {
      showFormError("bazar", "Enter a bazar amount greater than zero.");
      return;
    }
    if (!isDateOnOrBeforeToday(bazarDate)) {
      showFormError("bazar", "Choose a bazar date on or before today.");
      return;
    }
    if (selectedBuyerIds.length === 0) {
      showFormError("bazar", "Select at least one buyer for this bazar entry.");
      return;
    }
    clearFormError("bazar");
    if (!beginSubmission("bazar")) return;
    try {
      await onAddBazar(bazarDate, amount, bazarDesc, selectedBuyerIds);
      setBazarAmount("");
      setBazarDesc("");
      setBazarMoreOptionsOpen(false);
      setSelectedBuyerIds([]);
      toast.success("Bazar entry added successfully.");
    } catch (error) {
      console.error("Add bazar failed:", error);
      toast.error("Failed to add bazar entry. Please try again.");
    } finally {
      finishSubmission("bazar");
    }
  }

  async function handleAddDeposit() {
    if (!onAddDeposit) return;
    const amount = Math.round(parseFloat(depositAmount));
    const member = members.find((m) => m.id === depositMemberId);
    if (!amount || amount <= 0 || !member) {
      showFormError("deposit", "Choose a member and enter a deposit amount greater than zero.");
      return;
    }
    if (!isDateOnOrBeforeToday(depositDate)) {
      showFormError("deposit", "Choose a deposit date on or before today.");
      return;
    }
    clearFormError("deposit");
    if (!beginSubmission("deposit")) return;
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
      setDepositNoteOpen(false);
      toast.success("Deposit added successfully.");
    } catch (error) {
      console.error("Add deposit failed:", error);
      toast.error("Failed to add deposit. Please try again.");
    } finally {
      finishSubmission("deposit");
    }
  }

  async function handleSaveBills() {
    if (!onUpdateBills) return;
    if (!beginSubmission("bills")) return;
    try {
      await onUpdateBills(billInputs);
      setBillDraft(null);
      toast.success("Bills saved successfully.");
    } catch (error) {
      console.error("Save bills failed:", error);
      toast.error("Failed to save bills. Please try again.");
    } finally {
      finishSubmission("bills");
    }
  }

  return (
    <div className="space-y-4">
      <div className="clay-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-bold text-primary">Month-end balance transfer</h2>
          <p className="mt-1 text-xs text-secondary">
            Preview active members&apos; closing balances before carrying them into this month.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCarryForwardOpen(true)}
          aria-haspopup="dialog"
          className="clay-pill tactile-press inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border border-brand bg-brand px-4 py-2 text-sm font-semibold text-brand-on-fill transition hover:bg-brand-hover"
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
          Carry Forward Balance
        </button>
      </div>
      {carryForwardOpen ? (
        <CarryForwardModal
          targetMonthKey={selectedMonthKey}
          members={members}
          onClose={() => setCarryForwardOpen(false)}
        />
      ) : null}
      {selectedSection === "activity-log" ? (
        <ActivityLog />
      ) : selectedSection === "add-member" || selectedSection === "all-members" ? (
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
            <div id="admin-daily-meals" className="clay-card p-4 sm:p-6">
            <div className="mb-4">
              <PremiumDatePicker
                value={mealDate}
                onChange={(date) => {
                  setMealDate(date);
                  clearFormError("meals");
                }}
                label="Date"
                maxDate={getTodayDateString()}
              />
            </div>
            {activeMembers.length === 0 ? (
              <p className="text-sm text-muted">No active members.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_repeat(3,64px)] items-end gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted sm:grid-cols-[1fr_repeat(3,80px)]">
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
                          className={`${inputClass} tabular-nums`}
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
              className="clay-pill tactile-press mt-4 flex h-11 w-full items-center justify-center gap-2 bg-brand text-sm font-semibold text-brand-on-fill transition hover:bg-brand-hover disabled:opacity-60"
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
            <AnimatedFormError
              message={formErrors.meals?.message ?? ""}
              attempt={formErrors.meals?.attempt ?? 0}
              className="mt-3"
            />
            </div>
          ) : null}

          <div className="space-y-4">
            {selectedSection === "add-bazar" ? (
              <div id="admin-add-bazar" className="clay-card p-4 sm:p-6">
              <div className="space-y-3">
                <PremiumDatePicker
                  value={bazarDate}
                  onChange={(date) => {
                    setBazarDate(date);
                    clearFormError("bazar");
                  }}
                  label="Date"
                  maxDate={getTodayDateString()}
                />
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-secondary dark:text-secondary">Amount (৳)</span>
                  <input
                    type="number"
                    value={bazarAmount}
                    onChange={(e) => {
                      setBazarAmount(e.target.value);
                      clearFormError("bazar");
                    }}
                    className={`${inputClass} tabular-nums`}
                  />
                </label>
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-secondary">Quick item</span>
                  <div className="flex flex-wrap gap-2">
                    {BAZAR_QUICK_PICKS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={bazarDesc === item}
                        onClick={() => {
                          setBazarDesc(item);
                          setBazarMoreOptionsOpen(true);
                        }}
                        className={`clay-pill tactile-toggle border px-3 py-1.5 text-xs font-medium ${
                          bazarDesc === item
                            ? "border-brand bg-brand text-brand-on-fill"
                            : "border-subtle bg-elevated/60 text-secondary hover:bg-kpi-sage"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  aria-expanded={bazarMoreOptionsOpen}
                  aria-controls="bazar-more-options"
                  onClick={() => setBazarMoreOptionsOpen((open) => !open)}
                  className="tactile-press inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover"
                >
                  {bazarMoreOptionsOpen ? "Hide options" : "More options"}
                  <span className={`transition-transform duration-150 ${bazarMoreOptionsOpen ? "rotate-180" : ""}`}>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
                {bazarMoreOptionsOpen ? (
                  <div id="bazar-more-options" className="optional-fields-reveal">
                    <label className="block space-y-1">
                      <span className="block text-xs font-medium text-secondary">Description (optional)</span>
                      <input
                        type="text"
                        value={bazarDesc}
                        onChange={(e) => setBazarDesc(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Buyers
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeMembers.length === 0 ? (
                      <p className="text-sm text-muted">No active members available.</p>
                    ) : (
                      activeMembers.map((member) => {
                        const isSelected = selectedBuyerIds.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleBuyerSelection(member.id)}
                            className={`clay-pill tactile-toggle border px-3 py-1.5 text-xs font-medium transition ${isSelected
                              ? "border-brand bg-brand text-brand-on-fill shadow-sm"
                              : "border-subtle bg-elevated/60 text-secondary hover:border-brand hover:bg-kpi-sage"
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
              <AnimatedFormError
                message={formErrors.bazar?.message ?? ""}
                attempt={formErrors.bazar?.attempt ?? 0}
                className="mt-3"
              />
              <button
                type="button"
                onClick={handleAddBazar}
                disabled={saving === "bazar"}
                className="clay-pill tactile-press mt-4 flex h-11 w-full items-center justify-center gap-2 bg-brand text-sm font-semibold text-brand-on-fill transition hover:bg-brand-hover disabled:opacity-60"
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
              <div id="admin-add-deposit" className="clay-card p-4 sm:p-6">
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="block text-xs font-medium text-secondary dark:text-secondary">Member</span>
                  <select
                    value={selectedDepositMemberId}
                    onChange={(e) => {
                      setDepositMemberId(e.target.value);
                      clearFormError("deposit");
                    }}
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
                  <span className="block text-xs font-medium text-secondary dark:text-secondary">Amount (৳)</span>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => {
                      setDepositAmount(e.target.value);
                      clearFormError("deposit");
                    }}
                    className={`${inputClass} tabular-nums`}
                  />
                </label>
                <div className="-mt-1 flex flex-wrap gap-2" role="group" aria-label="Common deposit amounts">
                  {DEPOSIT_QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      aria-pressed={depositAmount === String(amount)}
                      onClick={() => {
                        setDepositAmount(String(amount));
                        clearFormError("deposit");
                      }}
                      className={`clay-pill tactile-toggle border px-3 py-1.5 text-xs font-semibold tabular-nums ${
                        depositAmount === String(amount)
                          ? "border-brand bg-brand text-brand-on-fill"
                          : "border-subtle bg-elevated/60 text-secondary hover:bg-kpi-sage"
                      }`}
                    >
                      ৳{amount.toLocaleString("en-BD")}
                    </button>
                  ))}
                </div>
                <PremiumDatePicker
                  value={depositDate}
                  onChange={(date) => {
                    setDepositDate(date);
                    clearFormError("deposit");
                  }}
                  label="Date"
                  maxDate={getTodayDateString()}
                />
                <button
                  type="button"
                  aria-expanded={depositNoteOpen}
                  aria-controls="deposit-note-field"
                  onClick={() => setDepositNoteOpen((open) => !open)}
                  className="tactile-press inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover"
                >
                  {depositNoteOpen ? "Hide note" : "Add note"}
                  <span className={`transition-transform duration-150 ${depositNoteOpen ? "rotate-180" : ""}`}>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
                {depositNoteOpen ? (
                  <label id="deposit-note-field" className="optional-fields-reveal block space-y-1">
                    <span className="block text-xs font-medium text-secondary">Note (optional)</span>
                    <input
                      type="text"
                      value={depositNote}
                      onChange={(e) => setDepositNote(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                ) : null}
              </div>
              <AnimatedFormError
                message={formErrors.deposit?.message ?? ""}
                attempt={formErrors.deposit?.attempt ?? 0}
                className="mt-3"
              />
              <button
                type="button"
                onClick={handleAddDeposit}
                disabled={saving === "deposit"}
                className="clay-pill tactile-press mt-4 flex h-11 w-full items-center justify-center gap-2 bg-brand text-sm font-semibold text-brand-on-fill transition hover:bg-brand-hover disabled:opacity-60"
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
            <div id="admin-fixed-bills" className="clay-card p-4 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
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
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
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
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
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
                <label className="mb-1 block text-xs font-medium text-muted">
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
                  className={`${inputClass} tabular-nums`}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveBills}
              disabled={saving === "bills"}
              className="clay-pill tactile-press mt-4 flex h-11 w-full items-center justify-center gap-2 bg-brand text-sm font-semibold text-brand-on-fill transition hover:bg-brand-hover disabled:opacity-60 sm:w-auto sm:px-8"
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
