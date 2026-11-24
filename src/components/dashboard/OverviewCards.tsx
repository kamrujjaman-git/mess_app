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
    <span aria-label={value} className="tabular-nums">
      <span aria-hidden="true" className="inline-flex items-baseline tabular-nums">
        {Array.from(value).map((character, index) => {
          if (!/\d/.test(character)) {
            return <span key={`static-${index}-${character}`}>{character}</span>;
          }

          return (
            <span
              key={`digit-${index}`}
              className="relative inline-flex h-[1.2em] min-w-[0.58em] items-center justify-center overflow-hidden align-middle"
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
    value: `৳${formatCurrency(Math.abs(remainingBalance))}`,
    sub: remainingBalance >= 0 ? "in mess cash" : "negative balance / due",
    icon: Wallet,
    color: remainingBalance >= 0 ? "bg-brand-fill" : "bg-danger-fill",
  };

  const cards = [
    {
      label: "Meal Rate",
      value: `৳${formatCurrency(stats.mealRate)}`,
      sub: "per meal",
      icon: TrendingUp,
      color: "bg-brand-fill",
    },
    {
      label: "Total Bazar",
      value: `৳${formatCurrency(stats.totalBazar)}`,
      sub: "this month",
      icon: ShoppingCart,
      color: "bg-brand-fill",
    },
    {
      label: "Total Meals",
      value: formatCurrency(stats.totalMeals),
      sub: "all members",
      icon: Utensils,
      color: "bg-brand-fill",
    },
    {
      label: "Total Deposits",
      value: `৳${formatCurrency(stats.totalDeposits)}`,
      sub: "given this month",
      icon: Wallet,
      color: "bg-brand-fill",
    },
    balanceCard,
    {
      label: "Rent + Bua",
      value: `৳${formatCurrency(bills.houseRent + bills.buaBill)}`,
      sub: "informational fixed costs",
      icon: Home,
      color: "bg-brand-fill",
    },
    {
      label: bills.otherBillsDescription || "Other Bills",
      value: `৳${formatCurrency(bills.otherBills)}`,
      sub: "informational fixed cost",
      icon: Home,
      color: "bg-brand-fill",
    },
  ];

  const visibleCards = isAdmin ? cards : cards.filter((card) => card.label !== "Rent + Bua");

  return (
    <div>
      <DashboardSectionHeader
        title="Overview"
        description="Monthly totals and shared costs at a glance."
      />
      <div className={`overview-cards-strip -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 scrollbar-hide sm:mx-0 sm:grid sm:snap-none sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 ${isAdmin ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-6"}`}>
        {visibleCards.map((card) => (
          <div
            key={card.label}
            className="w-[72%] shrink-0 snap-start rounded-2xl border border-subtle/90 bg-surface p-3.5 shadow-sm transition-colors duration-150 dark:border-subtle/80 dark:bg-surface sm:w-auto sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium text-muted dark:text-muted sm:text-sm">
                {card.label}
              </span>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${card.color}`}>
                <card.icon className="h-4.5 w-4.5 text-white" />
              </div>
            </div>
            <p className="min-w-0 truncate overflow-hidden text-ellipsis whitespace-nowrap text-xl font-bold tabular-nums tracking-tight text-primary sm:text-2xl">
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
