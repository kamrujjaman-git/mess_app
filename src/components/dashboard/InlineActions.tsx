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
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 text-slate-600 transition-colors duration-150 hover:bg-emerald-50 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-slate-800/60 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
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
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/60 text-red-600 transition-colors duration-150 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-slate-800/60 dark:hover:bg-red-950/40"
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
  "h-11 w-full rounded-xl border border-slate-300/70 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600/80 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";
