"use client";

import { TrendingUp, ShoppingCart, Utensils, Home } from "lucide-react";
import type { MessStats, MonthBills } from "@/lib/mess";

interface OverviewCardsProps {
  stats: MessStats;
  bills: MonthBills;
}

export function OverviewCards({ stats, bills }: OverviewCardsProps) {
  const cards = [
    {
      label: "Meal Rate",
      value: `৳${stats.mealRate}`,
      sub: "per meal",
      icon: TrendingUp,
      color: "from-emerald-500 to-teal-600",
    },
    {
      label: "Total Bazar",
      value: `৳${stats.totalBazar}`,
      sub: "this month",
      icon: ShoppingCart,
      color: "from-blue-500 to-cyan-600",
    },
    {
      label: "Total Meals",
      value: stats.totalMeals.toString(),
      sub: "all members",
      icon: Utensils,
      color: "from-violet-500 to-purple-600",
    },
    {
      label: "Rent + Bua",
      value: `৳${Math.round(bills.houseRent + bills.buaBill)}`,
      sub: "fixed costs",
      icon: Home,
      color: "from-orange-500 to-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              {card.label}
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} shadow-sm`}
            >
              <card.icon className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-xl font-bold sm:text-2xl">{card.value}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {card.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
