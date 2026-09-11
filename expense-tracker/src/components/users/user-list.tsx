"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Check, Eye, EyeOff, Loader2, UserPlus, Users, X } from "lucide-react";
import type { Role, UserStatus, OperationalPermissions } from "@/domain/models";

interface UserItem {
  uid: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  permissions: OperationalPermissions;
}

const PERMISSION_LABELS: { key: keyof OperationalPermissions; label: string }[] = [
  { key: "viewSalaries", label: "View Salaries" },
  { key: "viewTransport", label: "View Transport" },
  { key: "viewBills", label: "View Bills" },
  { key: "viewOperationalTotals", label: "View Operational Totals" },
];

export function UserList() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users");
      const data = await res.json() as { users?: UserItem[]; error?: string };
      if (!res.ok) { setError(data.error || "Failed to load users."); return; }
      setUsers(data.users ?? []);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchUsers(); }, []);

  return (
    <div className="user-list">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Team & Access</h1>
          <p>Manage team members, roles, and permissions.</p>
        </div>
        <button className="button primary" onClick={() => setShowInviteForm(true)}>
          <UserPlus size={16} /> Invite User
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {showInviteForm && (
        <InviteUserForm
          onClose={() => setShowInviteForm(false)}
          onCreated={() => { setShowInviteForm(false); fetchUsers(); }}
        />
      )}

      {loading ? (
        <div className="loading-state">
          <Loader2 size={24} className="spin" />
          <p>Loading team members…</p>
        </div>
      ) : users.length === 0 ? (
        <div className="panel empty-state">
          <span className="empty-icon"><Users size={28} /></span>
          <h3>No team members</h3>
          <p>Invite your first team member to get started.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Permissions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className={u.status === "deactivated" ? "archived-row" : ""}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === "super_admin" ? "success" : "neutral"}`}>
                      {u.role === "super_admin" ? "Super Admin" : "Secretary"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.status === "active" ? "success" : ""}`}
                      style={u.status === "deactivated" ? { color: "#c4403b", background: "#fff2f1" } : {}}
                    >
                      {u.status === "active" ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td>
                    {u.role === "super_admin" ? (
                      <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Full access</span>
                    ) : (
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {PERMISSION_LABELS.filter((p) => u.permissions[p.key]).map((p) => (
                          <span key={p.key} className="badge neutral" style={{ fontSize: 11 }}>{p.label}</span>
                        ))}
                        {!PERMISSION_LABELS.some((p) => u.permissions[p.key]) && (
                          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>Base only</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="text-right">
                    <button className="text-link" onClick={() => setEditingUser(editingUser === u.uid ? null : u.uid)}>
                      {editingUser === u.uid ? "Close" : "Edit"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingUser && (
        <EditUserModal
          user={users.find((u) => u.uid === editingUser)!}
          onClose={() => setEditingUser(null)}
          onUpdated={() => { setEditingUser(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}

/* ─── Invite User Form ─── */

function InviteUserForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("secretary");
  const [permissions, setPermissions] = useState<OperationalPermissions>({
    viewSalaries: false, viewTransport: false, viewBills: false, viewOperationalTotals: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, permissions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user.");
        return;
      }
      onCreated();
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="panel" style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3>Invite New User</h3>
        <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="form-group">
            <label htmlFor="invite-name">Full Name</label>
            <input id="invite-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="invite-email">Email Address</label>
            <input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="invite-password">Initial Password</label>
            <div style={{ position: "relative" }}>
              <input id="invite-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              <button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)" }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="invite-role">Role</label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="secretary">Secretary</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
        {role === "secretary" && (
          <div className="form-group" style={{ marginTop: "16px" }}>
            <label>Permissions</label>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "8px" }}>
              {PERMISSION_LABELS.map((p) => (
                <label key={p.key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: 14, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={permissions[p.key]}
                    onChange={(e) => setPermissions((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        )}
        {error && <p className="form-error" role="alert" style={{ marginTop: "12px" }}><AlertCircle size={16} /> {error}</p>}
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button type="submit" className="button primary" disabled={submitting}>
            {submitting ? <><Loader2 size={16} className="spin" /> Creating…</> : <><UserPlus size={16} /> Create User</>}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

/* ─── Edit User Modal ─── */

function EditUserModal({ user, onClose, onUpdated }: { user: UserItem; onClose: () => void; onUpdated: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [name, setName] = useState(user.name);
  const [permissions, setPermissions] = useState<OperationalPermissions>(user.permissions);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, status, permissions, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update user.");
        return;
      }
      onUpdated();
    } catch { setError("Network error."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="panel" style={{ marginTop: "24px", border: "2px solid var(--primary)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3>Edit: {user.name}</h3>
        <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <div className="form-group">
            <label htmlFor="edit-name">Name</label>
            <input id="edit-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="edit-role">Role</label>
            <select id="edit-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="secretary">Secretary</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="edit-status">Status</label>
            <select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>
        {role === "secretary" && (
          <div className="form-group" style={{ marginTop: "16px" }}>
            <label>Permissions</label>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "8px" }}>
              {PERMISSION_LABELS.map((p) => (
                <label key={p.key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: 14, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={permissions[p.key]}
                    onChange={(e) => setPermissions((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="form-group" style={{ marginTop: "16px" }}>
          <label htmlFor="edit-reason">Reason for change</label>
          <input id="edit-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you making this change?" required minLength={3} />
        </div>
        {error && <p className="form-error" role="alert" style={{ marginTop: "12px" }}><AlertCircle size={16} /> {error}</p>}
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button type="submit" className="button primary" disabled={submitting}>
            {submitting ? <><Loader2 size={16} className="spin" /> Saving…</> : <><Check size={16} /> Save Changes</>}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
