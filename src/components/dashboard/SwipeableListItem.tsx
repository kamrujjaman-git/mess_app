"use client";

import { motion, type PanInfo } from "framer-motion";
import { type ReactNode, useState } from "react";

interface SwipeableListItemProps {
    children: ReactNode;
    onEdit?: () => void;
    onDelete?: () => void;
    editLabel?: string;
    deleteLabel?: string;
    className?: string;
}

const SWIPE_THRESHOLD = 80;
const OPEN_OFFSET = 90;

export function SwipeableListItem({
    children,
    onEdit,
    onDelete,
    editLabel = "Edit",
    deleteLabel = "Delete",
    className = "",
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
        <div className={`relative overflow-hidden touch-pan-y ${className}`}>
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between bg-transparent px-3">
                <div className="flex h-full items-center">
                    {onEdit ? (
                        <button
                            type="button"
                            onClick={() => handleAction("edit")}
                            className="flex h-12 items-center justify-center rounded-full bg-emerald-600/10 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-600/15"
                        >
                            {editLabel}
                        </button>
                    ) : null}
                </div>
                <div className="flex h-full items-center">
                    {onDelete ? (
                        <button
                            type="button"
                            onClick={() => handleAction("delete")}
                            className="flex h-12 items-center justify-center rounded-full bg-red-600/10 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-600/15"
                        >
                            {deleteLabel}
                        </button>
                    ) : null}
                </div>
            </div>

            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                animate={{ x: openSide === "left" ? OPEN_OFFSET : openSide === "right" ? -OPEN_OFFSET : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ touchAction: "pan-y" }}
                className="relative z-10 w-full bg-white dark:bg-slate-900"
            >
                {children}
            </motion.div>
        </div>
    );
}
