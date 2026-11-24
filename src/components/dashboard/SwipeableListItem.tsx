"use client";

import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";

interface SwipeableListItemProps {
    children: ReactNode;
    onEdit?: () => void;
    onDelete?: () => void;
    editLabel?: string;
    deleteLabel?: string;
    className?: string;
    style?: CSSProperties;
}

const OPEN_OFFSET = 80;

export function SwipeableListItem({
    children,
    onEdit,
    onDelete,
    editLabel = "Edit",
    deleteLabel = "Delete",
    className = "",
    style,
}: SwipeableListItemProps) {
    const reduceMotion = useReducedMotion();
    const [openSide, setOpenSide] = useState<"left" | "right" | null>(null);

    function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
        const offsetX = info.offset.x;

        if (info.velocity.x < -200 && onDelete) {
            setOpenSide("right");
            return;
        }

        if (info.velocity.x > 200 && onEdit) {
            setOpenSide("left");
            return;
        }

        if (offsetX < -40 && onDelete) {
            setOpenSide("right");
            return;
        }

        if (offsetX > 40 && onEdit) {
            setOpenSide("left");
            return;
        }

        setOpenSide(null);
    }

    function handleCardClick() {
        if (openSide !== null) {
            setOpenSide(null);
        }
    }

    function handleAction(action: "edit" | "delete") {
        setOpenSide(null);
        if (action === "edit") {
            onEdit?.();
        } else {
            onDelete?.();
        }
    }

    return (
        <div
            className={`relative w-full touch-pan-y overflow-hidden rounded-2xl border border-subtle/80 bg-surface transition-colors duration-150 dark:border-subtle dark:bg-surface ${className}`}
            style={style}
        >
            {onEdit ? (
                <button
                    type="button"
                    onClick={() => handleAction("edit")}
                    aria-label={editLabel}
                    className="absolute inset-y-0 left-0 z-0 flex w-20 cursor-pointer items-center justify-center rounded-l-2xl bg-brand-fill text-brand-on-fill transition-colors hover:bg-brand-fill-hover"
                >
                    <Pencil className="h-5 w-5" aria-hidden="true" />
                </button>
            ) : null}
            {onDelete ? (
                <button
                    type="button"
                    onClick={() => handleAction("delete")}
                    aria-label={deleteLabel}
                    className="absolute inset-y-0 right-0 z-0 flex w-20 cursor-pointer items-center justify-center rounded-r-2xl bg-danger-fill text-danger-on-fill transition-colors hover:bg-danger-fill-hover active:bg-danger-fill-hover"
                >
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
            ) : null}

            <motion.div
                drag="x"
                dragConstraints={{
                    left: onDelete ? -OPEN_OFFSET : 0,
                    right: onEdit ? OPEN_OFFSET : 0,
                }}
                dragElastic={0.1}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                onClick={handleCardClick}
                animate={{ x: openSide === "left" ? OPEN_OFFSET : openSide === "right" ? -OPEN_OFFSET : 0 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 30 }}
                style={{
                    touchAction: "pan-y",
                }}
                className="relative z-10 h-full w-full cursor-pointer select-none rounded-2xl bg-surface p-2.5 shadow-sm dark:bg-surface"
            >
                {children}
            </motion.div>
        </div>
    );
}
