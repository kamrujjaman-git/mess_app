"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
    icon: LucideIcon;
    title?: string;
    description?: string;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title = "No records found for this period",
    description,
    className = "",
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 ${className}`}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
            {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
    );
}
