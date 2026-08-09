"use client";

import { useState } from "react";
import { toast } from "sonner";

import { PlusIcon, SearchIcon, TrashIcon } from "@/components/layout/icons";
import { UserFormModal } from "@/features/users/UserFormModal";
import { useDeleteUser, useUpdateUser, useUsers } from "@/features/users/api";
import { ApiError } from "@/services/http";
import type { TeamMember } from "@/types/api";

/**
 * The team.
 *
 * Only an admin can reach this — every endpoint behind it needs `user:write`,
 * which no other account holds. Roles are deliberately absent from the UI:
 * everyone created here gets the same access, which is everything except this
 * screen.
 */
export function UsersScreen() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<TeamMember | null>(null);

  const { data, isLoading } = useUsers(search || undefined);
  const remove = useDeleteUser();
  const members = data?.items ?? [];

  async function onRemove(member: TeamMember) {
    try {
      await remove.mutateAsync(member.id);
      toast.success("User removed", { description: `${member.full_name} can no longer sign in.` });
      setConfirming(null);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "The server did not respond.";
      toast.error("Could not remove", { description: message });
    }
  }

  return (
    <section style={{ animation: "lsFade 280ms var(--ease-out) both" }}>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <div className="t-small" style={{ marginTop: 6 }}>
            Everyone here can use the whole app. Only you can manage accounts.
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <PlusIcon size={17} />
            Add user
          </button>
        </div>
      </div>

      <div className="search-box" style={{ marginBottom: 16, maxWidth: 360 }}>
        <SearchIcon />
        <input
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
      </div>

      {isLoading && !data ? (
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="ls-shimmer" style={{ height: 56, borderRadius: 10 }} />
            ))}
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="table-card">
          <div className="empty" style={{ padding: "56px 20px" }}>
            <div style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--fg)" }}>
              Nobody matches that
            </div>
            <div className="t-small" style={{ marginTop: 6 }}>
              Try a different name or email.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="table-card desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Last signed in</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="user-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                          {initials(m.full_name)}
                        </span>
                        <span>
                          <strong>{m.full_name}</strong>
                          {m.is_admin ? (
                            <span className="pill brand" style={{ marginLeft: 8 }}>
                              Admin
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td>{m.email}</td>
                    <td>{whenLast(m.last_login_at)}</td>
                    <td>
                      <span className={m.is_active ? "pill ok" : "pill neutral"}>
                        {m.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <RowActions
                        member={m}
                        onEdit={() => setEditing(m)}
                        onRemove={() => setConfirming(m)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="mobile-only"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {members.map((m) => (
              <div key={m.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="user-avatar" style={{ width: 34, height: 34 }}>
                    {initials(m.full_name)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--fg)" }}>
                      {m.full_name}
                    </div>
                    <div className="t-caption" style={{ marginTop: 2, wordBreak: "break-all" }}>
                      {m.email}
                    </div>
                  </div>
                  <span className={m.is_active ? "pill ok" : "pill neutral"}>
                    {m.is_active ? "Active" : "Suspended"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <span className="t-caption" style={{ flex: 1 }}>
                    {m.is_admin ? "Owner account" : whenLast(m.last_login_at)}
                  </span>
                  <RowActions
                    member={m}
                    onEdit={() => setEditing(m)}
                    onRemove={() => setConfirming(m)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <UserFormModal open={adding} member={null} onClose={() => setAdding(false)} />
      <UserFormModal
        open={editing !== null}
        member={editing}
        onClose={() => setEditing(null)}
      />

      {confirming ? (
        <ConfirmRemove
          member={confirming}
          pending={remove.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={() => onRemove(confirming)}
        />
      ) : null}
    </section>
  );
}

function RowActions({
  member,
  onEdit,
  onRemove,
}: {
  member: TeamMember;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const update = useUpdateUser(member.id);

  async function toggle() {
    try {
      await update.mutateAsync({ is_active: !member.is_active });
      toast.success(member.is_active ? "User suspended" : "User restored", {
        description: member.is_active
          ? `${member.full_name} can no longer sign in.`
          : `${member.full_name} can sign in again.`,
      });
    } catch (error) {
      toast.error("Could not change that", {
        description: error instanceof ApiError ? error.message : "The server did not respond.",
      });
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      <button className="btn btn-outline btn-sm" onClick={onEdit}>
        Edit
      </button>
      {/* The owner account has no suspend or remove. The server refuses both
          regardless — this only avoids offering a button that cannot work. */}
      {member.is_admin ? null : (
        <>
          <button className="btn btn-outline btn-sm" onClick={toggle} disabled={update.isPending}>
            {member.is_active ? "Suspend" : "Restore"}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={onRemove}
            aria-label={`Remove ${member.full_name}`}
          >
            <TrashIcon size={14} />
          </button>
        </>
      )}
    </div>
  );
}

function ConfirmRemove({
  member,
  pending,
  onCancel,
  onConfirm,
}: {
  member: TeamMember;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label="Remove user">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <h2>Remove {member.full_name}?</h2>
        </div>
        <div className="modal-body">
          <p className="t-body" style={{ margin: 0 }}>
            They will be signed out everywhere and will not be able to sign in again.
            Anything they created stays.
          </p>
          <p className="t-caption" style={{ marginTop: 10 }}>
            To keep the account but block access, suspend it instead.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn"
            style={{ background: "var(--danger)", color: "#fff" }}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Removing…" : "Remove user"}
          </button>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function whenLast(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : new Date(iso).toLocaleDateString("en-GB");
}
