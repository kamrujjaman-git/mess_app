"use client";

import { Search, Funnel } from "lucide-react";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";

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
        <div className={`clay-card space-y-4 p-4 ${className}`}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="relative block">
                    <span className="sr-only">Search</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Search members, deposit notes, expense titles..."
                        className="w-full rounded-2xl border border-subtle bg-elevated/60 py-3 pl-10 pr-4 text-sm text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                    />
                </label>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-subtle bg-elevated/90 px-3 py-3 text-sm text-secondary dark:border-subtle dark:bg-surface/90 dark:text-secondary">
                    <div className="flex items-center gap-2">
                        <Funnel className="h-4 w-4 text-muted" />
                        <span className="font-medium">Filters</span>
                    </div>
                    <button
                        type="button"
                        disabled={!hasActiveFilters}
                        onClick={onClearAll}
                        className="clay-pill bg-elevated/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted transition hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Clear All
                    </button>
                </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted dark:text-muted">
                    Month
                    <select
                        value={selectedMonth ?? ""}
                        onChange={(event) => onMonthChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-subtle bg-elevated/60 py-3 px-3 text-sm text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                    >
                        <option value="">All months</option>
                        {monthOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted dark:text-muted">
                    Member
                    <select
                        value={selectedMember ?? ""}
                        onChange={(event) => onMemberChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-subtle bg-elevated/60 py-3 px-3 text-sm text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
                    >
                        <option value="">All members</option>
                        {memberOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted dark:text-muted">
                    Category
                    <select
                        value={selectedCategory ?? ""}
                        onChange={(event) => onCategoryChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-subtle bg-elevated/60 py-3 px-3 text-sm text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
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
                    <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-muted dark:text-muted">
                        Date range
                    </span>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <PremiumDatePicker
                            value={dateRange.start ?? ""}
                            onChange={(value) => onDateRangeChange({ ...dateRange, start: value })}
                            placeholder="Start date"
                        />
                        <PremiumDatePicker
                            value={dateRange.end ?? ""}
                            onChange={(value) => onDateRangeChange({ ...dateRange, end: value })}
                            placeholder="End date"
                        />
                    </div>
                </div>
            </div>

            {hasActiveFilters ? (
                <div className="flex flex-wrap items-center gap-2">
                    {selectedMonth ? (
                        <span className="rounded-full bg-container px-3 py-1 text-xs font-semibold text-secondary dark:bg-elevated dark:text-secondary">
                            Month: {monthOptions.find((option) => option.value === selectedMonth)?.label ?? selectedMonth}
                        </span>
                    ) : null}
                    {selectedMember ? (
                        <span className="rounded-full bg-container px-3 py-1 text-xs font-semibold text-secondary dark:bg-elevated dark:text-secondary">
                            Member: {memberOptions.find((option) => option.value === selectedMember)?.label ?? selectedMember}
                        </span>
                    ) : null}
                    {selectedCategory ? (
                        <span className="rounded-full bg-container px-3 py-1 text-xs font-semibold text-secondary dark:bg-elevated dark:text-secondary">
                            Category: {categoryOptions.find((option) => option.value === selectedCategory)?.label ?? selectedCategory}
                        </span>
                    ) : null}
                    {dateRange.start || dateRange.end ? (
                        <span className="rounded-full bg-container px-3 py-1 text-xs font-semibold text-secondary dark:bg-elevated dark:text-secondary">
                            Date: {dateRange.start ?? "Any"} → {dateRange.end ?? "Any"}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
