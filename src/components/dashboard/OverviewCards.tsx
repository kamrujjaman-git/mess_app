"use client";

import {
  TrendingUp,
  ShoppingCart,
  Utensils,
  Home,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatCurrency, type MessStats, type MonthBills } from "@/lib/mess";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

interface OverviewCardsProps {
  stats: MessStats;
  bills: MonthBills;
  isAdmin?: boolean;
}

function RollingNumber({ value, reduceMotion }: { value: string; reduceMotion: boolean }) {
  return (
    <span aria-label={value} className="tabular-nums leading-normal">
      <span aria-hidden="true" className="inline-flex items-center tabular-nums leading-normal">
        {Array.from(value).map((character, index) => {
          if (!/\d/.test(character)) {
            return <span key={`static-${index}-${character}`}>{character}</span>;
          }

          return (
            <span
              key={`digit-${index}`}
              className="relative inline-flex h-[1.5em] min-w-[0.62em] items-center justify-center overflow-hidden align-middle leading-normal"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={character}
                  initial={reduceMotion ? false : { y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-100%" }}
                  transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {character}
                </motion.span>
              </AnimatePresence>
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function OverviewCards({ stats, bills, isAdmin = false }: OverviewCardsProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const remainingBalance = stats.remainingBalance;
  const balanceCard = {
    label: "Meal Balance",
    value: formatCurrency(Math.abs(remainingBalance)),
    sub: remainingBalance >= 0 ? "in mess cash" : "negative balance / due",
    icon: Wallet,
    color: remainingBalance >= 0
      ? "bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
    currency: "৳",
  };

  const cards = [
    {
      label: "Meal Rate",
      value: formatCurrency(stats.mealRate),
      sub: "per meal",
      icon: TrendingUp,
      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
      currency: "৳",
    },
    {
      label: "Total Bazar",
      value: formatCurrency(stats.totalBazar),
      sub: "this month",
      icon: ShoppingCart,
      color: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300",
      currency: "৳",
    },
    {
      label: "Total Meals",
      value: formatCurrency(stats.totalMeals),
      sub: "all members",
      icon: Utensils,
      color: "bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
      currency: undefined,
    },
    {
      label: "Total Deposits",
      value: formatCurrency(stats.totalDeposits),
      sub: "given this month",
      icon: Wallet,
      color: "bg-teal-100 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300",
      currency: "৳",
    },
    balanceCard,
    {
      label: "Rent + Bua",
      value: formatCurrency(bills.houseRent + bills.buaBill),
      sub: "Monthly fixed costs",
      icon: Home,
      color: "bg-slate-200 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300",
      currency: "৳",
    },
    {
      label: bills.otherBillsDescription || "Other Bills",
      value: formatCurrency(bills.otherBills),
      sub: "Additional fixed costs",
      icon: Home,
      color: "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
      currency: "৳",
    },
  ];

  const visibleCards = isAdmin ? cards : cards.filter((card) => card.label !== "Rent + Bua");

  return (
    <div>
      <DashboardSectionHeader
        title="Overview"
        description="Monthly totals and shared costs at a glance."
      />
      <div className={`overview-cards-strip -mx-4 grid grid-cols-1 gap-3 px-4 sm:mx-0 sm:gap-4 sm:px-0 min-[420px]:grid-cols-2 lg:grid-cols-3 ${isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-6"}`}>
        {visibleCards.map((card) => (
          <div
            key={card.label}
            className="w-full rounded-2xl border border-subtle/90 bg-surface p-3.5 shadow-sm transition-colors duration-150 dark:border-subtle/80 dark:bg-surface sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium text-muted dark:text-muted sm:text-sm">
                {card.label}
              </span>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${card.color}`}>
                <card.icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="inline-flex min-w-0 items-center gap-1 py-1 leading-none text-xl font-bold tabular-nums tracking-normal text-primary sm:text-2xl">
              {card.currency && (
                <span
                  aria-hidden="true"
                  className="-translate-y-[1.5px] inline-flex shrink-0 items-center text-xl font-bold leading-none sm:text-2xl"
                >
                  {card.currency}
                </span>
              )}
              <RollingNumber value={card.value} reduceMotion={reduceMotion} />
            </p>
            <p className="mt-1 text-xs text-muted dark:text-muted">
              {card.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
