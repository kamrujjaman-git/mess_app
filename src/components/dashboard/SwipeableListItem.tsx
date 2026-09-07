"use client";

import { motion, type PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";
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

const SWIPE_THRESHOLD = 80;
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

        if (offsetX >= SWIPE_THRESHOLD && onEdit) {
            setOpenSide("left");
            return;
        }

        if (offsetX <= -SWIPE_THRESHOLD && onDelete) {
            setOpenSide("right");
            return;
        }

        setOpenSide(null);
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
        <div className={`relative w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white touch-pan-y dark:border-slate-800 dark:bg-slate-900 ${className}`} style={style}>
            {onEdit ? (
                <button
                    type="button"
                    onClick={() => handleAction("edit")}
                    className="absolute inset-y-0 left-0 z-0 flex items-center justify-center bg-gradient-to-b from-emerald-500 to-emerald-700 px-4 text-sm font-semibold text-white transition hover:brightness-105"
                >
                    {editLabel}
                </button>
            ) : null}
            {onDelete ? (
                <div className="absolute inset-y-0 right-0 z-0 flex items-center justify-end rounded-r-xl bg-rose-50 px-3 dark:bg-rose-950/30">
                    <button
                        type="button"
                        onClick={() => handleAction("delete")}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white shadow-sm transition-transform hover:bg-rose-700 active:scale-95"
                        aria-label={deleteLabel}
                    >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            ) : null}

            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                animate={{ x: openSide === "left" ? OPEN_OFFSET : openSide === "right" ? -OPEN_OFFSET : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ touchAction: "pan-y" }}
                className="relative z-10 h-full w-full rounded-xl bg-white p-2.5 transition-transform duration-200 ease-out dark:bg-slate-900"
            >
                {children}
            </motion.div>
        </div>
    );
}
