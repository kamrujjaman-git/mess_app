"use client";

import {
  TrendingUp,
  ShoppingCart,
  Utensils,
  Home,
  Wallet,
} from "lucide-react";
import type { MessStats, MonthBills } from "@/lib/mess";

interface OverviewCardsProps {
  stats: MessStats;
  bills: MonthBills;
  isAdmin?: boolean;
}

export function OverviewCards({ stats, bills, isAdmin = false }: OverviewCardsProps) {
  const remainingBalance = stats.remainingBalance;
  const balanceCard = {
    label: "Meal Balance",
    value: `৳${Math.abs(remainingBalance).toLocaleString()}`,
    sub: remainingBalance >= 0 ? "in mess cash" : "negative balance / due",
    icon: Wallet,
    color:
      remainingBalance >= 0
        ? "from-emerald-500 to-teal-600"
        : "from-rose-500 to-red-600",
  };

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
    balanceCard,
    {
      label: "Rent + Bua",
      value: `৳${Math.round(bills.houseRent + bills.buaBill)}`,
      sub: "fixed costs",
      icon: Home,
      color: "from-orange-500 to-amber-600",
    },
  ];

  const visibleCards = isAdmin ? cards : cards.filter((card) => card.label !== "Rent + Bua");
  const gridClassName = isAdmin
    ? "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
    : "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4";

  return (
    <div className={gridClassName}>
      {visibleCards.map((card) => (
        <div key={card.label} className="glass-card rounded-2xl p-3.5 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              {card.label}
            </span>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} shadow-sm`}
            >
              <card.icon className="h-4.5 w-4.5 text-white" />
            </div>
          </div>
          <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
            {card.value}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {card.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
