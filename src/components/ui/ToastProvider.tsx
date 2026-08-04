"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
    id: string;
    title: string;
    description?: string;
    tone: ToastTone;
}

interface ToastContextValue {
    toast: (toast: Omit<ToastItem, "id">) => void;
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function getToneStyles(tone: ToastTone) {
    switch (tone) {
        case "success":
            return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200";
        case "error":
            return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/50 dark:text-rose-200";
        default:
            return "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
    }
}

function getToneIcon(tone: ToastTone) {
    switch (tone) {
        case "success":
            return CheckCircle2;
        case "error":
            return XCircle;
        default:
            return Info;
    }
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const toast = useCallback(
        (item: Omit<ToastItem, "id">) => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const nextToast = { ...item, id };
            setToasts((prev) => [...prev, nextToast]);
            window.setTimeout(() => dismiss(id), 3200);
        },
        [dismiss]
    );

    const success = useCallback((title: string, description?: string) => {
        toast({ title, description, tone: "success" });
    }, [toast]);

    const error = useCallback((title: string, description?: string) => {
        toast({ title, description, tone: "error" });
    }, [toast]);

    const info = useCallback((title: string, description?: string) => {
        toast({ title, description, tone: "info" });
    }, [toast]);

    const value = useMemo<ToastContextValue>(
        () => ({ toast, success, error, info, dismiss }),
        [toast, success, error, info, dismiss]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-3 sm:bottom-6">
                <div className="flex w-full max-w-md flex-col gap-2">
                    {toasts.map((item) => {
                        const Icon = getToneIcon(item.tone);
                        return (
                            <div
                                key={item.id}
                                className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${getToneStyles(item.tone)}`}
                            >
                                <div className="mt-0.5 shrink-0">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold">{item.title}</p>
                                    {item.description && (
                                        <p className="mt-1 text-sm/5 opacity-90">{item.description}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    aria-label="Dismiss toast"
                                    onClick={() => dismiss(item.id)}
                                    className="rounded-full p-1 text-current/70 transition hover:text-current"
                                >
                                    <XCircle className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
