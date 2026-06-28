// client/src/components/admin/AdminOffices.jsx
// Receives offices + refreshOffices from AdminPage (no internal fetch needed)

import { useState } from "react";
import { createOffice, updateOffice, deleteOffice } from "../../api/auth";

export default function AdminOffices({ offices = [], refreshOffices }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [error, setError]       = useState("");
  const [saving, setSaving]     = useState(false);

  const emptyForm = { name: "", lat: "", lng: "", radiusMetres: 150 };
  const [form, setForm] = useState(emptyForm);

  function startEdit(office) {
    setEditing(office.id);
    setForm({ name: office.name, lat: office.lat, lng: office.lng, radiusMetres: office.radiusMetres });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        radiusMetres: parseInt(form.radiusMetres),
      };
      if (editing) {
        await updateOffice(editing, payload);
      } else {
        await createOffice(payload);
      }
      cancelForm();
      refreshOffices();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(officeId) {
    if (!confirm("Delete this office? Staff assigned to it will lose their office.")) return;
    try {
      await deleteOffice(officeId);
      refreshOffices();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight">Offices</h1>
          <p className="text-zinc-500 text-sm mt-1">{offices.length} location{offices.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", boxShadow: "0 4px 16px #4f46e533" }}
        >
          + Add Office
        </button>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="font-bold text-sm mb-4">{editing ? "Edit Office" : "New Office"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Office Name</label>
              <input type="text" required placeholder="e.g. Head Office"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="input-field" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Latitude</label>
              <input type="number" required step="any" placeholder="e.g. 6.796750"
                value={form.lat} onChange={e => setForm(p => ({ ...p, lat: e.target.value }))}
                className="input-field" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Longitude</label>
              <input type="number" required step="any" placeholder="e.g. -1.579770"
                value={form.lng} onChange={e => setForm(p => ({ ...p, lng: e.target.value }))}
                className="input-field" />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Allowed Radius — {form.radiusMetres}m
              </label>
              <input type="range" min="50" max="500" step="10"
                value={form.radiusMetres} onChange={e => setForm(p => ({ ...p, radiusMetres: e.target.value }))}
                className="w-full accent-indigo-500" />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>50m (tight)</span><span>500m (large campus)</span>
              </div>
            </div>
            <div className="sm:col-span-2 bg-indigo-950/30 border border-indigo-900/30 rounded-xl px-4 py-3 text-xs text-indigo-400">
              💡 To get coordinates: open Google Maps → right-click your office building → click the coordinates at the top of the menu.
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" disabled={saving}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                {saving ? "Saving…" : editing ? "Update Office" : "Create Office"}
              </button>
              <button type="button" onClick={cancelForm}
                className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 border border-zinc-700">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {offices.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
          No offices yet. Add your first one.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {offices.map(o => (
            <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-sm">{o.name}</div>
                  <div className="text-xs text-zinc-500 font-mono mt-1">
                    {o.lat.toFixed(6)}, {o.lng.toFixed(6)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {o.radiusMetres}m radius · {o._count?.users ?? 0} staff assigned
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(o)}
                    className="text-xs text-zinc-400 hover:text-white border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(o.id)}
                    className="text-xs text-zinc-600 hover:text-red-400 border border-transparent hover:border-red-900/50 px-3 py-1.5 rounded-lg transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .input-field { width:100%; background:#27272a; border:1px solid #3f3f46; border-radius:10px; padding:10px 14px; color:white; font-size:13px; outline:none; transition:border-color 0.15s; }
        .input-field:focus { border-color:#6366f1; }
      `}</style>
    </div>
  );
}