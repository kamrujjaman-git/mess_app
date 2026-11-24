"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
    icon: LucideIcon;
    title?: string;
    description?: string;
    actionButtonLabel?: string;
    onAction?: () => void;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title = "No records found for this period",
    description,
    actionButtonLabel,
    onAction,
    className = "",
}: EmptyStateProps) {
    const reduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
            className={`flex flex-col items-center justify-center gap-4 rounded-3xl border border-subtle/80 bg-elevated/90 px-6 py-10 text-center text-secondary shadow-sm backdrop-blur-sm ${className}`}
        >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-surface text-success shadow-inner">
                <Icon className="h-7 w-7" />
            </div>
            <div className="max-w-xl">
                <p className="text-balance text-base font-semibold text-primary sm:text-lg">{title}</p>
                {description ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{description}</p>
                ) : null}
            </div>
            {actionButtonLabel && onAction ? (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-brand-fill px-5 py-2.5 text-sm font-semibold text-brand-on-fill shadow-lg shadow-brand/20 transition-colors duration-150 hover:bg-brand-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                    {actionButtonLabel}
                </button>
            ) : null}
        </motion.div>
    );
}
