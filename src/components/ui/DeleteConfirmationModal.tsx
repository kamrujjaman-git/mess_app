"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useSyncExternalStore } from "react";

interface DeleteConfirmationModalProps {
    open: boolean;
    title?: string;
    description?: string;
    confirmLabel?: string;
    busy?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

export function DeleteConfirmationModal({
    open,
    title = "Delete this entry?",
    description = "Deleting this item will permanently remove it from your records.",
    confirmLabel = "Delete",
    busy = false,
    onConfirm,
    onCancel,
}: DeleteConfirmationModalProps) {
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const deleteButtonRef = useRef<HTMLButtonElement>(null);
    const mounted = useSyncExternalStore(
        () => () => undefined,
        () => true,
        () => false
    );

    useEffect(() => {
        if (!open) return;

        const focusDeleteButton = () => deleteButtonRef.current?.focus();
        const frame = requestAnimationFrame(focusDeleteButton);

        function handleKeyboardNavigation(event: KeyboardEvent) {
            if (event.key === "Escape" && !busy) {
                event.preventDefault();
                onCancel();
                return;
            }

            if (!["ArrowLeft", "ArrowRight", "Tab"].includes(event.key)) return;

            const activeElement = document.activeElement;
            const isCancelFocused = activeElement === cancelButtonRef.current;
            const nextButton = isCancelFocused
                ? deleteButtonRef.current
                : cancelButtonRef.current;

            event.preventDefault();
            nextButton?.focus();
        }

        document.addEventListener("keydown", handleKeyboardNavigation);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("keydown", handleKeyboardNavigation);
        };
    }, [busy, onCancel, open]);

    if (!mounted) return null;

    return createPortal(
        (
            <AnimatePresence>
                {open ? (
                    <motion.div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        role="presentation"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget && !busy) onCancel();
                        }}
                    >
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="delete-confirmation-title"
                            className="relative mx-auto w-full max-w-xs transform-gpu will-change-transform rounded-3xl border border-slate-200/80 bg-white p-6 text-center text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-white sm:max-w-sm"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            <div className="text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                                    <AlertTriangle className="h-6 w-6" />
                                </div>
                                <h2 id="delete-confirmation-title" className="mt-4 text-lg font-bold">
                                    {title}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    {description}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={busy}
                                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
                                aria-label="Close delete confirmation"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={busy}
                                    ref={cancelButtonRef}
                                    className="w-full cursor-pointer rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 outline-none transition-all hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-400/60 focus:border-slate-400 focus:scale-[1.03] active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-slate-500/60 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    disabled={busy}
                                    ref={deleteButtonRef}
                                    autoFocus
                                    className="w-full cursor-pointer rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/20 outline-none transition-all hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-500/60 focus:ring-offset-2 focus:ring-offset-white focus:scale-[1.03] active:scale-95 dark:focus:ring-offset-slate-900 disabled:cursor-wait disabled:opacity-60"
                                >
                                    {busy ? "Deleting..." : confirmLabel}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        ),
        document.body
    );
}