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
            {label ? <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">{label}</span> : null}
            <button
                type="button"
                onClick={openPicker}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={`${mode === "month"
                    ? "flex min-h-9 w-full items-center gap-2 rounded-full bg-transparent px-2 py-1 text-left text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-200/60 sm:min-h-10 sm:text-sm dark:text-slate-100 dark:hover:bg-slate-800"
                    : "glass flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition-all hover:scale-[1.01] dark:text-slate-100"}`}
            >
                <span className={`${mode === "month"
                    ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-emerald-700 dark:text-emerald-300"
                    : "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"}`}
                >
                    <CalendarDays className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
            </button>

            {open ? (
                <div className="absolute left-0 top-[calc(100%+0.6rem)] z-[999] w-[min(20rem,calc(100vw-2rem))] rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-2xl shadow-slate-900/20 backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-900/95" role="dialog" aria-label={label ?? "Choose date"}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => shiftPeriod(-1)}
                            className="glass flex h-9 w-9 items-center justify-center rounded-full text-slate-700 dark:text-slate-100"
                            aria-label="Previous period"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setView(view === "days" ? "months" : view === "months" ? "years" : "days")}
                            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-900 transition hover:bg-emerald-50 dark:text-slate-100 dark:hover:bg-slate-800"
                            aria-label="Switch date picker view"
                        >
                            {view === "years" ? `${yearStart}-${yearStart + 9}` : `${monthNames[visibleMonth]} ${visibleYear}`}
                        </button>
                        <button
                            type="button"
                            onClick={() => shiftPeriod(1)}
                            className="glass flex h-9 w-9 items-center justify-center rounded-full text-slate-700 dark:text-slate-100"
                            aria-label="Next period"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    {view === "days" ? (
                        <>
                            <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                {weekdayNames.map((day) => <span key={day}>{day}</span>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {days.map((day, index) => day === null ? (
                                    <span key={`empty-${index}`} className="h-9" />
                                ) : (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => {
                                            onChange(formatValue(visibleYear, visibleMonth, day, mode));
                                            setOpen(false);
                                        }}
                                        className={`h-9 rounded-xl text-sm font-semibold transition ${parsed.year === visibleYear && parsed.month === visibleMonth && parsed.day === day
                                            ? "border-t border-white/40 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-lg"
                                            : "text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}
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
                                    className={`rounded-xl px-2 py-3 text-xs font-semibold transition ${parsed.year === visibleYear && parsed.month === index
                                        ? "border-t border-white/40 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-lg"
                                        : "text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}
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
                                    className={`rounded-xl px-2 py-3 text-xs font-semibold transition ${parsed.year === year
                                        ? "border-t border-white/40 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-lg"
                                        : "text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-slate-800"}`}
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
