"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { DashboardSectionHeader } from "./DashboardSectionHeader";
import { db } from "@/lib/firebase";
import {
  AUDIT_CATEGORIES,
  type AuditCategory,
  type AuditLogEntry,
} from "@/lib/audit-log-types";

const PAGE_SIZE = 100;

const filters: Array<{ value: AuditCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "meals", label: "Meals" },
  { value: "bazar", label: "Bazar" },
  { value: "deposits", label: "Deposits" },
  { value: "fixed_costs", label: "Fixed Costs" },
  { value: "members", label: "Members" },
];

function isAuditCategory(value: unknown): value is AuditCategory {
  return AUDIT_CATEGORIES.some((category) => category === value);
}

function parseAuditEntry(
  id: string,
  data: DocumentData
): AuditLogEntry | null {
  if (
    typeof data.action !== "string" ||
    !isAuditCategory(data.category) ||
    typeof data.actorEmail !== "string" ||
    typeof data.actorName !== "string" ||
    typeof data.summary !== "string" ||
    typeof data.monthKey !== "string" ||
    !(data.createdAt instanceof Timestamp)
  ) {
    return null;
  }

  return {
    id,
    action: data.action,
    category: data.category,
    actorEmail: data.actorEmail,
    actorName: data.actorName,
    summary: data.summary,
    monthKey: data.monthKey,
    createdAt: data.createdAt,
  };
}

function formatTimestamp(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getFirstAuditPage() {
  return getDocs(query(
    collection(db, "audit_logs"),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE)
  ));
}

export function ActivityLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFirstAuditPage()
      .then((firstPage) => {
        if (cancelled) return;
        setError(null);
        setEntries(
          firstPage.docs
            .map((snapshot) => parseAuditEntry(snapshot.id, snapshot.data()))
            .filter((entry): entry is AuditLogEntry => entry !== null)
        );
        setCursor(firstPage.docs.at(-1) ?? null);
        setHasMore(firstPage.size === PAGE_SIZE);
      })
      .catch(() => {
        if (cancelled) return;
        console.error("Failed to load the audit log.");
        setError("Could not load the activity log. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const firstPage = await getFirstAuditPage();
      setError(null);
      setEntries(
        firstPage.docs
          .map((snapshot) => parseAuditEntry(snapshot.id, snapshot.data()))
          .filter((entry): entry is AuditLogEntry => entry !== null)
      );
      setCursor(firstPage.docs.at(-1) ?? null);
      setHasMore(firstPage.size === PAGE_SIZE);
    } catch {
      console.error("Failed to load the audit log.");
      setError("Could not load the activity log. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOlderEntries = useCallback(async () => {
    if (!cursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = await getDocs(query(
        collection(db, "audit_logs"),
        orderBy("createdAt", "desc"),
        startAfter(cursor),
        limit(PAGE_SIZE)
      ));
      setEntries((previous) => [
        ...previous,
        ...nextPage.docs
          .map((snapshot) => parseAuditEntry(snapshot.id, snapshot.data()))
          .filter((entry): entry is AuditLogEntry => entry !== null),
      ]);
      setCursor(nextPage.docs.at(-1) ?? cursor);
      setHasMore(nextPage.size === PAGE_SIZE);
    } catch {
      console.error("Failed to load older audit entries.");
      setError("Could not load older activity. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore]);

  const visibleEntries = useMemo(
    () => selectedCategory === "all"
      ? entries
      : entries.filter((entry) => entry.category === selectedCategory),
    [entries, selectedCategory]
  );

  return (
    <section className="space-y-4">
      <DashboardSectionHeader
        title="Activity Log"
        description="Read-only history of important changes made by administrators."
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter activity by category">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={selectedCategory === filter.value}
            onClick={() => setSelectedCategory(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              selectedCategory === filter.value
                ? "border-brand-fill bg-brand-fill text-brand-on-fill"
                : "border-subtle bg-surface text-secondary hover:bg-container dark:bg-elevated"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-danger-border bg-danger-surface p-4 text-sm text-danger-on-surface sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadFirstPage();
            }}
            className="min-h-9 rounded-lg border border-danger-border px-3 font-semibold"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-32 items-center justify-center rounded-2xl border border-subtle bg-surface text-secondary dark:bg-elevated">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading activity log" />
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-2xl border border-subtle bg-surface px-4 py-10 text-center text-sm text-secondary dark:bg-elevated">
          No activity entries found for this category.
        </div>
      ) : (
        <ol className="space-y-3">
          {visibleEntries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-2xl border border-subtle bg-surface p-4 shadow-sm dark:bg-elevated sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-info-surface px-2.5 py-1 text-[11px] font-semibold text-info-on-surface">
                      {entry.actorName}
                    </span>
                    <span className="text-xs text-muted" title={entry.actorEmail}>
                      {entry.actorEmail}
                    </span>
                    <span className="rounded-full bg-container px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">
                      {entry.category.replace("_", " ")}
                    </span>
                  </div>
                  <h2 className="mt-3 text-sm font-semibold text-primary">
                    {entry.action}
                  </h2>
                  <p className="mt-1 break-words text-sm leading-relaxed text-secondary">
                    {entry.summary}
                  </p>
                </div>
                <time
                  dateTime={entry.createdAt.toDate().toISOString()}
                  className="shrink-0 text-xs tabular-nums text-muted"
                >
                  {formatTimestamp(entry.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}

      {!loading && hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadOlderEntries}
            disabled={loadingMore}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-subtle bg-surface px-4 text-sm font-semibold text-secondary transition-colors hover:bg-container disabled:opacity-60 dark:bg-elevated"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Load older activity
          </button>
        </div>
      ) : null}
    </section>
  );
}
