"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    type ReactNode,
} from "react";
import toast, { Toaster, resolveValue } from "react-hot-toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

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
        duration: 3500,
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
                icon: "info",
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
                containerStyle={{ bottom: 24 }}
                toastOptions={{
                    duration: 3500,
                    style: {
                        background: "transparent",
                        boxShadow: "none",
                        padding: 0,
                        margin: 0,
                        maxWidth: "none",
                    },
                }}
            >
                {(toastItem) => {
                    const isSuccess = toastItem.type === "success";
                    const isError = toastItem.type === "error";

                    return (
                        <div
                            className={`
                flex items-center justify-between gap-4 
                min-w-[320px] max-w-md px-5 py-3 rounded-full 
                bg-slate-950/65 backdrop-blur-xl -webkit-backdrop-blur-xl
                border border-white/20 
                shadow-[0_12px_40px_rgba(0,0,0,0.4)] 
                text-white transition-all duration-300 ease-out
                ${toastItem.visible
                                    ? "opacity-100 translate-y-0 scale-100"
                                    : "opacity-0 translate-y-4 scale-95 pointer-events-none"
                                }
            `}
                        >
                            {/* Left Icon & Pure White Bold Text */}
                            <div className="flex items-center gap-3">
                                {isSuccess && (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 stroke-[2.2] drop-shadow" />
                                )}
                                {isError && (
                                    <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 stroke-[2.2] drop-shadow" />
                                )}
                                {!isSuccess && !isError && (
                                    <Info className="w-5 h-5 text-sky-400 flex-shrink-0 stroke-[2.2] drop-shadow" />
                                )}

                                <span className="text-sm font-semibold text-white tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                    {resolveValue(toastItem.message, toastItem)}
                                </span>
                            </div>

                            {/* iOS Style Frosted Glass Circular Close Button */}
                            <button
                                type="button"
                                aria-label="Dismiss notification"
                                onClick={() => toast.dismiss(toastItem.id)}
                                className="
                    w-7 h-7 rounded-full 
                    bg-white/20 hover:bg-white/30 
                    text-white 
                    flex items-center justify-center 
                    transition-all duration-200 ease-in-out 
                    flex-shrink-0 ml-auto cursor-pointer 
                    border border-white/30
                    shadow-sm active:scale-90
                "
                            >
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        </div>
                    );
                }}
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