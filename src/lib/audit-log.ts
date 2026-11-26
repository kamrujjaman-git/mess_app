import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AUDIT_CATEGORIES, type AuditLogInput } from "@/lib/audit-log-types";

export { AUDIT_CATEGORIES } from "@/lib/audit-log-types";
export type { AuditCategory, AuditLogEntry, AuditLogInput } from "@/lib/audit-log-types";

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function reportAuditFailure(): void {
  console.warn("[audit-log] Failed to persist an audit event.");
}

export function recordAuditLog(entry: AuditLogInput): void {
  try {
    const user = auth.currentUser;
    const actorEmail = user?.email?.trim().toLowerCase() ?? "";
    const actorName = entry.actorName?.trim() ||
      user?.displayName?.trim() ||
      actorEmail.split("@")[0] ||
      "";
    const action = entry.action.trim().slice(0, 80);
    const summary = entry.summary.trim().slice(0, 500);

    if (
      !actorEmail ||
      actorEmail.length > 254 ||
      !actorName ||
      actorName.length > 120 ||
      !action ||
      !summary ||
      !MONTH_KEY_PATTERN.test(entry.monthKey) ||
      !AUDIT_CATEGORIES.includes(entry.category)
    ) {
      reportAuditFailure();
      return;
    }

    void addDoc(collection(db, "audit_logs"), {
      action,
      category: entry.category,
      actorEmail,
      actorName,
      summary,
      monthKey: entry.monthKey,
      createdAt: serverTimestamp(),
    }).catch(reportAuditFailure);
  } catch {
    reportAuditFailure();
  }
}
