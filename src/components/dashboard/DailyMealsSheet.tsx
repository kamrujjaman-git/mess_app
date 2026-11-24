"use client";

import { Fragment, memo, useMemo, useRef, useState, type MouseEvent } from "react";
import { toast } from "react-hot-toast";
import { ShieldAlert } from "lucide-react";
import type { DailyMealRecord, Member, MemberMeals } from "@/lib/mess";
import { getActiveMembers } from "@/lib/mess";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

interface DailyMealsSheetProps {
  records: DailyMealRecord[];
  members: Member[];
  selectedMonthKey: string;
  isAdmin?: boolean;
  onEdit?: (date: string, meals: Record<string, MemberMeals>) => Promise<void>;
  onOptimisticToggle?: (date: string, memberId: string, mealType: keyof MemberMeals, nextStatus: boolean) => void;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const DailyMealsSheet = memo(function DailyMealsSheet({
  records,
  members,
  selectedMonthKey,
  isAdmin = false,
  onEdit,
  onOptimisticToggle,
}: DailyMealsSheetProps) {
  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const recordsByDate = useMemo(() => {
    const recordsByDate = new Map<string, DailyMealRecord>();
    for (const record of records) {
      if (!recordsByDate.has(record.date)) {
        recordsByDate.set(record.date, record);
      }
    }
    return recordsByDate;
  }, [records]);
  const [draftMeals, setDraftMeals] = useState<Record<string, Record<string, MemberMeals>>>({});
  const [saving, setSaving] = useState(false);
  const togglingMealCells = useRef<Record<string, boolean>>({});
  const todayKey = getDateKey(new Date());
  function canEditRecord(recordDate: string) {
    return isAdmin && recordDate.startsWith(selectedMonthKey) && recordDate <= todayKey;
  }

  function canEditCell(recordDate: string) {
    return canEditRecord(recordDate);
  }

  const mealLockBanner = !isAdmin
    ? "Meal entries are read-only for members."
    : "Future dates are locked. Only today and past dates can be edited.";

  const displayRows = useMemo(() => {
    const [year, month] = selectedMonthKey.split("-").map(Number);
    const daysInSelectedMonth = new Date(year, month, 0).getDate();
    const rows: Array<{ date: string; label: string }> = [];

    for (let day = 1; day <= daysInSelectedMonth; day += 1) {
      const cursor = new Date(year, month - 1, day);
      const dateKey = getDateKey(cursor);
      rows.push({ date: dateKey, label: dateKey === todayKey ? "Today" : dateKey.slice(5) });
    }

    return rows;
  }, [selectedMonthKey, todayKey]);

  function getRecordForDate(date: string): DailyMealRecord {
    return recordsByDate.get(date) ?? { date, meals: {} };
  }

  function getDraftMealValue(record: DailyMealRecord, memberId: string, field: keyof MemberMeals) {
    const memberDraft = draftMeals[record.date]?.[memberId];
    if (memberDraft) {
      return memberDraft[field] ?? 0;
    }
    return record.meals[memberId]?.[field] ?? 0;
  }

  function handleMealToggleClick(
    event: MouseEvent<HTMLButtonElement>,
    record: DailyMealRecord,
    member: Member,
    field: keyof MemberMeals
  ) {
    event.preventDefault();
    event.stopPropagation();
    void toggleMealCell(record, member, field);
  }

  async function toggleMealCell(record: DailyMealRecord, member: Member, field: keyof MemberMeals) {
    if (!canEditCell(record.date)) return;

    const toggleKey = `${record.date}:${member.id}:${field}`;
    if (togglingMealCells.current[toggleKey]) return;
    togglingMealCells.current[toggleKey] = true;

    const memberId = member.id;
    const currentValue = getDraftMealValue(record, memberId, field) ?? 0;
    const nextValue = currentValue > 0 ? 0 : 1;
    const currentDraft = draftMeals[record.date] ?? {};
    const nextDraft = {
      ...currentDraft,
      [memberId]: {
        ...(currentDraft[memberId] ?? record.meals[memberId] ?? { breakfast: 0, lunch: 0, dinner: 0 }),
        [field]: nextValue,
      },
    } as Record<string, MemberMeals>;

    setDraftMeals((prev) => ({ ...prev, [record.date]: nextDraft }));
    onOptimisticToggle?.(record.date, memberId, field, nextValue === 1);

    if (!onEdit) {
      togglingMealCells.current[toggleKey] = false;
      return;
    }

    const mergedMeals = {
      ...record.meals,
      ...Object.fromEntries(Object.entries(nextDraft).map(([id, meals]) => [id, meals])),
    } as Record<string, MemberMeals>;

    setSaving(true);
    try {
      await onEdit(record.date, mergedMeals);
      setDraftMeals((previous) => {
        const next = { ...previous };
        delete next[record.date];
        return next;
      });
      toast.success("Meal sheet updated.");
    } catch (error) {
      console.error("Firestore Save Error:", error);
      setDraftMeals((previous) => {
        const next = { ...previous };
        if (Object.keys(currentDraft).length > 0) {
          next[record.date] = currentDraft;
        } else {
          delete next[record.date];
        }
        return next;
      });
      onOptimisticToggle?.(record.date, memberId, field, currentValue > 0);
      toast.error("Failed to save meal selection. Please try again.");
    } finally {
      setSaving(false);
      togglingMealCells.current[toggleKey] = false;
    }
  }

  return (
    <div className="space-y-4">
      <DashboardSectionHeader
        title="Daily Meal Sheet"
        description="Review meal entries by date and member."
      />
      <div className="glass-card rounded-2xl">
      {mealLockBanner && (
        <div className="flex items-center gap-2 border-b border-warning-border bg-warning-surface px-4 py-3 text-sm font-medium leading-relaxed text-warning-on-surface sm:px-6">
          <ShieldAlert className="h-4 w-4" />
          <span>{mealLockBanner}</span>
        </div>
      )}

      <div className="custom-scrollbar hidden max-h-[70vh] overflow-auto overscroll-contain rounded-b-2xl lg:block">
        <table className="w-full min-w-max table-fixed border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-primary">
              <th className="sticky left-0 top-0 z-30 h-12 w-28 border-b-2 border-subtle bg-container px-4 py-0 font-bold leading-none sm:px-6 dark:border-subtle dark:bg-elevated">
                DATE
              </th>
              {activeMembers.map((member) => (
                <th
                  key={member.id}
                  colSpan={3}
                  title={member.name}
                  className="sticky top-0 z-20 h-12 min-w-[10.5rem] overflow-hidden border-b-2 border-subtle bg-container px-2 py-0 text-center font-bold leading-none dark:border-subtle dark:bg-elevated"
                >
                  <span className="block truncate">{member.name}</span>
                </th>
              ))}
            </tr>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-secondary dark:text-secondary">
              <th className="sticky left-0 top-12 z-30 h-10 w-28 border-b border-subtle bg-elevated px-4 py-0 leading-none sm:px-6 dark:border-subtle dark:bg-elevated" />
              {activeMembers.map((member) => (
                <Fragment key={member.id}>
                  <th className="sticky top-12 z-20 h-10 w-14 border-b border-subtle bg-elevated px-1 py-0 text-center font-bold leading-none dark:border-subtle dark:bg-elevated">B</th>
                  <th className="sticky top-12 z-20 h-10 w-14 border-b border-subtle bg-elevated px-1 py-0 text-center font-bold leading-none dark:border-subtle dark:bg-elevated">L</th>
                  <th className="sticky top-12 z-20 h-10 w-14 border-b border-subtle bg-elevated px-1 py-0 text-center font-bold leading-none dark:border-subtle dark:bg-elevated">D</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const record = getRecordForDate(row.date);
              const isPast = row.date < todayKey;
              const isFuture = row.date > todayKey;
              const isTodayRow = row.label === "Today";
              return (
                <tr key={row.date} className={`border-b border-subtle last:border-0 ${isTodayRow ? "bg-success-surface/70" : isFuture ? "bg-elevated/60 text-muted" : ""}`}>
                  <td className={`sticky left-0 z-10 w-28 whitespace-nowrap px-4 py-2.5 font-medium sm:px-6 ${isTodayRow ? "bg-success-surface" : isFuture ? "bg-elevated" : "bg-surface"}`}>
                    <div className="flex flex-col">
                      <span>{row.label}</span>
                      {!isPast && row.label !== "Today" && (
                        <span className="text-[11px] font-normal tabular-nums text-muted">{record.date.slice(5)}</span>
                      )}
                      {row.label === "Today" && (
                        <span className="text-[11px] font-normal tabular-nums text-muted">{todayKey.slice(5)}</span>
                      )}
                    </div>
                  </td>
                  {activeMembers.map((member) => (
                    <Fragment key={member.id}>
                      {(["breakfast", "lunch", "dinner"] as const).map((field) => {
                        const isEditable = canEditCell(record.date);
                        const isActive = (getDraftMealValue(record, member.id, field) ?? 0) > 0;
                        return (
                          <td key={field} className="w-14 px-1 py-2.5 text-center">
                            {isEditable ? (
                              <button
                                type="button"
                                onClick={(event) => handleMealToggleClick(event, record, member, field)}
                                disabled={saving}
                                className={`mx-auto flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-full border px-2 text-[11px] font-semibold tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${isActive
                                  ? "border-brand-fill bg-brand-fill text-brand-on-fill shadow-sm"
                                  : "border-subtle bg-surface text-secondary hover:border-brand hover:bg-success-surface"
                                  }`}
                              >
                                {isActive ? "ON" : "OFF"}
                              </button>
                            ) : (
                              <div
                                className={`mx-auto flex h-10 min-w-10 items-center justify-center rounded-full border px-2 text-[11px] font-medium tabular-nums ${isActive
                                  ? "border-success-border bg-success-surface text-success-on-surface"
                                  : "border-subtle/70 bg-container text-secondary"
                                  }`}
                              >
                                {isActive ? "ON" : "—"}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </Fragment>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="relative space-y-4 p-4 lg:hidden">
        {displayRows.map((row) => {
          const record = getRecordForDate(row.date);
          const isTodayRow = row.label === "Today";
          const isFuture = row.date > todayKey;
          return (
            <div key={row.date} className={`rounded-xl border p-4 ${isTodayRow ? "border-success-border bg-success-surface/70" : isFuture ? "border-subtle/60 bg-elevated/60 text-muted" : "border-transparent bg-surface/50 dark:bg-elevated/40"}`}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold tabular-nums">{row.label} · {row.label === "Today" ? todayKey.slice(5) : row.label}</p>
              </div>
              <div className="space-y-3">
                {activeMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{member.name}</span>
                    <div className="flex gap-2">
                      {(["breakfast", "lunch", "dinner"] as const).map((field) => {
                        const isEditable = canEditCell(record.date);
                        const isActive = (getDraftMealValue(record, member.id, field) ?? 0) > 0;
                        return isEditable ? (
                          <button
                            key={field}
                            type="button"
                            onClick={(event) => handleMealToggleClick(event, record, member, field)}
                            disabled={saving}
                            className={`h-10 min-w-10 cursor-pointer rounded-full border px-2 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${isActive
                              ? "border-brand-fill bg-brand-fill text-brand-on-fill"
                              : "border-subtle bg-surface text-secondary hover:border-brand hover:bg-success-surface"
                              }`}
                          >
                            {field[0].toUpperCase()}
                          </button>
                        ) : (
                          <div
                            key={field}
                            className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-2 text-[11px] font-semibold ${isActive
                              ? "border-success-border bg-success-surface text-success-on-surface"
                              : "border-subtle/70 bg-container text-secondary"
                              }`}
                          >
                            {field[0].toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
});
