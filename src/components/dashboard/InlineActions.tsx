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
          className="tactile-press flex h-9 w-9 items-center justify-center rounded-lg bg-elevated/60 text-secondary transition-colors duration-150 hover:bg-kpi-sage hover:text-brand-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
          className="tactile-press flex h-9 w-9 items-center justify-center rounded-lg bg-surface/60 text-danger transition-colors duration-150 hover:bg-danger-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger dark:bg-elevated/60"
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
  "h-11 w-full rounded-xl border border-subtle bg-elevated/60 px-3 text-sm text-primary placeholder:text-muted outline-none transition-colors duration-150 focus:border-brand focus:ring-2 focus:ring-brand/30";
