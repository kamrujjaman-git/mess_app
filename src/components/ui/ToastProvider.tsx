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

        // If there are already 2 or more active toasts, clear them before showing a new one.
        if (activeToastsRef.current.size >= 2) {
            toast.dismiss();
        }

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

    const value = useMemo<ToastContextValue>(() => ({ toast: toastHandler, success, error, info, dismiss }), [dismiss, error, info, success, toastHandler]);

    function ToastItemRenderer({ toastItem }: { toastItem: Toast }) {
        useEffect(() => {
            registerToast(toastItem.id);
            return () => unregisterToast(toastItem.id);
        }, [toastItem.id]);

        const isSuccess = toastItem.type === "success";
        const isError = toastItem.type === "error";

        return (
            <div
                className={`flex min-w-[320px] max-w-md items-center justify-between gap-4 rounded-full border border-white/40 bg-white/70 px-5 py-3 text-slate-900 shadow-lg backdrop-blur-md transition-all duration-300 ease-out dark:border-slate-700/50 dark:bg-slate-900/70 dark:text-white dark:shadow-2xl ${toastItem.visible ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-95 opacity-0"}`}
            >
                <div className="flex items-center gap-3">
                    {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 stroke-[2.2] drop-shadow" />}
                    {isError && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 stroke-[2.2] drop-shadow" />}
                    {!isSuccess && !isError && <Info className="w-5 h-5 text-sky-400 flex-shrink-0 stroke-[2.2] drop-shadow" />}

                    <span className="text-sm font-semibold tracking-wide">{resolveValue(toastItem.message, toastItem)}</span>
                </div>

                <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => toast.dismiss(toastItem.id)}
                    className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all duration-200 ease-in-out flex-shrink-0 ml-auto cursor-pointer border border-white/30 shadow-sm active:scale-90"
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
