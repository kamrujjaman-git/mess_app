"use client";

import {
    LayoutDashboard,
    Utensils,
    ShoppingCart,
    Wallet,
    ShieldCheck,
} from "lucide-react";

interface StickyBottomNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isAdmin?: boolean;
}

const tabs = [
    { key: "summary", label: "Dashboard", Icon: LayoutDashboard },
    { key: "meals", label: "Meals", Icon: Utensils },
    { key: "bazar", label: "Bazar", Icon: ShoppingCart },
    { key: "balance", label: "Balance", Icon: Wallet },
];

export function StickyBottomNav({ activeTab, setActiveTab, isAdmin = false }: StickyBottomNavProps) {
    return (
        <nav className="glass fixed bottom-0 left-0 right-0 z-40 md:hidden">
            <div className="mx-auto flex max-w-xl items-center justify-between px-3 py-2.5">
                {tabs.map(({ key, label, Icon }) => {
                    const isActive = activeTab === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveTab(key)}
                            aria-current={isActive ? "page" : undefined}
                            className={`group flex flex-col items-center gap-1 rounded-3xl px-3 py-2 text-xs transition-transform duration-200 ${isActive
                                ? "scale-105 text-emerald-600 font-semibold"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                                }`}
                        >
                            <span
                                className={`flex h-9 w-9 items-center justify-center rounded-2xl border border-transparent transition-colors duration-200 ${isActive
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    }`}
                            >
                                <Icon className="h-5 w-5" />
                            </span>
                            <span className="leading-none">{label}</span>
                        </button>
                    );
                })}

                {isAdmin ? (
                    <button
                        type="button"
                        onClick={() => setActiveTab("admin")}
                        aria-current={activeTab === "admin" ? "page" : undefined}
                        className={`group flex flex-col items-center gap-1 rounded-3xl px-3 py-2 text-xs transition-transform duration-200 ${activeTab === "admin"
                            ? "scale-105 text-emerald-600 font-semibold"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                            }`}
                    >
                        <span
                            className={`flex h-9 w-9 items-center justify-center rounded-2xl border border-transparent transition-colors duration-200 ${activeTab === "admin"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                        >
                            <ShieldCheck className="h-5 w-5" />
                        </span>
                        <span className="leading-none">Admin</span>
                    </button>
                ) : null}
            </div>
        </nav>
    );
}
