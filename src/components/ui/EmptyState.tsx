"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ShoppingCart, Users, Wallet2 } from "lucide-react";

interface EmptyStateProps {
    icon: LucideIcon;
    title?: string;
    description?: string;
    actionButtonLabel?: string;
    onAction?: () => void;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title = "No records found for this period",
    description,
    actionButtonLabel,
    onAction,
    className = "",
}: EmptyStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200/80 bg-slate-50/90 px-6 py-10 text-center text-slate-600 shadow-sm shadow-slate-200/30 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-950/40 dark:text-slate-300 ${className}`}
        >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-inner shadow-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Icon className="h-7 w-7" />
            </div>
            <div className="max-w-xl">
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</p>
                {description ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 sm:text-base">{description}</p>
                ) : null}
            </div>
            {actionButtonLabel && onAction ? (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition duration-200 hover:bg-emerald-500 active:scale-95"
                >
                    {actionButtonLabel}
                </button>
            ) : null}
        </motion.div>
    );
}

export function NoDepositsEmptyState({ onAction }: { onAction?: () => void }) {
    return (
        <EmptyState
            icon={Wallet2}
            title="No deposits yet"
            description="Once members add their deposits, you’ll see them listed here with amounts and dates."
            actionButtonLabel={onAction ? "Add deposit" : undefined}
            onAction={onAction}
        />
    );
}

export function NoBazarExpensesEmptyState({ onAction }: { onAction?: () => void }) {
    return (
        <EmptyState
            icon={ShoppingCart}
            title="No bazar expenses logged"
            description="Track bazar spending by adding your first expense entry for this month."
            actionButtonLabel={onAction ? "Add expense" : undefined}
            onAction={onAction}
        />
    );
}

export function NoActiveMembersEmptyState({ onAction }: { onAction?: () => void }) {
    return (
        <EmptyState
            icon={Users}
            title="No active members found"
            description="Invite or activate members to start sharing meals, deposits, and bazar expenses."
            actionButtonLabel={onAction ? "Manage members" : undefined}
            onAction={onAction}
        />
    );
}
