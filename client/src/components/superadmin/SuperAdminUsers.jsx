// client/src/components/superadmin/SuperAdminUsers.jsx

import { useState, useEffect } from "react";
import { getAllUsersAcrossTenants, updateUserAsSuperAdmin, deleteUserAsSuperAdmin } from "../../api/superadmin";

const COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#f43f5e","#8b5cf6","#06b6d4"];
const DEPTS  = ["Tech","Creative","Finance","HR","Operations","Marketing","Sales","Management"];
const ROLES  = ["staff", "admin", "manager", "supervisor", "superadmin"];

export default function SuperAdminUsers() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [error, setError]       = useState("");

  // ── Inline edit state ────────────────────────────────────────────────
  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [showEditPass, setShowEditPass] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const { users } = await getAllUsersAcrossTenants();
      setUsers(users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getInitials(name) {
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  async function handleDelete(userId, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(userId);
    try {
      await deleteUserAsSuperAdmin(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  function startEdit(u) {
    setEditingId(u.id);
    setShowEditPass(false);
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      dept: u.dept,
      officeId: u.officeId || "",
      color: u.color,
      password: "", // blank = leave unchanged
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(userId) {
    setEditSaving(true);
    setError("");
    try {
      const payload = {
        ...editForm,
        avatarInitials: getInitials(editForm.name),
      };
      if (!payload.password) delete payload.password;

      const { user } = await updateUserAsSuperAdmin(userId, payload);
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...user } : u)));
      setEditingId(null);
      setEditForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black tracking-tight">All Users</h1>
        <p className="text-zinc-500 text-sm mt-1">{users.length} across all companies</p>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-800 rounded-xl" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
          No users yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map(u => {
            const isEditing = editingId === u.id;

            if (isEditing) {
              return (
                <div key={u.id} className="bg-zinc-900 border border-purple-700/60 rounded-xl px-4 py-4 flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Full Name">
                      <input
                        type="text" value={editForm.name}
                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        type="email" value={editForm.email}
                        onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                        className="input-field"
                      />
                    </Field>
                    <Field label="Department">
                      <select
                        value={editForm.dept}
                        onChange={e => setEditForm(p => ({ ...p, dept: e.target.value }))}
                        className="input-field"
                      >
                        {DEPTS.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </Field>
                    <Field label="Role">
                      <select
                        value={editForm.role}
                        onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                        className="input-field"
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="New Password (optional)">
                      <div className="relative">
                        <input
                          type={showEditPass ? "text" : "password"}
                          placeholder="Leave blank to keep current password"
                          value={editForm.password}
                          onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                          className="input-field" style={{ paddingRight: 40 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPass(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors"
                        >
                          {showEditPass ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                    </Field>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Avatar Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map(c => (
                        <button
                          key={c} type="button"
                          onClick={() => setEditForm(p => ({ ...p, color: c }))}
                          className="w-7 h-7 rounded-full transition-all"
                          style={{
                            background: c,
                            border: editForm.color === c ? "3px solid white" : "3px solid transparent",
                            boxShadow: editForm.color === c ? `0 0 0 2px ${c}` : "none",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => saveEdit(u.id)}
                      disabled={editSaving}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                    >
                      {editSaving ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={editSaving}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 border border-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={u.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: u.color + "22", color: u.color, border: `1.5px solid ${u.color}44` }}
                >
                  {u.avatarInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{u.name}</span>
                    {/* Tenant/company tag */}
                    {u.tenant ? (
                      <span className="text-xs bg-purple-950 text-purple-400 border border-purple-800 px-2 py-0.5 rounded-full">
                        {u.tenant.name}
                      </span>
                    ) : (
                      <span className="text-xs bg-zinc-800 text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded-full">
                        No company
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500">{u.email} · {u.dept}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  u.role === "superadmin"
                    ? "bg-purple-950 text-purple-400"
                    : u.role === "admin"
                    ? "bg-indigo-950 text-indigo-400"
                    : "bg-zinc-800 text-zinc-400"
                }`}>
                  {u.role}
                </span>
                <button
                  onClick={() => startEdit(u)}
                  className="text-xs text-zinc-500 hover:text-purple-400 transition-colors px-2 py-1 rounded-lg border border-transparent hover:border-purple-900/50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(u.id, u.name)}
                  disabled={deleting === u.id}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg border border-transparent hover:border-red-900/50"
                >
                  {deleting === u.id ? "…" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .input-field {
          width: 100%;
          background: #27272a;
          border: 1px solid #3f3f46;
          border-radius: 10px;
          padding: 10px 14px;
          color: white;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus { border-color: #a855f7; }
        .input-field option { background: #18181b; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}