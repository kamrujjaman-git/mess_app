import type { ReactNode } from "react";

interface DashboardSectionHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function DashboardSectionHeader({
  title,
  description,
  action,
  className = "",
}: DashboardSectionHeaderProps) {
  return (
    <header
      className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
