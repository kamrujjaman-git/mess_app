"use client";

import { motion, type PanInfo } from "framer-motion";
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
            className={`relative w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 transition-all touch-pan-y ${className}`}
            style={style}
        >
            {onEdit ? (
                <button
                    type="button"
                    onClick={() => handleAction("edit")}
                    aria-label={editLabel}
                    className="absolute inset-y-0 left-0 z-0 flex w-20 cursor-pointer items-center justify-center rounded-l-2xl bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
                >
                    <Pencil className="h-5 w-5" aria-hidden="true" />
                </button>
            ) : null}
            {onDelete ? (
                <button
                    type="button"
                    onClick={() => handleAction("delete")}
                    aria-label={deleteLabel}
                    className="absolute inset-y-0 right-0 z-0 flex w-20 cursor-pointer items-center justify-center rounded-r-2xl bg-rose-500 text-white transition-colors hover:bg-rose-600 active:bg-rose-700"
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
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{
                    touchAction: "pan-y",
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "hidden",
                }}
                className="relative z-10 h-full w-full transform-gpu will-change-transform cursor-pointer select-none rounded-2xl bg-white p-2.5 shadow-sm dark:bg-slate-900"
            >
                {children}
            </motion.div>
        </div>
    );
}
