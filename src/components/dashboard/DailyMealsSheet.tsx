"use client";

import { useState } from "react";
import { Fragment } from "react";
import { Loader2, Save, X } from "lucide-react";
import type { DailyMealRecord, Member, MemberMeals } from "@/lib/mess";
import { getActiveMembers } from "@/lib/mess";
import { InlineActions, inputClass } from "./InlineActions";

interface DailyMealsSheetProps {
  records: DailyMealRecord[];
  members: Member[];
  isAdmin?: boolean;
  onEdit?: (date: string, meals: Record<string, MemberMeals>) => Promise<void>;
  onDelete?: (date: string) => Promise<void>;
}

export function DailyMealsSheet({
  records,
  members,
  isAdmin = false,
  onEdit,
  onDelete,
}: DailyMealsSheetProps) {
  const activeMembers = getActiveMembers(members);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editMeals, setEditMeals] = useState<Record<string, MemberMeals>>({});
  const [saving, setSaving] = useState(false);

  function startEdit(record: DailyMealRecord) {
    setEditingDate(record.date);
    const meals: Record<string, MemberMeals> = {};
    activeMembers.forEach((m) => {
      meals[m.id] = record.meals[m.id] ?? {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
      };
    });
    setEditMeals(meals);
  }

  async function handleSave(date: string) {
    if (!onEdit) return;
    setSaving(true);
    try {
      await onEdit(date, editMeals);
      setEditingDate(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(date: string) {
    if (!onDelete || !confirm(`Delete meal entry for ${date}?`)) return;
    await onDelete(date);
    if (editingDate === date) setEditingDate(null);
  }

  function updateEditMeal(
    memberId: string,
    field: keyof MemberMeals,
    value: string
  ) {
    const num = value === "" ? 0 : parseFloat(value);
    setEditMeals((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: isNaN(num) ? 0 : num,
      },
    }));
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
      </div>

      <div className="hidden overflow-x-auto lg:block">
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
              {isAdmin && (
                <th className="sticky right-0 bg-white/80 px-3 py-3 font-medium backdrop-blur dark:bg-slate-900/80">
                  Actions
                </th>
              )}
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
              {isAdmin && (
                <th className="sticky right-0 bg-white/80 px-3 py-2 backdrop-blur dark:bg-slate-900/80" />
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((record) =>
              editingDate === record.date ? (
                <tr
                  key={record.date}
                  className="border-b border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                >
                  <td className="sticky left-0 bg-emerald-50/80 px-4 py-2 font-medium backdrop-blur dark:bg-emerald-950/40 sm:px-6">
                    {record.date.slice(5)}
                  </td>
                  {activeMembers.map((member) => (
                    <Fragment key={member.id}>
                      {(["breakfast", "lunch", "dinner"] as const).map(
                        (field) => (
                          <td key={field} className="px-1 py-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={editMeals[member.id]?.[field] || ""}
                              onChange={(e) =>
                                updateEditMeal(member.id, field, e.target.value)
                              }
                              className="w-14 rounded-lg border border-slate-200 px-1 py-1 text-center text-xs dark:border-slate-700 dark:bg-slate-800"
                            />
                          </td>
                        )
                      )}
                    </Fragment>
                  ))}
                  <td className="sticky right-0 bg-emerald-50/80 px-2 py-2 backdrop-blur dark:bg-emerald-950/40">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleSave(record.date)}
                        disabled={saving}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                        aria-label="Save"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDate(null)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={record.date}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="sticky left-0 whitespace-nowrap bg-white/80 px-4 py-2.5 font-medium backdrop-blur dark:bg-slate-900/80 sm:px-6">
                    {record.date.slice(5)}
                  </td>
                  {activeMembers.map((member) => {
                    const meals = record.meals[member.id] ?? {
                      breakfast: 0,
                      lunch: 0,
                      dinner: 0,
                    };
                    return (
                      <Fragment key={member.id}>
                        <td className="px-1 py-2.5 text-center">
                          {meals.breakfast || "—"}
                        </td>
                        <td className="px-1 py-2.5 text-center">
                          {meals.lunch || "—"}
                        </td>
                        <td className="px-1 py-2.5 text-center">
                          {meals.dinner || "—"}
                        </td>
                      </Fragment>
                    );
                  })}
                  {isAdmin && (
                    <td className="sticky right-0 bg-white/80 px-2 py-2 backdrop-blur dark:bg-slate-900/80">
                      <InlineActions
                        onEdit={() => startEdit(record)}
                        onDelete={() => handleDelete(record.date)}
                        editLabel={`Edit meals for ${record.date}`}
                        deleteLabel={`Delete meals for ${record.date}`}
                      />
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 p-4 lg:hidden">
        {records.map((record) =>
          editingDate === record.date ? (
            <div
              key={record.date}
              className="rounded-xl border-2 border-emerald-400/50 bg-emerald-50/30 p-4 dark:border-emerald-700/50 dark:bg-emerald-950/20"
            >
              <p className="mb-3 font-semibold">{record.date}</p>
              <div className="space-y-3">
                {activeMembers.map((member) => (
                  <div key={member.id}>
                    <p className="mb-1 text-xs font-medium text-slate-500">
                      {member.name}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["breakfast", "lunch", "dinner"] as const).map(
                        (field) => (
                          <input
                            key={field}
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder={field[0].toUpperCase()}
                            value={editMeals[member.id]?.[field] || ""}
                            onChange={(e) =>
                              updateEditMeal(member.id, field, e.target.value)
                            }
                            className={inputClass}
                          />
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(record.date)}
                  disabled={saving}
                  className="flex flex-1 h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? (
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
                  onClick={() => setEditingDate(null)}
                  className="h-10 rounded-xl px-4 text-sm font-medium text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={record.date}
              className="rounded-xl bg-white/50 p-4 dark:bg-slate-800/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{record.date}</p>
                {isAdmin && (
                  <InlineActions
                    onEdit={() => startEdit(record)}
                    onDelete={() => handleDelete(record.date)}
                  />
                )}
              </div>
              <div className="space-y-2">
                {activeMembers.map((member) => {
                  const meals = record.meals[member.id] ?? {
                    breakfast: 0,
                    lunch: 0,
                    dinner: 0,
                  };
                  const total =
                    meals.breakfast + meals.lunch + meals.dinner;
                  if (total === 0) return null;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">{member.name}</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        B:{meals.breakfast} L:{meals.lunch} D:{meals.dinner}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
