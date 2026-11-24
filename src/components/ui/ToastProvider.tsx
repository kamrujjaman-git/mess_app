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
import { AlertCircle, Info, X } from "lucide-react";

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

function AnimatedSuccessCheck() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="success-check-icon h-5 w-5 flex-shrink-0 text-success"
            fill="none"
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="6"
                className="success-check-circle"
                stroke="currentColor"
                strokeWidth="2"
            />
            <path
                d="m9.5 12.2 1.7 1.7 3.6-4"
                className="success-check-tick"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

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
                <div className={`flex w-[min(92vw,28rem)] items-center justify-between gap-4 rounded-2xl border border-subtle/80 bg-surface/95 px-4 py-3 text-primary shadow-lg shadow-slate-200/50 backdrop-blur-md transition-all duration-300 dark:shadow-black/40 ${toastItem.visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
                    <span className="min-w-0 text-sm font-semibold">{title}</span>
                    <button
                        type="button"
                        onClick={() => {
                            onUndo();
                            toast.dismiss(toastItem.id);
                        }}
                        className="min-h-9 shrink-0 rounded-lg bg-success-surface px-3 text-sm font-bold text-success-on-surface transition hover:bg-success-border"
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
                className={`flex w-[min(92vw,28rem)] min-w-0 items-center justify-between gap-3 rounded-2xl border border-subtle/80 bg-surface/95 px-4 py-3 text-primary shadow-lg shadow-slate-200/50 backdrop-blur-md transition-all duration-300 ease-out dark:shadow-black/40 sm:px-5 ${toastItem.visible ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-95 opacity-0"}`}
            >
                <div className="flex items-center gap-3">
                    {isSuccess && <AnimatedSuccessCheck />}
                    {isError && (
                        <span className="form-error-shake inline-flex flex-shrink-0">
                            <AlertCircle className="h-5 w-5 text-danger stroke-[2.2]" />
                        </span>
                    )}
                    {!isSuccess && !isError && <Info className="w-5 h-5 text-info flex-shrink-0 stroke-[2.2]" />}

                    <span className="text-sm font-semibold tracking-wide">{resolveValue(toastItem.message, toastItem)}</span>
                </div>

                <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => toast.dismiss(toastItem.id)}
                    className="z-10 ml-auto flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-subtle/80 bg-surface/70 text-muted shadow-sm transition-colors duration-200 hover:bg-surface hover:text-primary active:scale-90 dark:bg-elevated/80 dark:hover:bg-container"
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
