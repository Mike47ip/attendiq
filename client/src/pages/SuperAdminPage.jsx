// client/src/pages/SuperAdminPage.jsx

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";

const BASE = import.meta.env.VITE_API_URL || "/api";

function authHeaders() {
  const token = localStorage.getItem("attendiq_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: authHeaders(), credentials: "include", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function apiPatch(path) {
  const res = await fetch(`${BASE}${path}`, { method: "PATCH", headers: authHeaders(), credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers: authHeaders(), credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

const EMPTY_FORM = { name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "" };

export default function SuperAdminPage() {
  const { user, logout } = useAuth();
  const [tenants, setTenants]     = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [toggling, setToggling]   = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([
        apiGet("/superadmin/tenants"),
        apiGet("/superadmin/stats"),
      ]);
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
      await apiPost("/superadmin/tenants", form);
      setForm(EMPTY_FORM);
      setShowForm(false);
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
      await apiPatch(`/superadmin/tenants/${id}/toggle`);
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
      await apiDelete(`/superadmin/tenants/${id}`);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

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
            <button onClick={logout}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">

        {/* Platform stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Companies",    value: stats.totalTenants,       color: "#a5b4fc" },
              { label: "Active Companies",   value: stats.activeTenants,      color: "#4ade80" },
              { label: "Total Staff",        value: stats.totalUsers,         color: "#818cf8" },
              { label: "Check-ins Today",    value: stats.totalCheckInsToday, color: "#fb923c" },
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
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 4px 16px #4f46e533" }}>
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
                <input required placeholder="Acme Corp" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company Slug</label>
                <input required placeholder="acme-corp" value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" />
                <p className="text-xs text-zinc-600">Used as company code for login</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Admin Name</label>
                <input required placeholder="John Doe" value={form.adminName}
                  onChange={e => setForm(p => ({ ...p, adminName: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Admin Email</label>
                <input required type="email" placeholder="admin@acme.com" value={form.adminEmail}
                  onChange={e => setForm(p => ({ ...p, adminEmail: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Admin Password</label>
                <input required type="password" placeholder="Temporary password" value={form.adminPassword}
                  onChange={e => setForm(p => ({ ...p, adminPassword: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                  {saving ? "Creating…" : "Create Company"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 border border-zinc-700">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tenants list */}
        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-zinc-800 rounded-2xl" />)}
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
            No companies yet. Create your first one.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tenants.map(tenant => (
              <div key={tenant.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-4"
                style={{ opacity: tenant.isActive ? 1 : 0.6 }}>

                {/* Status indicator */}
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: tenant.isActive ? "#4ade80" : "#f87171", boxShadow: tenant.isActive ? "0 0 8px #4ade8077" : "none" }} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{tenant.name}</span>
                    <span className="text-xs text-zinc-600 font-mono">{tenant.slug}</span>
                    {!tenant.isActive && (
                      <span className="text-xs bg-red-950 text-red-400 border border-red-900 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                    <span>👥 {tenant._count.users} staff</span>
                    <span>🏢 {tenant._count.offices} offices</span>
                    <span>📋 {tenant._count.attendance} records</span>
                    <span>Created {new Date(tenant.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(tenant.id)}
                    disabled={toggling === tenant.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                    style={{
                      background: tenant.isActive ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
                      color: tenant.isActive ? "#f87171" : "#4ade80",
                      border: `1px solid ${tenant.isActive ? "#f8717133" : "#4ade8033"}`,
                    }}>
                    {toggling === tenant.id ? "…" : tenant.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(tenant.id, tenant.name)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-red-400 border border-transparent hover:border-red-900/50 transition-all">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}