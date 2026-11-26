import type { Timestamp } from "firebase/firestore";

export const AUDIT_CATEGORIES = [
  "meals",
  "bazar",
  "deposits",
  "fixed_costs",
  "members",
] as const;

export type AuditCategory = typeof AUDIT_CATEGORIES[number];

export interface AuditLogInput {
  action: string;
  category: AuditCategory;
  summary: string;
  monthKey: string;
  actorName?: string;
}

export interface AuditLogEntry extends AuditLogInput {
  id: string;
  actorEmail: string;
  actorName: string;
  createdAt: Timestamp;
}
