"use client";

import {
  useCallback,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "react-hot-toast";
import { ChevronDown, Loader2, ReceiptText, Save, Wallet2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  BILL_LABELS,
  formatCurrency,
  getActiveMembers,
  getBazarBuyerLabel,
  getTodayDateString,
  isDateOnOrBeforeToday,
  normalizeBazarBuyerIds,
  type BazarEntry,
  type BillField,
  type DepositEntry,
  type Member,
  type MonthBills,
} from "@/lib/mess";
import { InlineActions, inputClass } from "./InlineActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";
import { useToast } from "@/components/ui/ToastProvider";
import { SwipeableListItem } from "./SwipeableListItem";
import type { DashboardLogSection } from "./Sidebar";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

const mobileViewportQuery = "(max-width: 700px)";
const subscribeToNothing = () => () => undefined;
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;
const depositQuickAmounts = [500, 1000, 2000, 5000];
const bazarQuickPicks = ["Vegetables", "Rice", "Cooking oil", "Groceries"];

function subscribeToMobileViewport(callback: () => void) {
  const mediaQuery = window.matchMedia(mobileViewportQuery);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getMobileViewportSnapshot() {
  return window.matchMedia(mobileViewportQuery).matches;
}

function useMobileViewport() {
  return useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    () => false
  );
}

interface ResponsiveEditSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function ResponsiveEditSheet({
  open,
  title,
  onClose,
  children,
}: ResponsiveEditSheetProps) {
  const reduceMotion = useReducedMotion();
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getMountedSnapshot,
    getServerMountedSnapshot
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="responsive-bottom-sheet fixed inset-0 z-[90] flex items-center justify-center bg-[#141210]/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-edit-sheet-title"
            className="responsive-bottom-sheet-panel glass-bar p-4 text-primary sm:p-6"
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
          >
            <div className="responsive-bottom-sheet-handle mb-3 justify-center">
              <span className="h-1.5 w-10 rounded-full bg-subtle" />
            </div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="log-edit-sheet-title" className="text-balance text-lg font-semibold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close editor"
                className="tactile-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-container"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

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
  onDeleteBazar?: (id: string) => Promise<void>;
  onEditDeposit?: (
    id: string,
    entry: Omit<DepositEntry, "id">
  ) => Promise<void>;
  onDeleteDeposit?: (id: string) => Promise<void>;
  onEditBill?: (field: BillField, value: number) => Promise<void>;
  onDeleteBill?: (field: BillField) => Promise<void>;
  onAddBazar?: () => void;
  onAddDeposit?: () => void;
  activeSection?: DashboardLogSection | null;
}

export const BazarDepositLog = memo(function BazarDepositLog({
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
  onAddBazar,
  onAddDeposit,
  activeSection,
}: BazarDepositLogProps) {
  const { undo, error } = useToast();
  const reduceMotion = useReducedMotion() ?? false;
  const isMobileViewport = useMobileViewport();
  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const selectedSection = activeSection === "bills" && !isAdmin
    ? "bazar"
    : activeSection ?? "bazar";

  const [editingBazarId, setEditingBazarId] = useState<string | null>(null);
  const [bazarDate, setBazarDate] = useState("");
  const [bazarAmount, setBazarAmount] = useState("");
  const [bazarDesc, setBazarDesc] = useState("");
  const [bazarMoreOptionsOpen, setBazarMoreOptionsOpen] = useState(false);
  const [bazarBuyerIds, setBazarBuyerIds] = useState<string[]>([]);

  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [depositMemberId, setDepositMemberId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [depositNoteOpen, setDepositNoteOpen] = useState(false);

  const [editingBillField, setEditingBillField] = useState<BillField | null>(
    null
  );
  const [billValue, setBillValue] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [hiddenBazarIds, setHiddenBazarIds] = useState<string[]>([]);
  const [hiddenDepositIds, setHiddenDepositIds] = useState<string[]>([]);
  const [expandedEntryKey, setExpandedEntryKey] = useState<string | null>(null);
  const [billPendingDelete, setBillPendingDelete] = useState<BillField | null>(null);
  const [pendingEntryDelete, setPendingEntryDelete] = useState<{ type: "bazar" | "deposit"; id: string } | null>(null);
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const visibleBazar = useMemo(
    () => bazar.filter((entry) => !hiddenBazarIds.includes(entry.id)),
    [bazar, hiddenBazarIds]
  );
  const visibleDeposits = useMemo(
    () => deposits.filter((entry) => !hiddenDepositIds.includes(entry.id)),
    [deposits, hiddenDepositIds]
  );

  useEffect(() => () => {
    pendingDeletes.current.forEach((timer) => clearTimeout(timer));
  }, []);

  function startEditBazar(entry: BazarEntry) {
    setEditingDepositId(null);
    setEditingBillField(null);
    setEditingBazarId(entry.id);
    setBazarDate(entry.date);
    setBazarAmount(String(entry.amount));
    setBazarDesc(entry.description);
    setBazarMoreOptionsOpen(Boolean(entry.description.trim()));
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
    if (!amount || amount <= 0 || !isDateOnOrBeforeToday(bazarDate)) {
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
    setEditingBazarId(null);
    setEditingBillField(null);
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
    setDepositNoteOpen(Boolean(entry.note.trim()));
  }

  async function saveDeposit(id: string) {
    if (!onEditDeposit) return;
    const amount = Math.round(parseFloat(depositAmount));
    const member = members.find((m) => m.id === depositMemberId);
    if (!amount || amount <= 0 || !member || !isDateOnOrBeforeToday(depositDate)) {
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
    setEditingBazarId(null);
    setEditingDepositId(null);
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

  async function handleDeleteBill() {
    if (!onDeleteBill || !billPendingDelete) return;
    const field = billPendingDelete;
    try {
      await onDeleteBill(field);
      setBillPendingDelete(null);
      toast.success(`${BILL_LABELS[field]} cleared successfully.`);
    } catch (error) {
      console.error("Delete bill failed:", error);
      toast.error(`Failed to clear ${BILL_LABELS[field]}. Please try again.`);
    }
  }

  function queueDeleteBazar(id: string) {
    if (!onDeleteBazar) return;
    setHiddenBazarIds((previous) => [...previous, id]);
    const timer = setTimeout(async () => {
      try {
        await onDeleteBazar(id);
        setHiddenBazarIds((previous) => previous.filter((itemId) => itemId !== id));
      } catch (deleteError) {
        console.error("Delete bazar entry failed:", deleteError);
        setHiddenBazarIds((previous) => previous.filter((itemId) => itemId !== id));
        error("Failed to delete bazar entry.");
      }
      pendingDeletes.current.delete(`bazar-${id}`);
    }, 5000);
    pendingDeletes.current.set(`bazar-${id}`, timer);
    undo("Bazar entry deleted", () => {
      const pendingTimer = pendingDeletes.current.get(`bazar-${id}`);
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingDeletes.current.delete(`bazar-${id}`);
      setHiddenBazarIds((previous) => previous.filter((itemId) => itemId !== id));
    });
  }

  function queueDeleteDeposit(id: string) {
    if (!onDeleteDeposit) return;
    setHiddenDepositIds((previous) => [...previous, id]);
    const timer = setTimeout(async () => {
      try {
        await onDeleteDeposit(id);
        setHiddenDepositIds((previous) => previous.filter((itemId) => itemId !== id));
      } catch (deleteError) {
        console.error("Delete deposit entry failed:", deleteError);
        setHiddenDepositIds((previous) => previous.filter((itemId) => itemId !== id));
        error("Failed to delete deposit entry.");
      }
      pendingDeletes.current.delete(`deposit-${id}`);
    }, 5000);
    pendingDeletes.current.set(`deposit-${id}`, timer);
    undo("Deposit entry deleted", () => {
      const pendingTimer = pendingDeletes.current.get(`deposit-${id}`);
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingDeletes.current.delete(`deposit-${id}`);
      setHiddenDepositIds((previous) => previous.filter((itemId) => itemId !== id));
    });
  }

  function requestDeleteEntry(type: "bazar" | "deposit", id: string) {
    setPendingEntryDelete({ type, id });
  }

  function confirmDeleteEntry() {
    if (!pendingEntryDelete) return;
    if (pendingEntryDelete.type === "bazar") {
      queueDeleteBazar(pendingEntryDelete.id);
    } else {
      queueDeleteDeposit(pendingEntryDelete.id);
    }
    setPendingEntryDelete(null);
  }

  const closeEditSheet = useCallback(() => {
    setEditingBazarId(null);
    setEditingDepositId(null);
    setEditingBillField(null);
  }, []);

  function renderBazarEditor(entry: BazarEntry) {
    return (
      <div className="space-y-3">
        <PremiumDatePicker value={bazarDate} onChange={setBazarDate} label="Date" maxDate={getTodayDateString()} />
        <input
          type="number"
          placeholder="Amount (৳)"
          value={bazarAmount}
          onChange={(event) => setBazarAmount(event.target.value)}
          className={`${inputClass} tabular-nums`}
        />
        <div className="space-y-2">
          <span className="block text-xs font-medium text-secondary">Quick item</span>
          <div className="flex flex-wrap gap-2">
            {bazarQuickPicks.map((item) => (
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
          aria-controls={`bazar-editor-options-${entry.id}`}
          onClick={() => setBazarMoreOptionsOpen((open) => !open)}
          className="tactile-press inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover"
        >
          {bazarMoreOptionsOpen ? "Hide description" : "More options"}
          <span className={`transition-transform duration-150 ${bazarMoreOptionsOpen ? "rotate-180" : ""}`}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
        {bazarMoreOptionsOpen ? (
          <div id={`bazar-editor-options-${entry.id}`} className="optional-fields-reveal">
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-secondary">Description (optional)</span>
              <input
                type="text"
                value={bazarDesc}
                onChange={(event) => setBazarDesc(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        ) : null}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted">Buyers</label>
          <div className="flex flex-wrap gap-2">
            {activeMembers.map((member) => {
              const isSelected = bazarBuyerIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleBazarBuyerSelection(member.id)}
                  aria-pressed={isSelected}
                  className={`clay-pill border px-3 py-1.5 text-xs font-medium transition ${
                    isSelected
                      ? "border-brand bg-brand text-brand-on-fill"
                      : "border-subtle bg-elevated/60 text-secondary hover:border-brand hover:bg-kpi-sage"
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
            className="clay-pill tactile-press flex h-9 items-center gap-1 bg-brand px-3 text-sm font-medium text-brand-on-fill disabled:opacity-60"
          >
            {saving === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={closeEditSheet}
            className="tactile-press flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-secondary transition-colors hover:bg-container"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function renderDepositEditor(entry: DepositEntry) {
    return (
      <div className="space-y-3">
        <select
          value={depositMemberId}
          onChange={(event) => setDepositMemberId(event.target.value)}
          className={inputClass}
          aria-label="Member"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
              {member.status === "inactive" ? " (Inactive)" : ""}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Amount (৳)"
          value={depositAmount}
          onChange={(event) => setDepositAmount(event.target.value)}
          className={`${inputClass} tabular-nums`}
        />
        <div className="-mt-1 flex flex-wrap gap-2" role="group" aria-label="Common deposit amounts">
          {depositQuickAmounts.map((amount) => (
            <button
              key={amount}
              type="button"
              aria-pressed={depositAmount === String(amount)}
              onClick={() => setDepositAmount(String(amount))}
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
        <PremiumDatePicker value={depositDate} onChange={setDepositDate} label="Date" maxDate={getTodayDateString()} />
        <button
          type="button"
          aria-expanded={depositNoteOpen}
          aria-controls={`deposit-editor-note-${entry.id}`}
          onClick={() => setDepositNoteOpen((open) => !open)}
          className="tactile-press inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover"
        >
          {depositNoteOpen ? "Hide note" : "Add note"}
          <span className={`transition-transform duration-150 ${depositNoteOpen ? "rotate-180" : ""}`}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
        {depositNoteOpen ? (
          <label id={`deposit-editor-note-${entry.id}`} className="optional-fields-reveal block space-y-1">
            <span className="block text-xs font-medium text-secondary">Note (optional)</span>
            <input
              type="text"
              value={depositNote}
              onChange={(event) => setDepositNote(event.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => saveDeposit(entry.id)}
            disabled={saving === entry.id}
            className="clay-pill tactile-press flex h-9 items-center gap-1 bg-brand px-3 text-sm font-medium text-brand-on-fill disabled:opacity-60"
          >
            {saving === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={closeEditSheet}
            className="tactile-press flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-secondary transition-colors hover:bg-container"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function renderBillEditor(field: BillField) {
    return (
      <div className="space-y-3">
        <input
          type="number"
          value={billValue}
          onChange={(event) => setBillValue(event.target.value)}
          className={`${inputClass} tabular-nums`}
          placeholder="Amount (৳)"
          aria-label={BILL_LABELS[field]}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => saveBill(field)}
            disabled={saving === field}
            className="clay-pill tactile-press flex h-9 items-center gap-1 bg-brand px-3 text-sm font-medium text-brand-on-fill disabled:opacity-60"
          >
            {saving === field ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={closeEditSheet}
            className="tactile-press flex h-9 items-center gap-1 rounded-lg px-3 text-sm text-secondary transition-colors hover:bg-container"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const billFields: BillField[] = ["houseRent", "buaBill", "otherBills"];
  const editingBazarEntry = visibleBazar.find((entry) => entry.id === editingBazarId);
  const editingDepositEntry = visibleDeposits.find((entry) => entry.id === editingDepositId);
  const editSheetTitle = selectedSection === "bazar" && editingBazarEntry
    ? "Edit bazar entry"
    : selectedSection === "deposits" && editingDepositEntry
      ? "Edit deposit"
      : selectedSection === "bills" && editingBillField
        ? `Edit ${BILL_LABELS[editingBillField]}`
        : "";
  const sectionDetails = selectedSection === "bazar"
    ? {
      title: "Bazar Log",
      description: "Review monthly spending, dates, and buyers.",
      count: visibleBazar.length,
      badgeClass: "bg-warning-surface text-warning-on-surface",
    }
    : selectedSection === "deposits"
      ? {
        title: "Deposit Log",
        description: "Review member deposits and notes.",
        count: visibleDeposits.length,
        badgeClass: "bg-kpi-sage text-brand-secondary",
      }
      : {
        title: "Monthly Fixed Bills",
        description: "Review shared household charges for this month.",
        count: billFields.length,
        badgeClass: "bg-kpi-terracotta text-brand",
      };

  return (
    <div className="space-y-4">
      <DashboardSectionHeader
        title={sectionDetails.title}
        description={sectionDetails.description}
        action={
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${sectionDetails.badgeClass}`}>
            {sectionDetails.count} {sectionDetails.count === 1 ? "item" : "items"}
          </span>
        }
      />
      {selectedSection !== "bills" ? (
        <div className="space-y-4">
          {selectedSection === "bazar" ? (
            <div id="bazar-log" className="bazar-responsive-container clay-card min-w-0 overflow-hidden">
              {visibleBazar.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <EmptyState
                    icon={ReceiptText}
                    title="No bazar records found"
                    description="Add a bazar entry to get started."
                    actionButtonLabel={onAddBazar ? "Add expense" : undefined}
                    onAction={onAddBazar}
                  />
                </div>
              ) : (
                <ul className="flex flex-col gap-2 px-2 py-2 sm:px-4">
                  <AnimatePresence initial={false}>
                    {visibleBazar.map((entry) => {
                    const rowKey = `bazar-${entry.id}`;
                    const isExpanded = expandedEntryKey === rowKey;
                    return (
                      <motion.li
                        key={entry.id}
                        layout={!reduceMotion}
                        initial={false}
                        exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={reduceMotion ? { duration: 0 } : {
                          layout: { type: "spring", stiffness: 480, damping: 38 },
                          height: { duration: 0.18, ease: "easeOut" },
                          opacity: { duration: 0.12 },
                        }}
                        className="min-w-0 overflow-hidden"
                      >
                        {editingBazarId === entry.id && !isMobileViewport ? (
                          <div className="rounded-xl border border-subtle bg-surface p-3">
                            {renderBazarEditor(entry)}
                          </div>
                        ) : (
                          <SwipeableListItem
                            onEdit={() => startEditBazar(entry)}
                            onDelete={() => requestDeleteEntry("bazar", entry.id)}
                            editLabel="Edit bazar entry"
                            deleteLabel="Delete bazar entry"
                            className="rounded-xl"
                          >
                            <div className="space-y-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <button
                                  type="button"
                                  aria-expanded={isExpanded}
                                  aria-controls={isExpanded ? `details-${rowKey}` : undefined}
                                  onClick={() => setExpandedEntryKey(isExpanded ? null : rowKey)}
                                  className="tactile-press flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                                >
                                  <span className="truncate text-sm font-semibold text-primary">
                                    {entry.description || "Bazar expense"}
                                  </span>
                                  <span className="min-w-[7rem] shrink-0 text-right text-base font-bold tabular-nums text-primary">
                                    ৳{formatCurrency(entry.amount)}
                                  </span>
                                </button>
                                {isAdmin && (
                                  <div className="bazar-inline-actions shrink-0">
                                    <InlineActions
                                      onEdit={() => startEditBazar(entry)}
                                      onDelete={() => requestDeleteEntry("bazar", entry.id)}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex min-w-0 items-center gap-3 text-xs text-secondary">
                                <span className="shrink-0 tabular-nums">Date: {entry.date}</span>
                                <span className="min-w-0 truncate">Buyers: {buyerNames(entry)}</span>
                              </div>
                              {isExpanded && (
                                <section
                                  id={`details-${rowKey}`}
                                  className="bazar-entry-details is-expanded row-detail-reveal border-t border-subtle pt-3"
                                  aria-label="Bazar entry details"
                                >
                                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                                    <div>
                                      <dt className="text-xs text-muted">Description</dt>
                                      <dd className="break-words font-medium">{entry.description || "Bazar expense"}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-muted">Amount</dt>
                                      <dd className="font-semibold tabular-nums">৳{formatCurrency(entry.amount)}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-muted">Date</dt>
                                      <dd className="tabular-nums">{entry.date}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-muted">Buyers</dt>
                                      <dd className="break-words">{buyerNames(entry)}</dd>
                                    </div>
                                  </dl>
                                  {isAdmin && (
                                    <div className="mt-3 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startEditBazar(entry)}
                                        className="clay-pill tactile-press bg-brand px-3 py-2 text-sm font-medium text-brand-on-fill"
                                      >
                                        Edit entry
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => requestDeleteEntry("bazar", entry.id)}
                                        className="tactile-press rounded-lg bg-danger-fill px-3 py-2 text-sm font-medium text-danger-on-fill"
                                      >
                                        Delete entry
                                      </button>
                                    </div>
                                  )}
                                </section>
                              )}
                            </div>
                          </SwipeableListItem>
                        )}
                      </motion.li>
                    );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          ) : null}

          {selectedSection === "deposits" ? (
            <div id="deposit-log" className="bazar-responsive-container clay-card min-w-0 overflow-hidden">
              {visibleDeposits.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <EmptyState
                    icon={Wallet2}
                    title="No deposits found"
                    description="Deposit activity will show up here."
                    actionButtonLabel={onAddDeposit ? "Add deposit" : undefined}
                    onAction={onAddDeposit}
                  />
                </div>
              ) : (
                <ul className="flex flex-col gap-2 px-2 py-2 sm:px-4">
                  <AnimatePresence initial={false}>
                    {visibleDeposits.map((entry) => {
                    const rowKey = `deposit-${entry.id}`;
                    const isExpanded = expandedEntryKey === rowKey;
                    return (
                      <motion.li
                        key={entry.id}
                        layout={!reduceMotion}
                        initial={false}
                        exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={reduceMotion ? { duration: 0 } : {
                          layout: { type: "spring", stiffness: 480, damping: 38 },
                          height: { duration: 0.18, ease: "easeOut" },
                          opacity: { duration: 0.12 },
                        }}
                        className="min-w-0 overflow-hidden"
                      >
                        {editingDepositId === entry.id && !isMobileViewport ? (
                          <div className="rounded-xl border border-subtle bg-surface p-3">
                            {renderDepositEditor(entry)}
                          </div>
                        ) : (
                          <SwipeableListItem
                            onEdit={() => startEditDeposit(entry)}
                            onDelete={() => requestDeleteEntry("deposit", entry.id)}
                            editLabel="Edit deposit"
                            deleteLabel="Delete deposit"
                            className="rounded-xl"
                          >
                            <div className="space-y-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <button
                                  type="button"
                                  aria-expanded={isExpanded}
                                  aria-controls={isExpanded ? `details-${rowKey}` : undefined}
                                  onClick={() => setExpandedEntryKey(isExpanded ? null : rowKey)}
                                  className="tactile-press flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                                >
                                  <span className="truncate text-sm font-semibold text-primary">
                                    {entry.memberName}
                                  </span>
                                  <span className="min-w-[7rem] shrink-0 text-right text-base font-bold tabular-nums text-primary">
                                    ৳{formatCurrency(entry.amount)}
                                  </span>
                                </button>
                                {isAdmin && (
                                  <div className="bazar-inline-actions shrink-0">
                                    <InlineActions
                                      onEdit={() => startEditDeposit(entry)}
                                      onDelete={() => requestDeleteEntry("deposit", entry.id)}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex min-w-0 items-center gap-3 text-xs text-secondary">
                                <span className="shrink-0 tabular-nums">Paid: {entry.date}</span>
                                {entry.note ? <span className="min-w-0 max-w-[55%] truncate">Note: {entry.note}</span> : null}
                              </div>
                              {isExpanded && (
                                <section
                                  id={`details-${rowKey}`}
                                  className="bazar-entry-details is-expanded row-detail-reveal border-t border-subtle pt-3"
                                  aria-label="Deposit entry details"
                                >
                                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                                    <div>
                                      <dt className="text-xs text-muted">Member</dt>
                                      <dd className="break-words font-medium">{entry.memberName}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-muted">Deposit amount</dt>
                                      <dd className="font-semibold tabular-nums">৳{formatCurrency(entry.amount)}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-muted">Paid date</dt>
                                      <dd className="tabular-nums">{entry.date}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-xs text-muted">Note</dt>
                                      <dd className="break-words">{entry.note || "No note"}</dd>
                                    </div>
                                  </dl>
                                  {isAdmin && (
                                    <div className="mt-3 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startEditDeposit(entry)}
                                        className="clay-pill tactile-press bg-brand px-3 py-2 text-sm font-medium text-brand-on-fill"
                                      >
                                        Edit entry
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => requestDeleteEntry("deposit", entry.id)}
                                        className="tactile-press rounded-lg bg-danger-fill px-3 py-2 text-sm font-medium text-danger-on-fill"
                                      >
                                        Delete entry
                                      </button>
                                    </div>
                                  )}
                                </section>
                              )}
                            </div>
                          </SwipeableListItem>
                        )}
                      </motion.li>
                    );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {isAdmin && selectedSection === "bills" && (
        <div id="fixed-bills-log" className="clay-card min-w-0 overflow-hidden">
          <ul className="divide-y divide-subtle/60">
            {billFields.map((field) => (
              <li key={field} className="px-4 py-3 transition-colors duration-150 hover:bg-elevated dark:hover:bg-elevated/40 sm:px-6">
                {editingBillField === field && !isMobileViewport ? (
                  <div className="max-w-lg">{renderBillEditor(field)}</div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {field === "otherBills" && bills.otherBillsDescription
                          ? bills.otherBillsDescription
                          : BILL_LABELS[field]}
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        ৳{formatCurrency(bills[field])}
                      </p>
                    </div>
                    {isAdmin && bills[field] > 0 && (
                      <InlineActions
                        onEdit={() => startEditBill(field)}
                        onDelete={() => setBillPendingDelete(field)}
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
      <ResponsiveEditSheet
        open={
          isMobileViewport &&
          ((selectedSection === "bazar" && Boolean(editingBazarEntry)) ||
            (selectedSection === "deposits" && Boolean(editingDepositEntry)) ||
            (selectedSection === "bills" && Boolean(editingBillField)))
        }
        title={editSheetTitle}
        onClose={closeEditSheet}
      >
        {selectedSection === "bazar" && editingBazarEntry
          ? renderBazarEditor(editingBazarEntry)
          : selectedSection === "deposits" && editingDepositEntry
            ? renderDepositEditor(editingDepositEntry)
            : selectedSection === "bills" && editingBillField
              ? renderBillEditor(editingBillField)
              : null}
      </ResponsiveEditSheet>
      <DeleteConfirmationModal
        open={Boolean(billPendingDelete)}
        title="Clear this bill?"
        description={billPendingDelete ? `Clear ${BILL_LABELS[billPendingDelete]} for this month? This shared amount will be removed immediately.` : ""}
        confirmLabel="Yes, clear bill"
        onConfirm={handleDeleteBill}
        onCancel={() => setBillPendingDelete(null)}
      />
      <DeleteConfirmationModal
        open={Boolean(pendingEntryDelete)}
        title="Delete this bazar or deposit entry?"
        confirmLabel="Yes, delete entry"
        onConfirm={confirmDeleteEntry}
        onCancel={() => setPendingEntryDelete(null)}
      />
    </div>
  );
});
