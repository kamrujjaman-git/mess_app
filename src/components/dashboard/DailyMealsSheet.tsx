"use client";

import { Fragment, useRef, useState, type MouseEvent } from "react";
import { toast } from "react-hot-toast";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { DailyMealRecord, Member, MemberMeals } from "@/lib/mess";
import { getActiveMembers } from "@/lib/mess";

interface DailyMealsSheetProps {
  records: DailyMealRecord[];
  members: Member[];
  isAdmin?: boolean;
  onEdit?: (date: string, meals: Record<string, MemberMeals>) => Promise<void>;
  onDelete?: (date: string) => Promise<void>;
  onMealUpdated?: () => Promise<void> | void;
  onOptimisticToggle?: (date: string, memberId: string, mealType: keyof MemberMeals, nextStatus: boolean) => void;
}

export function DailyMealsSheet({
  records,
  members,
  isAdmin = false,
  onEdit,
  onDelete,
  onMealUpdated,
  onOptimisticToggle,
}: DailyMealsSheetProps) {
  const { user } = useAuth();
  const activeMembers = getActiveMembers(members);
  const [draftMeals, setDraftMeals] = useState<Record<string, Record<string, MemberMeals>>>({});
  const [saving, setSaving] = useState(false);
  const togglingMealCells = useRef<Record<string, boolean>>({});
  const now = new Date();
  const isAfterElevenFiftyNinePm = now.getHours() > 23 || (now.getHours() === 23 && now.getMinutes() >= 59);
  const currentMember = activeMembers.find(
    (member) => member.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase()
  );
  const currentMemberId = currentMember?.id ?? null;
  const currentUserEmail = user?.email?.trim().toLowerCase() ?? "";
  const currentUserName = currentMember?.name?.trim().toLowerCase() ?? "";

  function isCurrentMemberColumn(member: Member) {
    const memberEmail = member.email?.trim().toLowerCase() ?? "";
    const memberName = member.name?.trim().toLowerCase() ?? "";
    return member.id === currentMemberId || memberEmail === currentUserEmail || memberName === currentUserName;
  }

  function getDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const todayKey = getDateKey(now);
  const tomorrowKey = getDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  function canEditRecord(recordDate: string) {
    if (isAdmin) return true;
    return recordDate === tomorrowKey && !isAfterElevenFiftyNinePm;
  }

  function canEditMember(member: Member) {
    return isAdmin || isCurrentMemberColumn(member);
  }

  function canEditCell(recordDate: string, member: Member) {
    if (!canEditMember(member)) return false;
    return canEditRecord(recordDate);
  }

  const mealLockBanner = !isAdmin && isAfterElevenFiftyNinePm
    ? "Tomorrow's meal selection closed at 11:59 PM."
    : null;

  function buildDisplayRows() {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const rowsLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const rows: Array<{ date: string; label: string }> = [];

    for (let cursor = new Date(monthStart); cursor <= rowsLimit; cursor.setDate(cursor.getDate() + 1)) {
      const dateKey = getDateKey(cursor);
      if (dateKey === todayKey || dateKey === tomorrowKey) {
        continue;
      }
      rows.push({ date: dateKey, label: dateKey.slice(5) });
    }

    rows.push({ date: todayKey, label: "Today" });
    rows.push({ date: tomorrowKey, label: "Tomorrow" });

    return rows;
  }

  const displayRows = buildDisplayRows();

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
    if (!canEditCell(record.date, member)) return;

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
      toast.dismiss();
      toast.success("Meal sheet updated.");
    } catch (error) {
      console.error("Firestore Save Error:", error);
      toast.dismiss();
      toast.error("Failed to save meal selection. Please try again.");
    } finally {
      setSaving(false);
      togglingMealCells.current[toggleKey] = false;
    }
  }

  if (records.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          No daily meal entries yet for this month.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6">
        <h2 className="text-base font-semibold sm:text-lg">Daily Meal Sheet</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Select a date and update meal entries for all members.
        </p>
      </div>

      {mealLockBanner && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 sm:px-6">
          <ShieldAlert className="h-4 w-4" />
          <span>{mealLockBanner}</span>
        </div>
      )}

      <div className="hidden overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] lg:block">
        <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-10 bg-gradient-to-l from-slate-100/80 to-transparent dark:from-slate-900/70 lg:block" />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              <th className="sticky left-0 bg-white/80 px-4 py-3 font-medium backdrop-blur dark:bg-slate-900/80 sm:px-6">
                Date
              </th>
              {activeMembers.map((member) => (
                <th
                  key={member.id}
                  colSpan={3}
                  className="px-2 py-3 text-center font-medium"
                >
                  {member.name}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-200/60 text-left text-[10px] uppercase text-slate-400 dark:border-slate-700/60">
              <th className="sticky left-0 bg-white/80 px-4 py-2 backdrop-blur dark:bg-slate-900/80 sm:px-6" />
              {activeMembers.map((member) => (
                <Fragment key={member.id}>
                  <th className="px-1 py-2 text-center font-normal">B</th>
                  <th className="px-1 py-2 text-center font-normal">L</th>
                  <th className="px-1 py-2 text-center font-normal">D</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const record = records.find((item) => item.date === row.date) ?? { date: row.date, meals: {} } as DailyMealRecord;
              const isPast = row.date < todayKey;
              const isTodayRow = row.label === "Today";
              const isTomorrowRow = row.label === "Tomorrow";
              return (
                <tr key={row.date} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${isTodayRow || isTomorrowRow ? "bg-emerald-50/70 dark:bg-emerald-950/20" : ""}`}>
                  <td className="sticky left-0 whitespace-nowrap bg-white/80 px-4 py-2.5 font-medium backdrop-blur dark:bg-slate-900/80 sm:px-6">
                    <div className="flex flex-col">
                      <span>{row.label}</span>
                      {!isPast && row.label !== "Today" && row.label !== "Tomorrow" && (
                        <span className="text-[11px] font-normal text-slate-400">{record.date.slice(5)}</span>
                      )}
                      {row.label === "Today" && (
                        <span className="text-[11px] font-normal text-slate-400">{todayKey.slice(5)}</span>
                      )}
                      {row.label === "Tomorrow" && (
                        <span className="text-[11px] font-normal text-slate-400">{tomorrowKey.slice(5)}</span>
                      )}
                    </div>
                  </td>
                  {activeMembers.map((member) => (
                    <Fragment key={member.id}>
                      {(["breakfast", "lunch", "dinner"] as const).map((field) => {
                        const isEditable = canEditCell(record.date, member);
                        const isActive = (getDraftMealValue(record, member.id, field) ?? 0) > 0;
                        return (
                          <td key={field} className="px-1 py-2.5 text-center">
                            {isEditable ? (
                              <button
                                type="button"
                                onClick={(event) => handleMealToggleClick(event, record, member, field)}
                                disabled={saving}
                                className={`mx-auto flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-full border px-2 text-[11px] font-semibold transition ${isActive
                                  ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  }`}
                              >
                                {isActive ? "ON" : "OFF"}
                              </button>
                            ) : (
                              <div
                                className={`mx-auto flex h-10 min-w-10 items-center justify-center rounded-full border px-2 text-[11px] font-medium ${isActive
                                  ? "border border-emerald-500/30 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
                                  : "border border-slate-200/70 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
          const record = records.find((item) => item.date === row.date) ?? { date: row.date, meals: {} } as DailyMealRecord;
          const isPast = row.date < todayKey;
          const isTodayRow = row.label === "Today";
          const isTomorrowRow = row.label === "Tomorrow";
          return (
            <div key={row.date} className={`rounded-xl border p-4 ${isTodayRow || isTomorrowRow ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-700 dark:bg-emerald-950/20" : "border-transparent bg-white/50 dark:bg-slate-800/40"}`}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{row.label} · {row.label === "Today" ? todayKey.slice(5) : row.label === "Tomorrow" ? tomorrowKey.slice(5) : row.label}</p>
              </div>
              <div className="space-y-3">
                {activeMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{member.name}</span>
                    <div className="flex gap-2">
                      {(["breakfast", "lunch", "dinner"] as const).map((field) => {
                        const isEditable = canEditCell(record.date, member);
                        const isActive = (getDraftMealValue(record, member.id, field) ?? 0) > 0;
                        return isEditable ? (
                          <button
                            key={field}
                            type="button"
                            onClick={(event) => handleMealToggleClick(event, record, member, field)}
                            disabled={saving}
                            className={`h-10 min-w-10 cursor-pointer rounded-full border px-2 text-[11px] font-semibold ${isActive
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-200 bg-white text-slate-600"
                              }`}
                          >
                            {field[0].toUpperCase()}
                          </button>
                        ) : (
                          <div
                            key={field}
                            className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-2 text-[11px] font-semibold ${isActive
                              ? "border border-emerald-500/30 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
                              : "border border-slate-200/70 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
  );
}
