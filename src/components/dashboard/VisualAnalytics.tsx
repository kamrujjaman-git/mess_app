"use client";

import { useMemo } from "react";
import { formatCurrency, type BazarEntry } from "@/lib/mess";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface MemberContribution {
    name: string;
    value: number;
}

interface VisualAnalyticsProps {
    bazarEntries: BazarEntry[];
    memberContributions: MemberContribution[];
    className?: string;
}

const themeColors = ["#059669", "#10b981", "#34d399", "#047857", "#065f46", "#15803d"];

function currencyFormatter(value: number) {
    return `৳${formatCurrency(value)}`;
}

interface ChartTooltipEntry {
    value?: number | string;
}

interface ChartTooltipProps {
    active?: boolean;
    payload?: ChartTooltipEntry[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
    if (!active || !payload || payload.length === 0) return null;

    const entry = payload[0];

    return (
        <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-800 shadow-lg shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-100">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{label}</p>
            <p>{currencyFormatter(Number(entry.value ?? 0))}</p>
        </div>
    );
}

export function VisualAnalytics({ bazarEntries, memberContributions, className = "" }: VisualAnalyticsProps) {
    const dailyBazarData = useMemo(() => {
        const bucket: Record<string, number> = {};

        bazarEntries.forEach((entry) => {
            bucket[entry.date] = (bucket[entry.date] ?? 0) + entry.amount;
        });

        const sortedDates = Object.keys(bucket).sort((a, b) => a.localeCompare(b));

        return sortedDates.map((dateStr) => {
            const [year, month, day] = dateStr.split("-").map(Number);
            const formattedDate = new Date(year, month - 1, day).toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
            });

            return {
                date: formattedDate,
                amount: bucket[dateStr],
            };
        });
    }, [bazarEntries]);

    const donutData = useMemo(
        () => memberContributions.filter((item) => item.value > 0),
        [memberContributions]
    );

    return (
        <div className={`glass-card space-y-6 rounded-3xl p-5 ${className}`}>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                {/* Daily Bazar Chart */}
                <section className="glass-card rounded-3xl p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Daily Bazar Trend</p>
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Bazar Expenses</h3>
                        </div>
                    </div>

                    {dailyBazarData.length === 0 ? (
                        <div className="flex h-72 items-center justify-center text-sm text-slate-400">
                            No bazar entries logged for this period.
                        </div>
                    ) : (
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyBazarData} margin={{ top: 10, right: 8, left: -10, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
                                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} tickFormatter={(value) => `৳${formatCurrency(Number(value))}`} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="amount" radius={[12, 12, 0, 0]} fill="#10b981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </section>

                {/* Member Contribution Chart */}
                <section className="glass-card rounded-3xl p-4">
                    <div className="mb-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Member contribution</p>
                        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Bazar share</h3>
                    </div>

                    {donutData.length === 0 ? (
                        <div className="flex h-72 items-center justify-center text-sm text-slate-400">
                            No contribution data available.
                        </div>
                    ) : (
                        <>
                            <div className="flex h-72 items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={donutData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={4}
                                        >
                                            {donutData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={themeColors[index % themeColors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: unknown) => [currencyFormatter(Number(value ?? 0)), "Bazar Share"]} contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", backgroundColor: "rgba(255,255,255,0.95)", color: "#0f172a" }} />
                                        <Legend formatter={(value) => <span className="text-sm text-slate-600 dark:text-slate-300">{value}</span>} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 grid gap-2">
                                {donutData.map((entry, index) => (
                                    <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
                                        <span className="flex items-center gap-2">
                                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: themeColors[index % themeColors.length] }} />
                                            {entry.name}
                                        </span>
                                        <span className="font-semibold">{currencyFormatter(entry.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}