"use client";

import { useState } from "react";
import { DollarSign, ShoppingBag, Utensils, X } from "lucide-react";

interface FloatingActionButtonProps {
    onAddBazar?: () => void;
    onAddDeposit?: () => void;
    onUpdateMeal?: () => void;
}

const actions = [
    {
        label: "Add Bazar Expense",
        icon: ShoppingBag,
        actionKey: "bazar",
    },
    {
        label: "Add Deposit",
        icon: DollarSign,
        actionKey: "deposit",
    },
    {
        label: "Update Meal",
        icon: Utensils,
        actionKey: "meal",
    },
] as const;

export function FloatingActionButton({ onAddBazar, onAddDeposit, onUpdateMeal }: FloatingActionButtonProps) {
    const [open, setOpen] = useState(false);

    const handleAction = (actionKey: string) => {
        setOpen(false);

        switch (actionKey) {
            case "bazar":
                onAddBazar?.();
                break;
            case "deposit":
                onAddDeposit?.();
                break;
            case "meal":
                onUpdateMeal?.();
                break;
            default:
                break;
        }
    };

    return (
        <div className="pointer-events-none fixed bottom-16 right-4 z-50 flex flex-col items-end gap-3 md:hidden">
            <div className="pointer-events-auto flex flex-col items-end gap-3">
                {open && (
                    <div className="flex w-full flex-col items-end gap-3">
                        {actions.map(({ label, icon: Icon, actionKey }) => (
                            <button
                                key={actionKey}
                                type="button"
                                onClick={() => handleAction(actionKey)}
                                className="group inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/85 px-4 py-3 text-sm font-medium text-slate-800 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 active:scale-95 dark:border-slate-700/60 dark:bg-slate-900/95 dark:text-slate-100"
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-colors duration-200 group-hover:bg-emerald-600">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
                    aria-expanded={open}
                    aria-label={open ? "Close quick actions" : "Open quick actions"}
                    className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-emerald-600 text-white shadow-[0_16px_50px_rgba(16,185,129,0.32)] transition-transform duration-300 ease-out hover:bg-emerald-500 active:scale-95 dark:border-emerald-400/30"
                    style={{ transform: open ? "rotate(45deg)" : undefined }}
                >
                    <span className="sr-only">Quick actions</span>
                    <X className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
}
