"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useEffect,
    type ReactNode,
} from "react";
import toast, { Toaster, resolveValue, type Toast } from "react-hot-toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
    id?: string;
    title: string;
    description?: string;
    tone: ToastTone;
}

type ToastContextValue = {
    toast: (toastItem: Omit<ToastItem, "id">) => string | undefined;
    success: (title: string, description?: string) => string | undefined;
    error: (title: string, description?: string) => string | undefined;
    info: (title: string, description?: string) => string | undefined;
    dismiss: (id: string) => void;
    undo: (title: string, onUndo: () => void) => string | undefined;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const activeToastsRef = useRef<Set<string>>(new Set());

    function registerToast(id?: string) {
        if (!id) return;
        activeToastsRef.current.add(id);
    }

    function unregisterToast(id?: string) {
        if (!id) return;
        activeToastsRef.current.delete(id);
    }

    function notify(item: Omit<ToastItem, "id">) {
        const options = {
            duration: 1500,
            description: item.description,
        };

        switch (item.tone) {
            case "success":
                return toast.success(item.title, options);
            case "error":
                return toast.error(item.title, options);
            default:
                return toast(item.title, {
                    ...options,
                    icon: "info",
                });
        }
    }

    const dismiss = useCallback((id: string) => {
        toast.dismiss(id);
    }, []);

    const toastHandler = useCallback((item: Omit<ToastItem, "id">) => {
        return notify(item);
    }, []);

    const success = useCallback((title: string, description?: string) => {
        return notify({ title, description, tone: "success" });
    }, []);

    const error = useCallback((title: string, description?: string) => {
        return notify({ title, description, tone: "error" });
    }, []);

    const info = useCallback((title: string, description?: string) => {
        return notify({ title, description, tone: "info" });
    }, []);

    const undo = useCallback((title: string, onUndo: () => void) => {
        return toast.custom(
            (toastItem) => (
                <div className={`flex w-[min(92vw,28rem)] items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 text-slate-800 shadow-lg shadow-slate-200/50 backdrop-blur-md transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-black/40 ${toastItem.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
                    <span className="min-w-0 text-sm font-semibold">{title}</span>
                    <button
                        type="button"
                        onClick={() => {
                            onUndo();
                            toast.dismiss(toastItem.id);
                        }}
                        className="min-h-9 shrink-0 rounded-lg bg-emerald-50 px-3 text-sm font-bold text-emerald-600 transition hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                    >
                        Undo
                    </button>
                </div>
            ),
            { duration: 5000 }
        );
    }, []);

    const value = useMemo<ToastContextValue>(() => ({ toast: toastHandler, success, error, info, dismiss, undo }), [dismiss, error, info, success, toastHandler, undo]);

    function ToastItemRenderer({ toastItem }: { toastItem: Toast }) {
        useEffect(() => {
            registerToast(toastItem.id);
            return () => unregisterToast(toastItem.id);
        }, [toastItem.id]);

        if (toastItem.type === "custom") {
            return <>{resolveValue(toastItem.message, toastItem)}</>;
        }

        const isSuccess = toastItem.type === "success";
        const isError = toastItem.type === "error";

        return (
            <div
                className={`flex w-[min(92vw,28rem)] min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 text-slate-800 shadow-lg shadow-slate-200/50 backdrop-blur-md transition-all duration-300 ease-out dark:border-slate-800/80 dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-black/40 sm:px-5 ${toastItem.visible ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-95 opacity-0"}`}
            >
                <div className="flex items-center gap-3">
                    {isSuccess && <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500 stroke-[2.2] drop-shadow" />}
                    {isError && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 stroke-[2.2] drop-shadow" />}
                    {!isSuccess && !isError && <Info className="w-5 h-5 text-sky-400 flex-shrink-0 stroke-[2.2] drop-shadow" />}

                    <span className="text-sm font-semibold tracking-wide">{resolveValue(toastItem.message, toastItem)}</span>
                </div>

                <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => toast.dismiss(toastItem.id)}
                    className="z-10 ml-auto flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-500 shadow-sm transition-colors duration-200 hover:bg-white hover:text-slate-800 active:scale-90 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
            </div>
        );
    }

    return (
        <ToastContext.Provider value={value}>
            {children}
            <Toaster
                position="bottom-center"
                reverseOrder={false}
                gutter={12}
                containerStyle={{ bottom: 24 }}
                toastOptions={{
                    duration: 1500,
                    style: {
                        background: "transparent",
                        boxShadow: "none",
                        padding: 0,
                        margin: 0,
                        maxWidth: "none",
                    },
                }}
            >
                {(toastItem) => <ToastItemRenderer toastItem={toastItem} />}
            </Toaster>
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
