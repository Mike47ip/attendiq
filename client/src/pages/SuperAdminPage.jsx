// client/src/pages/SuperAdminPage.jsx

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import SuperAdminUsers from "../components/superadmin/SuperAdminUsers";
import {
  getAllTenants,
  createTenant,
  updateTenant,
  toggleTenant,
  deleteTenant,
  getPlatformStats,
} from "../api/superadmin";

const EMPTY_FORM = { name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "" };

const NAV = [
  { key: "companies", label: "Companies", icon: "◈" },
  { key: "users",     label: "Users",     icon: "◎" },
];

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const [view, setView]           = useState("companies");
  const [tenants, setTenants]     = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [toggling, setToggling]   = useState(null);
  const [showAdminPass, setShowAdminPass] = useState(false);

  // ── Inline tenant edit state ─────────────────────────────────────────
  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([getAllTenants(), getPlatformStats()]);
      setTenants(t.tenants);
      setStats(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createTenant(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setShowAdminPass(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id) => {
    setToggling(id);
    try {
      await toggleTenant(id);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}" and ALL their data? This cannot be undone.`)) return;
    try {
      await deleteTenant(id);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  function startEdit(tenant) {
    setEditingId(tenant.id);
    setEditForm({ name: tenant.name, slug: tenant.slug });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(tenantId) {
    setEditSaving(true);
    setError(null);
    try {
      const { tenant } = await updateTenant(tenantId, editForm);
      setTenants(prev => prev.map(t => (t.id === tenantId ? { ...t, ...tenant } : t)));
      setEditingId(null);
      setEditForm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    // ── Key fix: use min-h-[100dvh] instead of min-h-screen ──────────────
    // Chrome iOS has a dynamic viewport that differs from 100vh, causing
    // content to get clipped behind the browser chrome. 100dvh respects
    // the actual visible viewport height. overflow-x-hidden prevents any
    // horizontal bleed from expanded forms.
    <div
      className="bg-zinc-950 text-white flex flex-col overflow-x-hidden"
      style={{ minHeight: "100dvh" }}
    >

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">A</div>
            <span className="font-bold text-base tracking-tight">AttendIQ</span>
            <span className="text-xs bg-purple-950 text-purple-400 border border-purple-800 px-2 py-0.5 rounded-full ml-1">
              Superadmin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400 hidden sm:block">{user?.name}</span>
            <button
              onClick={logout}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap"
              style={{
                color: view === key ? "#c084fc" : "#6b7280",
                borderBottom: view === key ? "2px solid #c084fc" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Key fix: removed flex-1, use width-full + auto height ──────────
          flex-1 on a flex child inside a fixed-height parent is what causes
          Chrome iOS to clip content when inner components expand. Letting
          main size naturally to its content avoids the clipping entirely.   */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8 pb-24">

        {view === "companies" && (
          <>
            {/* Platform stats */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Companies",  value: stats.totalTenants,       color: "#a5b4fc" },
                  { label: "Active Companies", value: stats.activeTenants,      color: "#4ade80" },
                  { label: "Total Staff",      value: stats.totalUsers,         color: "#818cf8" },
                  { label: "Check-ins Today",  value: stats.totalCheckInsToday, color: "#fb923c" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                    <div className="text-3xl font-black" style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                    <div className="text-xs text-zinc-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black tracking-tight">Companies</h1>
                <p className="text-zinc-500 text-sm mt-1">{tenants.length} registered</p>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 4px 16px #4f46e533" }}
              >
                + New Company
              </button>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Create form */}
            {showForm && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="font-bold text-sm mb-5">New Company</h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company Name</label>
                    <input
                      required placeholder="Acme Corp" value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company Slug</label>
                    <input
                      required placeholder="acme-corp" value={form.slug}
                      onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                    />
                    <p className="text-xs text-zinc-600">Used as company code for login</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Admin Name</label>
                    <input
                      required placeholder="John Doe" value={form.adminName}
                      onChange={e => setForm(p => ({ ...p, adminName: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Admin Email</label>
                    <input
                      required type="email" placeholder="admin@acme.com" value={form.adminEmail}
                      onChange={e => setForm(p => ({ ...p, adminEmail: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Admin Password</label>
                    <div className="relative">
                      <input
                        required type={showAdminPass ? "text" : "password"}
                        placeholder="Temporary password" value={form.adminPassword}
                        onChange={e => setForm(p => ({ ...p, adminPassword: e.target.value }))}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 w-full"
                        style={{ paddingRight: 44 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPass(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors"
                      >
                        {showAdminPass ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex gap-3">
                    <button
                      type="submit" disabled={saving}
                      className="flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                    >
                      {saving ? "Creating…" : "Create Company"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setShowAdminPass(false); }}
                      className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 border border-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tenants list */}
            {loading ? (
              <div className="flex flex-col gap-3 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-800 rounded-2xl" />)}
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
                No companies yet. Create your first one.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {tenants.map(tenant => {
                  const isEditing = editingId === tenant.id;

                  if (isEditing) {
                    return (
                      <div key={tenant.id} className="bg-zinc-900 border border-purple-700/60 rounded-2xl px-5 py-4 flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company Name</label>
                            <input
                              value={editForm.name}
                              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company Slug</label>
                            <input
                              value={editForm.slug}
                              onChange={e => setEditForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(tenant.id)}
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
                    <div
                      key={tenant.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-4"
                      style={{ opacity: tenant.isActive ? 1 : 0.6 }}
                    >
                      {/* Status dot */}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          background: tenant.isActive ? "#4ade80" : "#f87171",
                          boxShadow: tenant.isActive ? "0 0 8px #4ade8077" : "none",
                        }}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{tenant.name}</span>
                          <span className="text-xs text-zinc-600 font-mono">{tenant.slug}</span>
                          {!tenant.isActive && (
                            <span className="text-xs bg-red-950 text-red-400 border border-red-900 px-2 py-0.5 rounded-full">Inactive</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500 flex-wrap">
                          <span>👥 {tenant._count.users} staff</span>
                          <span>🏢 {tenant._count.offices} offices</span>
                          <span>📋 {tenant._count.attendance} records</span>
                          <span>Created {new Date(tenant.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => startEdit(tenant)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-purple-400 border border-transparent hover:border-purple-900/50 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggle(tenant.id)}
                          disabled={toggling === tenant.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                          style={{
                            background: tenant.isActive ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
                            color: tenant.isActive ? "#f87171" : "#4ade80",
                            border: `1px solid ${tenant.isActive ? "#f8717133" : "#4ade8033"}`,
                          }}
                        >
                          {toggling === tenant.id ? "…" : tenant.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => handleDelete(tenant.id, tenant.name)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-red-400 border border-transparent hover:border-red-900/50 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "users" && <SuperAdminUsers />}

      </main>
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