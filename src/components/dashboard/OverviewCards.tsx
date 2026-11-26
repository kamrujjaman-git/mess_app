"use client";

import {
  TrendingUp,
  ShoppingCart,
  Utensils,
  Home,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatCurrency, type MessStats, type MonthBills } from "@/lib/mess";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

interface OverviewCardsProps {
  stats: MessStats;
  bills: MonthBills;
  isAdmin?: boolean;
}

interface OverviewCard {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  tint: "sand" | "terracotta" | "blush" | "sage";
  iconTone?: "sage" | "danger";
  currency?: string;
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
  const balanceCard: OverviewCard = {
    label: "Meal Balance",
    value: formatCurrency(Math.abs(remainingBalance)),
    sub: remainingBalance >= 0 ? "in mess cash" : "negative balance / due",
    icon: Wallet,
    tint: "sand",
    iconTone: remainingBalance >= 0 ? "sage" : "danger",
    currency: "৳",
  };

  const cards: OverviewCard[] = [
    {
      label: "Meal Rate",
      value: formatCurrency(stats.mealRate),
      sub: "per meal",
      icon: TrendingUp,
      tint: "sand",
      currency: "৳",
    },
    {
      label: "Total Bazar",
      value: formatCurrency(stats.totalBazar),
      sub: "this month",
      icon: ShoppingCart,
      tint: "terracotta",
      currency: "৳",
    },
    {
      label: "Total Meals",
      value: formatCurrency(stats.totalMeals),
      sub: "all members",
      icon: Utensils,
      tint: "blush",
      currency: undefined,
    },
    {
      label: "Total Deposits",
      value: formatCurrency(stats.totalDeposits),
      sub: "given this month",
      icon: Wallet,
      tint: "sage",
      currency: "৳",
    },
    balanceCard,
    {
      label: "Rent + Bua",
      value: formatCurrency(bills.houseRent + bills.buaBill),
      sub: "Monthly fixed costs",
      icon: Home,
      tint: "terracotta",
      currency: "৳",
    },
    {
      label: bills.otherBillsDescription || "Other Bills",
      value: formatCurrency(bills.otherBills),
      sub: "Additional fixed costs",
      icon: Home,
      tint: "blush",
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
      <div className="overview-cards-strip -mx-4 grid grid-cols-1 gap-3 px-4 sm:mx-0 sm:gap-4 sm:px-0 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => (
          <div
            key={card.label}
            className={`clay-card kpi-tint-${card.tint} w-full p-3.5 sm:p-5`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium text-secondary sm:text-sm">
                {card.label}
              </span>
              <div className={`kpi-icon ${card.iconTone === "danger" ? "kpi-icon-danger" : ""} flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl`}>
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
            <p className="mt-1 text-xs text-secondary">
              {card.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
