"use client";

import type { MemberSummary } from "@/lib/mess";

interface SummaryTableProps {
  members: MemberSummary[];
}

function BalanceBadge({ amount }: { amount: number }) {
  if (amount === 0) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        ৳0 Settled
      </span>
    );
  }
  if (amount > 0) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        +৳{amount} Receivable
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
      ৳{Math.abs(amount)} Payable
    </span>
  );
}

export function SummaryTable({ members }: SummaryTableProps) {
  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6">
        <h2 className="text-base font-semibold sm:text-lg">
          Summary &amp; Final Balance
        </h2>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              <th className="px-4 py-3 font-medium sm:px-6">Member</th>
              <th className="px-4 py-3 font-medium">Meals</th>
              <th className="px-4 py-3 font-medium">Deposited</th>
              <th className="px-4 py-3 font-medium">Meal Cost</th>
              <th className="px-4 py-3 font-medium">Rent Share</th>
              <th className="px-4 py-3 font-medium">Final Balance</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                  m.status === "inactive" ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium sm:px-6">
                  <span>{m.name}</span>
                  {m.status === "inactive" && (
                    <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-700">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{m.totalMeals}</td>
                <td className="px-4 py-3">৳{m.totalDeposited}</td>
                <td className="px-4 py-3">৳{m.mealCost}</td>
                <td className="px-4 py-3">৳{m.fixedCostShare}</td>
                <td className="px-4 py-3">
                  <BalanceBadge amount={m.finalBalance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {members.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl bg-white/50 p-4 dark:bg-slate-800/40 ${
              m.status === "inactive" ? "opacity-60" : ""
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">
                {m.name}
                {m.status === "inactive" && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    (Inactive)
                  </span>
                )}
              </span>
              <BalanceBadge amount={m.finalBalance} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Meals</span>
                <p className="font-medium">{m.totalMeals}</p>
              </div>
              <div>
                <span className="text-slate-500">Deposited</span>
                <p className="font-medium">৳{m.totalDeposited}</p>
              </div>
              <div>
                <span className="text-slate-500">Meal Cost</span>
                <p className="font-medium">৳{m.mealCost}</p>
              </div>
              <div>
                <span className="text-slate-500">Rent Share</span>
                <p className="font-medium">৳{m.fixedCostShare}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
