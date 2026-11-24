"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
    title = "Delete this item?",
    description = "Deleting this item will permanently remove it from your records.",
    confirmLabel = "Yes, delete item",
    busy = false,
    onConfirm,
    onCancel,
}: DeleteConfirmationModalProps) {
    const reduceMotion = useReducedMotion();
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
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={
                            reduceMotion
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 300, damping: 28 }
                        }
                        role="presentation"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget && !busy) onCancel();
                        }}
                    >
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="delete-confirmation-title"
                            className="relative mx-auto w-full max-w-xs rounded-3xl border border-subtle/80 bg-surface p-6 text-center text-primary shadow-2xl sm:max-w-sm"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : { type: "spring", stiffness: 300, damping: 28 }
                            }
                        >
                            <div className="text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-surface text-danger-on-surface">
                                    <AlertTriangle className="h-6 w-6" />
                                </div>
                                <h2 id="delete-confirmation-title" className="mt-4 text-lg font-bold">
                                    {title}
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-secondary">
                                    {description}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={busy}
                                className="tactile-press absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-container disabled:opacity-50"
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
                                    className="tactile-press w-full cursor-pointer rounded-xl bg-container px-4 py-2.5 text-sm font-bold text-secondary outline-none transition-colors duration-150 hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-subtle disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    disabled={busy}
                                    ref={deleteButtonRef}
                                    autoFocus
                                    className="tactile-press w-full cursor-pointer rounded-xl bg-danger-fill px-4 py-2.5 text-sm font-bold text-danger-on-fill shadow-md shadow-danger/20 outline-none transition-colors duration-150 hover:bg-danger-fill-hover focus:outline-none focus:ring-2 focus:ring-danger/60 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-wait disabled:opacity-60"
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