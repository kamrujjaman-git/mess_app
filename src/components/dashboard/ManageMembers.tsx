"use client";

import { useState } from "react";
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

interface ManageMembersProps {
  members: Member[];
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
  onAddMember,
  onUpdateMember,
  onSetMemberStatus,
  onDeleteMember,
}: ManageMembersProps) {
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

  async function handleDeleteMember(member: Member) {
    const confirmed = window.confirm(
      `Permanently delete ${member.name} from the mess database? This will remove the member record and revoke login access.`
    );
    if (!confirmed) return;

    setSaving(`delete-${member.id}`);
    try {
      await onDeleteMember(member.id);
      toast.success(`${member.name} has been deleted from the mess.`);
    } catch (error) {
      console.error("Delete member failed:", error);
      toast.error("Failed to delete member. Please try again.");
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
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Add New Member</h3>
          <span className="text-xs text-slate-500">
            {activeCount} active / {members.length} total
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              placeholder="Email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <input
            type="text"
            placeholder="WhatsApp number"
            value={newWhatsAppNumber}
            onChange={(e) => setNewWhatsAppNumber(e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving === "add" || !newName.trim()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
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

      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-700/60 sm:px-6">
          <h3 className="text-base font-semibold">All Members</h3>
        </div>

        {members.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No members yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((member) => (
              <li
                key={member.id}
                className={`px-4 py-4 sm:px-6 ${member.status === "inactive" ? "opacity-60" : ""
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
                        className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
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
                        className="h-9 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{member.name}</p>
                        <span
                          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${member.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                        >
                          {member.status === "active" ? "Active" : "Inactive"}
                        </span>
                        {primaryAdminEmail && member.email?.trim().toLowerCase() === primaryAdminEmail ? (
                          <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Super Admin
                          </span>
                        ) : member.isAdmin ? (
                          <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Admin
                          </span>
                        ) : null}
                        {member.whatsAppNumber && (
                          <a
                            href={buildWhatsAppLink(member, 0)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                            aria-label={`Open WhatsApp for ${member.name}`}
                            title={`Open WhatsApp for ${member.name}`}
                          >
                            <WhatsAppActionIcon />
                          </a>
                        )}
                      </div>
                      {member.email && (
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          {member.email}
                        </p>
                      )}
                      {member.whatsAppNumber && (
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          WhatsApp: {member.whatsAppNumber}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-start gap-2 sm:gap-3">
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggleAdminAccess(member)}
                          disabled={saving === `admin-${member.id}`}
                          className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors sm:h-9 sm:px-3 sm:text-xs ${member.isAdmin
                            ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                            }`}
                          title={member.isAdmin ? "Revoke Admin Access" : "Grant Admin Access"}
                          aria-label={member.isAdmin ? "Revoke Admin Access" : "Grant Admin Access"}
                        >
                          {saving === `admin-${member.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                          ) : member.isAdmin ? (
                            <ShieldOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : (
                            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
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
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9 ${member.status === "active"
                            ? "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                            : "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
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
                          {saving === `status-${member.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                          ) : member.status === "active" ? (
                            <UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMember(member)}
                          disabled={saving === `delete-${member.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40 sm:h-9 sm:w-9"
                          title={`Delete ${member.name}`}
                          aria-label={`Delete ${member.name}`}
                        >
                          {saving === `delete-${member.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
