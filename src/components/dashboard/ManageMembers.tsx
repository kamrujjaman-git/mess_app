"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { toast } from "react-hot-toast";
import {
  Loader2,
  Save,
  UserPlus,
  UserX,
  UserCheck,
  Trash2,
  Mail,
  User,
  Shield,
  ShieldOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Member } from "@/lib/mess";
import { buildWhatsAppLink, normalizeWhatsAppNumber } from "@/lib/mess";
import { InlineActions, inputClass } from "./InlineActions";
import { DeleteConfirmationModal } from "@/components/ui/DeleteConfirmationModal";
import { DashboardSectionHeader } from "./DashboardSectionHeader";

interface ManageMembersProps {
  members: Member[];
  activeView: "add" | "all";
  onAddMember: (name: string, email: string, whatsAppNumber?: string) => Promise<void>;
  onUpdateMember: (member: Member) => Promise<void>;
  onSetMemberStatus: (memberId: string, status: Member["status"]) => Promise<void>;
  onDeleteMember: (memberId: string) => Promise<void>;
}

function WhatsAppActionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="M12 3.2a8.8 8.8 0 0 0-7.4 13.7l-1 3.1 3.2-1A8.8 8.8 0 1 0 12 3.2Z"
        fill="currentColor"
      />
      <path
        d="M9 8.6h6M9 11.1h3.8"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ManageMembers({
  members,
  activeView,
  onAddMember,
  onUpdateMember,
  onSetMemberStatus,
  onDeleteMember,
}: ManageMembersProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const { isSuperAdmin } = useAuth();
  const primaryAdminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "").trim().toLowerCase();

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newWhatsAppNumber, setNewWhatsAppNumber] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsAppNumber, setEditWhatsAppNumber] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [memberPendingDelete, setMemberPendingDelete] = useState<Member | null>(null);

  async function handleAdd() {
    if (!newName.trim()) {
      toast.error("Please enter a member name.");
      return;
    }
    setSaving("add");
    try {
      await onAddMember(newName, newEmail, normalizeWhatsAppNumber(newWhatsAppNumber));
      setNewName("");
      setNewEmail("");
      setNewWhatsAppNumber("");
      toast.success("Member added successfully.");
    } catch (error) {
      console.error("Add member failed:", error);
      toast.error("Failed to add member. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  function startEdit(member: Member) {
    setEditingId(member.id);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditWhatsAppNumber(member.whatsAppNumber ?? "");
  }

  async function handleSaveEdit(member: Member) {
    if (!editName.trim()) {
      toast.error("Please enter a member name.");
      return;
    }
    setSaving(member.id);
    try {
      await onUpdateMember({
        ...member,
        name: editName,
        email: editEmail,
        whatsAppNumber: normalizeWhatsAppNumber(editWhatsAppNumber),
      });
      setEditingId(null);
      toast.success("Member updated successfully.");
    } catch (error) {
      console.error("Update member failed:", error);
      toast.error("Failed to update member. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleStatus(member: Member) {
    const newStatus = member.status === "active" ? "inactive" : "active";
    setSaving(`status-${member.id}`);
    try {
      await onSetMemberStatus(member.id, newStatus);
      toast.success(`Member marked ${newStatus}.`);
    } catch (error) {
      console.error("Update member status failed:", error);
      toast.error("Failed to update member status. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function handleDeleteMember() {
    if (!memberPendingDelete) return;
    const member = memberPendingDelete;
    setSaving(`delete-${member.id}`);
    try {
      await onDeleteMember(member.id);
      setMemberPendingDelete(null);
      toast.success(`${member.name} has been deleted from the mess.`);
    } catch (error) {
      console.error("Delete member failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete member. Please try again."
      );
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleAdminAccess(member: Member) {
    if (!isSuperAdmin) {
      toast.error("Only the Super Admin can change admin access.");
      return;
    }

    const nextIsAdmin = !member.isAdmin;
    setSaving(`admin-${member.id}`);
    try {
      await onUpdateMember({ ...member, isAdmin: nextIsAdmin });
      toast.success(nextIsAdmin ? "Admin access granted." : "Admin access revoked.");
    } catch (error) {
      console.error("Update admin access failed:", error);
      toast.error("Failed to update admin access. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  const activeCount = members.filter((m) => m.status === "active").length;

  return (
    <div className="space-y-4">
      {activeView === "add" ? (
        <>
          <DashboardSectionHeader
            title="Add New Member"
            description="Add a member and optional contact details."
            action={
              <span className="text-xs font-medium text-secondary dark:text-secondary">
                <span className="tabular-nums">{activeCount} active / {members.length} total</span>
              </span>
            }
          />
          <div id="admin-add-member" className="glass-card rounded-2xl p-4 sm:p-6">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="block min-w-0">
                <span className="mb-1 block text-xs font-medium text-secondary dark:text-secondary">Full name</span>
                <span className="relative block">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </span>
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-xs font-medium text-secondary dark:text-secondary">Email address</span>
                <span className="relative block">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className={`${inputClass} pl-9`}
                  />
                </span>
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-xs font-medium text-secondary dark:text-secondary">WhatsApp number</span>
                <input
                  type="text"
                  value={newWhatsAppNumber}
                  onChange={(e) => setNewWhatsAppNumber(e.target.value)}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving === "add" || !newName.trim()}
                className="tactile-press flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-fill px-5 text-sm font-semibold text-brand-on-fill transition-colors duration-150 hover:bg-brand-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
              >
                {saving === "add" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Add
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {activeView === "all" ? (
        <>
          <DashboardSectionHeader
            title="All Members"
            description="Review member details, status, and access."
            action={
              <span className="text-xs font-medium text-secondary dark:text-secondary">
                <span className="tabular-nums">{members.length}</span> members
              </span>
            }
          />
          <div id="admin-all-members" className="glass-card overflow-hidden rounded-2xl">
          {members.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">No members yet.</p>
          ) : (
            <ul className="divide-y divide-subtle/60">
              {members.map((member) => (
              <li
                key={member.id}
                className={`px-4 py-4 transition-colors sm:px-6 ${
                  member.status === "active"
                    ? "hover:bg-elevated/80 dark:hover:bg-elevated/40"
                    : "bg-container/70 text-secondary hover:bg-container"
                }`}
              >
                {editingId === member.id ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass}
                        placeholder="Name"
                      />
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className={inputClass}
                        placeholder="Email"
                      />
                      <input
                        type="text"
                        value={editWhatsAppNumber}
                        onChange={(e) => setEditWhatsAppNumber(e.target.value)}
                        className={inputClass}
                        placeholder="WhatsApp number"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(member)}
                        disabled={saving === member.id}
                        className="tactile-press flex h-9 items-center gap-1.5 rounded-lg bg-brand-fill px-3 text-sm font-medium text-brand-on-fill hover:bg-brand-fill-hover disabled:opacity-60"
                      >
                        {saving === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="h-9 rounded-lg px-3 text-sm font-medium text-secondary hover:bg-container dark:text-muted dark:hover:bg-elevated"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {member.photoURL ? (
                        <Image
                          src={member.photoURL}
                          alt=""
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-container text-sm font-semibold text-secondary dark:bg-container dark:text-secondary">
                          {(member.name.trim().charAt(0) || "M").toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{member.name}</p>
                        <span
                          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${member.status === "active"
                            ? "bg-success-surface text-success-on-surface"
                            : "border border-subtle/70 bg-container text-secondary dark:border-subtle dark:bg-elevated dark:text-secondary"
                            }`}
                        >
                          {member.status === "active" ? "Active" : "INACTIVE"}
                        </span>
                        {primaryAdminEmail && member.email?.trim().toLowerCase() === primaryAdminEmail ? (
                          <span className="flex-shrink-0 rounded-full bg-success-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success-on-surface">
                            Super Admin
                          </span>
                        ) : member.isAdmin ? (
                          <span className="flex-shrink-0 rounded-full bg-warning-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-on-surface">
                            Admin
                          </span>
                        ) : null}
                        {member.whatsAppNumber && (
                          <a
                            href={buildWhatsAppLink(member, 0)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-success-border bg-success-surface text-success transition hover:bg-success-border"
                            aria-label={`Open WhatsApp for ${member.name}`}
                            title={`Open WhatsApp for ${member.name}`}
                          >
                            <WhatsAppActionIcon />
                          </a>
                        )}
                      </div>
                      {member.email && (
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {member.email}
                        </p>
                      )}
                      {member.whatsAppNumber && (
                        <p className="mt-0.5 truncate text-sm text-muted">
                          WhatsApp: {member.whatsAppNumber}
                        </p>
                      )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-start gap-2 sm:flex-nowrap sm:gap-3">
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggleAdminAccess(member)}
                          disabled={saving === `admin-${member.id}`}
                          className={`tactile-toggle inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors sm:h-9 sm:px-3 sm:text-xs ${member.isAdmin
                            ? "bg-warning-surface text-warning-on-surface hover:bg-warning-border"
                            : "bg-success-surface text-success-on-surface hover:bg-success-border"
                            }`}
                          title={member.isAdmin ? "Revoke Admin Access" : "Grant Admin Access"}
                          aria-label={member.isAdmin ? "Revoke Admin Access" : "Grant Admin Access"}
                        >
                          <AnimatePresence initial={false} mode="wait">
                            {saving === `admin-${member.id}` ? (
                              <motion.span
                                key="saving"
                                initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={reduceMotion ? { duration: 0 } : { duration: 0.12 }}
                                className="inline-flex"
                              >
                                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                              </motion.span>
                            ) : (
                              <motion.span
                                key={member.isAdmin ? "admin" : "member"}
                                initial={reduceMotion ? false : { scale: 0.75, rotate: -8 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 24 }}
                                className="inline-flex"
                              >
                                {member.isAdmin ? (
                                  <ShieldOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                ) : (
                                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                )}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <span className="whitespace-nowrap">
                            {member.isAdmin ? "Revoke Admin Access" : "Grant Admin Access"}
                          </span>
                        </button>
                      )}

                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <InlineActions
                          onEdit={() => startEdit(member)}
                          editLabel={`Edit ${member.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(member)}
                          disabled={saving === `status-${member.id}` || saving === `remove-${member.id}`}
                          className={`tactile-toggle flex h-8 w-8 items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9 ${member.status === "active"
                            ? "text-warning hover:bg-warning-surface"
                            : "text-brand hover:bg-success-surface"
                            }`}
                          aria-label={
                            member.status === "active"
                              ? "Mark inactive"
                              : "Reactivate member"
                          }
                          title={
                            member.status === "active"
                              ? "Mark Inactive"
                              : "Reactivate"
                          }
                        >
                          <AnimatePresence initial={false} mode="wait">
                            {saving === `status-${member.id}` ? (
                              <motion.span
                                key="saving"
                                initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={reduceMotion ? { duration: 0 } : { duration: 0.12 }}
                                className="inline-flex"
                              >
                                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                              </motion.span>
                            ) : (
                              <motion.span
                                key={member.status}
                                initial={reduceMotion ? false : { scale: 0.75, rotate: -8 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 24 }}
                                className="inline-flex"
                              >
                                {member.status === "active" ? (
                                  <UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                )}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                        {isSuperAdmin ? (
                          <button
                            type="button"
                            onClick={() => setMemberPendingDelete(member)}
                            disabled={saving === `delete-${member.id}`}
                            className="tactile-press flex h-8 w-8 items-center justify-center rounded-lg text-danger transition hover:bg-danger-surface sm:h-9 sm:w-9"
                            title={`Delete ${member.name}`}
                            aria-label={`Delete ${member.name}`}
                          >
                            {saving === `delete-${member.id}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </li>
              ))}
            </ul>
          )}
          </div>
        </>
      ) : null}
      <DeleteConfirmationModal
        open={Boolean(memberPendingDelete)}
        title="Remove this member?"
        description={memberPendingDelete ? `Permanently delete ${memberPendingDelete.name} from the mess database? This removes the member record and revokes login access.` : ""}
        confirmLabel="Remove member"
        busy={Boolean(memberPendingDelete && saving === `delete-${memberPendingDelete.id}`)}
        onConfirm={handleDeleteMember}
        onCancel={() => setMemberPendingDelete(null)}
      />
    </div>
  );
}
