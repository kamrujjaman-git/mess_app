"use client";

import { Search, Funnel, X } from "lucide-react";

export interface FilterOption {
    value: string;
    label: string;
}

export interface DateRange {
    start?: string;
    end?: string;
}

export interface SearchFilterBarProps {
    query: string;
    onQueryChange: (query: string) => void;
    monthOptions: FilterOption[];
    selectedMonth?: string;
    onMonthChange: (month: string) => void;
    memberOptions: FilterOption[];
    selectedMember?: string;
    onMemberChange: (member: string) => void;
    categoryOptions: FilterOption[];
    selectedCategory?: string;
    onCategoryChange: (category: string) => void;
    dateRange: DateRange;
    onDateRangeChange: (range: DateRange) => void;
    onClearAll: () => void;
    className?: string;
}

export function SearchFilterBar({
    query,
    onQueryChange,
    monthOptions,
    selectedMonth,
    onMonthChange,
    memberOptions,
    selectedMember,
    onMemberChange,
    categoryOptions,
    selectedCategory,
    onCategoryChange,
    dateRange,
    onDateRangeChange,
    onClearAll,
    className = "",
}: SearchFilterBarProps) {
    const hasActiveFilters =
        !!selectedMonth || !!selectedMember || !!selectedCategory || !!dateRange.start || !!dateRange.end;

    return (
        <div className={`space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm shadow-slate-200/50 backdrop-blur dark:border-slate-700/80 dark:bg-slate-950/40 dark:shadow-slate-950/20 ${className}`}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="relative block">
                    <span className="sr-only">Search</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Search members, deposit notes, expense titles..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/90 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                    />
                </label>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                        <Funnel className="h-4 w-4 text-slate-500" />
                        <span className="font-medium">Filters</span>
                    </div>
                    <button
                        type="button"
                        disabled={!hasActiveFilters}
                        onClick={onClearAll}
                        className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800"
                    >
                        Clear All
                    </button>
                </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Month
                    <select
                        value={selectedMonth ?? ""}
                        onChange={(event) => onMonthChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/90 py-3 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                    >
                        <option value="">All months</option>
                        {monthOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Member
                    <select
                        value={selectedMember ?? ""}
                        onChange={(event) => onMemberChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/90 py-3 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                    >
                        <option value="">All members</option>
                        {memberOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Category
                    <select
                        value={selectedCategory ?? ""}
                        onChange={(event) => onCategoryChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/90 py-3 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                    >
                        <option value="">All categories</option>
                        {categoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="grid gap-2">
                    <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Date range
                    </span>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <input
                            type="date"
                            value={dateRange.start ?? ""}
                            onChange={(event) => onDateRangeChange({ ...dateRange, start: event.target.value || undefined })}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/90 py-3 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                        />
                        <input
                            type="date"
                            value={dateRange.end ?? ""}
                            onChange={(event) => onDateRangeChange({ ...dateRange, end: event.target.value || undefined })}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/90 py-3 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                        />
                    </div>
                </div>
            </div>

            {hasActiveFilters ? (
                <div className="flex flex-wrap items-center gap-2">
                    {selectedMonth ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Month: {monthOptions.find((option) => option.value === selectedMonth)?.label ?? selectedMonth}
                        </span>
                    ) : null}
                    {selectedMember ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Member: {memberOptions.find((option) => option.value === selectedMember)?.label ?? selectedMember}
                        </span>
                    ) : null}
                    {selectedCategory ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Category: {categoryOptions.find((option) => option.value === selectedCategory)?.label ?? selectedCategory}
                        </span>
                    ) : null}
                    {dateRange.start || dateRange.end ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Date: {dateRange.start ?? "Any"} → {dateRange.end ?? "Any"}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
