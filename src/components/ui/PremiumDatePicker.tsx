"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface PremiumDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    mode?: "date" | "month";
    label?: string;
    placeholder?: string;
    className?: string;
    maxDate?: string;
}

type PickerView = "days" | "months" | "years";

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseValue(value: string, mode: "date" | "month") {
    const [year, month = 1, day = 1] = value.split("-").map(Number);
    return {
        year: Number.isFinite(year) ? year : new Date().getFullYear(),
        month: Number.isFinite(month) ? month - 1 : 0,
        day: mode === "date" && Number.isFinite(day) ? day : 1,
    };
}

function formatValue(year: number, month: number, day: number, mode: "date" | "month") {
    const monthValue = String(month + 1).padStart(2, "0");
    if (mode === "month") return `${year}-${monthValue}`;
    return `${year}-${monthValue}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

export function PremiumDatePicker({
    value,
    onChange,
    mode = "date",
    label,
    placeholder,
    className = "",
    maxDate,
}: PremiumDatePickerProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const parsed = parseValue(value, mode);
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<PickerView>(mode === "month" ? "months" : "days");
    const [visibleYear, setVisibleYear] = useState(parsed.year);
    const [visibleMonth, setVisibleMonth] = useState(parsed.month);

    useEffect(() => {
        if (!open) return;

        function handlePointerDown(event: PointerEvent) {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [open]);

    const displayLabel = useMemo(() => {
        if (!value && placeholder) return placeholder;
        if (mode === "month") {
            return new Date(parsed.year, parsed.month, 1).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
            });
        }

        return new Date(parsed.year, parsed.month, parsed.day).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }, [mode, parsed.day, parsed.month, parsed.year, placeholder, value]);

    const days = useMemo(() => {
        if (mode !== "date") return [];
        const firstDay = new Date(visibleYear, visibleMonth, 1).getDay();
        return Array.from({ length: firstDay + daysInMonth(visibleYear, visibleMonth) }, (_, index) =>
            index < firstDay ? null : index - firstDay + 1
        );
    }, [mode, visibleMonth, visibleYear]);

    function openPicker() {
        setVisibleYear(parsed.year);
        setVisibleMonth(parsed.month);
        setView(mode === "month" ? "months" : "days");
        setOpen((previous) => !previous);
    }

    function selectMonth(month: number) {
        setVisibleMonth(month);
        if (mode === "month") {
            onChange(formatValue(visibleYear, month, 1, mode));
            setOpen(false);
            return;
        }
        setView("days");
    }

    function selectYear(year: number) {
        setVisibleYear(year);
        setView(mode === "month" ? "months" : "days");
    }

    function shiftPeriod(delta: number) {
        if (view === "years") {
            setVisibleYear((year) => year + delta * 10);
            return;
        }

        if (view === "months" || mode === "month") {
            setVisibleYear((year) => year + delta);
            return;
        }

        const nextDate = new Date(visibleYear, visibleMonth + delta, 1);
        setVisibleYear(nextDate.getFullYear());
        setVisibleMonth(nextDate.getMonth());
    }

    const yearStart = Math.floor(visibleYear / 10) * 10;
    const years = Array.from({ length: 12 }, (_, index) => yearStart + index);

    return (
        <div ref={rootRef} className={`relative min-w-0 ${className}`}>
            {label ? <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-secondary dark:text-secondary">{label}</span> : null}
            {mode === "month" ? (
                <div className="flex min-h-9 w-auto max-w-fit items-center gap-2 px-2 py-1 text-xs font-semibold text-primary sm:min-h-10 sm:text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-brand">
                        <CalendarDays className="h-4 w-4" />
                    </span>
                    <span className="whitespace-nowrap">{displayLabel}</span>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={openPicker}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    className="tactile-press glass flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-primary transition-colors duration-150 hover:bg-container"
                >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success-surface text-success">
                        <CalendarDays className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
                </button>
            )}

            {open && mode !== "month" ? (
                <div className="popover-appear absolute left-0 top-[calc(100%+0.6rem)] z-[999] w-[min(20rem,calc(100vw-2rem))] origin-top-left transform-gpu rounded-3xl border border-subtle/80 bg-surface/95 p-4 shadow-2xl shadow-slate-900/20 backdrop-blur-2xl dark:border-subtle dark:bg-surface/95" role="dialog" aria-label={label ?? "Choose date"}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => shiftPeriod(-1)}
                            className="glass flex h-9 w-9 items-center justify-center rounded-full text-secondary"
                            aria-label="Previous period"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setView(view === "days" ? "months" : view === "months" ? "years" : "days")}
                            className="rounded-xl px-3 py-2 text-sm font-bold text-primary transition hover:bg-success-surface"
                            aria-label="Switch date picker view"
                        >
                            {view === "years" ? `${yearStart}-${yearStart + 9}` : `${monthNames[visibleMonth]} ${visibleYear}`}
                        </button>
                        <button
                            type="button"
                            onClick={() => shiftPeriod(1)}
                            className="glass flex h-9 w-9 items-center justify-center rounded-full text-secondary"
                            aria-label="Next period"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    {view === "days" ? (
                        <>
                            <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wide text-muted dark:text-secondary">
                                {weekdayNames.map((day) => <span key={day}>{day}</span>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {days.map((day, index) => day === null ? (
                                    <span key={`empty-${index}`} className="h-9" />
                                ) : (
                                    <button
                                        key={day}
                                        type="button"
                                        disabled={Boolean(maxDate && formatValue(visibleYear, visibleMonth, day, mode) > maxDate)}
                                        onClick={() => {
                                            onChange(formatValue(visibleYear, visibleMonth, day, mode));
                                            setOpen(false);
                                        }}
                                        className={`h-9 rounded-xl text-sm font-semibold tabular-nums transition-colors duration-150 ${parsed.year === visibleYear && parsed.month === visibleMonth && parsed.day === day
                                            ? "border-t border-brand-fill-hover bg-brand-fill text-brand-on-fill shadow-lg"
                                            : "text-secondary hover:bg-success-surface disabled:cursor-not-allowed disabled:opacity-35"}`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : null}

                    {view === "months" ? (
                        <div className="grid grid-cols-3 gap-2">
                            {monthNames.map((month, index) => (
                                <button
                                    key={month}
                                    type="button"
                                    onClick={() => selectMonth(index)}
                                    className={`rounded-xl px-2 py-3 text-xs font-semibold transition-colors duration-150 ${parsed.year === visibleYear && parsed.month === index
                                        ? "border-t border-brand-fill-hover bg-brand-fill text-brand-on-fill shadow-lg"
                                        : "text-secondary hover:bg-success-surface"}`}
                                >
                                    {month.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                    ) : null}

                    {view === "years" ? (
                        <div className="grid grid-cols-3 gap-2">
                            {years.map((year) => (
                                <button
                                    key={year}
                                    type="button"
                                    onClick={() => selectYear(year)}
                                    className={`rounded-xl px-2 py-3 text-xs font-semibold tabular-nums transition-colors duration-150 ${parsed.year === year
                                        ? "border-t border-brand-fill-hover bg-brand-fill text-brand-on-fill shadow-lg"
                                        : "text-secondary hover:bg-success-surface"}`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
