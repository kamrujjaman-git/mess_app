import { FieldValue } from "firebase-admin/firestore";
import { AUDIT_CATEGORIES, type AuditCategory } from "@/lib/audit-log-types";
import { getAdminFirestore } from "@/lib/firebase-admin";

interface ServerAuditLogInput {
  action: string;
  category: AuditCategory;
  actorEmail: string;
  actorName: string;
  summary: string;
  monthKey: string;
}

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function reportAuditFailure(): void {
  console.warn("[audit-log] Failed to persist a server audit event.");
}

export async function recordServerAuditLog(entry: ServerAuditLogInput): Promise<void> {
  try {
    const action = entry.action.trim().slice(0, 80);
    const actorEmail = entry.actorEmail.trim().toLowerCase();
    const actorName = entry.actorName.trim().slice(0, 120);
    const summary = entry.summary.trim().slice(0, 500);

    if (
      !action ||
      !actorEmail ||
      actorEmail.length > 254 ||
      !actorName ||
      !summary ||
      !MONTH_KEY_PATTERN.test(entry.monthKey) ||
      !AUDIT_CATEGORIES.includes(entry.category)
    ) {
      reportAuditFailure();
      return;
    }

    await getAdminFirestore().collection("audit_logs").add({
      action,
      category: entry.category,
      actorEmail,
      actorName,
      summary,
      monthKey: entry.monthKey,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    reportAuditFailure();
  }
}
