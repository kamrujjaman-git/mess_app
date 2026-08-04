"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    type ReactNode,
} from "react";
import toast, { Toaster, ToastBar } from "react-hot-toast";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
    id?: string;
    title: string;
    description?: string;
    tone: ToastTone;
}

interface ToastContextValue {
    toast: (toastItem: Omit<ToastItem, "id">) => string | undefined;
    success: (title: string, description?: string) => string | undefined;
    error: (title: string, description?: string) => string | undefined;
    info: (title: string, description?: string) => string | undefined;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function notify(item: Omit<ToastItem, "id">) {
    const options = {
        duration: 1000,
        description: item.description,
    };

    toast.dismiss();

    switch (item.tone) {
        case "success":
            return toast.success(item.title, options);
        case "error":
            return toast.error(item.title, options);
        default:
            return toast(item.title, {
                ...options,
                icon: "ℹ️",
            });
    }
}

export function ToastProvider({ children }: { children: ReactNode }) {
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

    const value = useMemo<ToastContextValue>(
        () => ({ toast: toastHandler, success, error, info, dismiss }),
        [dismiss, error, info, success, toastHandler]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <Toaster
                position="bottom-center"
                reverseOrder={false}
                gutter={12}
                toastOptions={{
                    duration: 1000,
                    className: "fast-toast",
                    style: {
                        borderRadius: "14px",
                        background: "#0f172a",
                        color: "#f8fafc",
                        boxShadow: "0 20px 45px -20px rgba(15, 23, 42, 0.55)",
                    },
                    success: {
                        style: {
                            background: "#065f46",
                            color: "#ecfdf5",
                        },
                    },
                    error: {
                        style: {
                            background: "#7f1d1d",
                            color: "#fff1f2",
                        },
                    },
                }}
            >
                {(toastItem) => (
                    <div
                        className="fast-toast relative"
                        style={{
                            opacity: toastItem.visible ? 1 : 0,
                            transform: toastItem.visible ? "translateY(0)" : "translateY(8px)",
                            transition: "opacity 150ms ease, transform 150ms ease",
                        }}
                    >
                        <ToastBar toast={toastItem} />
                        <button
                            type="button"
                            aria-label="Dismiss notification"
                            onClick={() => toast.dismiss(toastItem.id)}
                            className="absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-current/70 transition hover:text-current"
                            style={{ lineHeight: 1 }}
                        >
                            ✕
                        </button>
                    </div>
                )}
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
