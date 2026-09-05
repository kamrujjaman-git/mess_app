"use client";

import { Pencil, Trash2 } from "lucide-react";

interface InlineActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
}

export function InlineActions({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
}: InlineActionsProps) {
  return (
    <div className="flex shrink-0 gap-1">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-800/60 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
          aria-label={editLabel}
          title={editLabel}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 text-red-600 transition-colors hover:bg-red-50 dark:bg-slate-800/60 dark:hover:bg-red-950/40"
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-300/60 bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600/80 dark:bg-transparent";
