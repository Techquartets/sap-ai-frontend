/**
 * MyConnections.jsx — "My Connections" page.
 * Route: /servers
 *
 * FIXES:
 * 1. Stats cards clickable — filter view on click
 * 2. DEPLOY TARGETS = 3 built-ins + custom count (always accurate)
 * 3. Built-in servers (DEV/QAS/PROD) shown as read-only cards
 * 4. Custom servers show IP + hostname on card
 * 5. Built-in servers NOT deletable
 * 6. All edge cases handled
 */

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Sidebar from "../components/layout/Sidebar";
import Topbar  from "../components/layout/Topbar";
import {
  openAddModal, openEditModal, closeModal,
  setDeleteTarget, clearDelete,
  setFormError,
  addServer, updateServer, deleteServer,
} from "../features/servers/serversSlice";
import {
  Plus, PencilSimple, Trash, X, Warning,
  CheckCircle, HardDrive, WifiHigh, WifiSlash,
  Globe, Lock, SlidersHorizontal,
} from "@phosphor-icons/react";
import {
  RISK_LEVELS,
  MAX_RISK_VALUE,
  loadRiskConfigs,
  saveRiskConfigs,
} from "../features/cases/riskConfig";

// ─── Built-in servers (always present, not deletable) ────────────────────────
const BUILTIN_SERVERS = [
  {
    id:          "__DEV__",
    name:        "Development (DEV)",
    ip:          "10.0.0.1",
    hostname:    "sap-dev.internal",
    description: "Deploy to development environment for initial testing and validation",
    createdAt:   "System",
    isBuiltin:   true,
    badge:       "Safe",
    badgeColor:  "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
  },
  {
    id:          "__QAS__",
    name:        "QA / Testing (QAS)",
    ip:          "10.0.0.2",
    hostname:    "sap-qa.internal",
    description: "Deploy to QA environment for thorough testing before production",
    createdAt:   "System",
    isBuiltin:   true,
    badge:       "Staging",
    badgeColor:  "text-blue-400 bg-blue-500/20 border-blue-500/30",
  },
  {
    id:          "__PROD__",
    name:        "Production (PRD)",
    ip:          "10.0.0.3",
    hostname:    "sap-prod.internal",
    description: "Deploy active rule to production environment for archival",
    createdAt:   "System",
    isBuiltin:   true,
    badge:       "Live",
    badgeColor:  "text-red-400 bg-red-500/20 border-red-500/30",
  },
];

// ─── Form Modal (Add / Edit) ──────────────────────────────────────────────────
function ServerFormModal() {
  const dispatch = useDispatch();
  const { modalOpen, editTarget, formError } = useSelector(s => s.servers);

  const isEdit = !!editTarget;

  const [form, setForm] = useState({
    name:        editTarget?.name        || "",
    ip:          editTarget?.ip          || "",
    hostname:    editTarget?.hostname    || "",
    description: editTarget?.description || "",
  });
  const [errors, setErrors] = useState({});

  if (!modalOpen) return null;

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setErrors(p => ({ ...p, [key]: "" }));
    dispatch(setFormError(null));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name     = "Server name is required";
    if (!form.ip.trim())       e.ip       = "IP address is required";
    else if (!/^[\d.:\[\]a-fA-F]+$/.test(form.ip.trim())) e.ip = "Enter a valid IP address";
    if (!form.hostname.trim()) e.hostname = "Host name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (isEdit) dispatch(updateServer({ id: editTarget.id, ...form }));
    else        dispatch(addServer(form));
  };

  const inputCls = (key) =>
    `w-full px-3.5 py-2.5 rounded-lg bg-[#0d1117] border ${
      errors[key] ? "border-red-500" : "border-[var(--border)]"
    } text-sm text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition-colors`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) dispatch(closeModal()); }}
    >
      <div className="relative w-full max-w-md bg-[#111827] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              {isEdit ? "Edit Server Connection" : "Add Server Connection"}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {isEdit ? "Update the server details below." : "Enter your SAP server details to add a new connection."}
            </p>
          </div>
          <button onClick={() => dispatch(closeModal())} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5 transition-colors mt-0.5">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[var(--text)] mb-1.5">Server Name <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Production SAP ERP" className={inputCls("name")} />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[var(--text)] mb-1.5">Server IP <span className="text-red-400">*</span></label>
            <input type="text" value={form.ip} onChange={e => set("ip", e.target.value)} placeholder="e.g. 192.168.1.100" className={inputCls("ip")} />
            {errors.ip && <p className="text-xs text-red-400 mt-1">{errors.ip}</p>}
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[var(--text)] mb-1.5">Host Name <span className="text-red-400">*</span></label>
            <input type="text" value={form.hostname} onChange={e => set("hostname", e.target.value)} placeholder="e.g. sap-prod.corp.local" className={inputCls("hostname")} />
            {errors.hostname && <p className="text-xs text-red-400 mt-1">{errors.hostname}</p>}
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[var(--text)] mb-1.5">
              Description <span className="text-[var(--muted)] font-normal">(optional)</span>
            </label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="e.g. Main production server for FI and CO modules" rows={2} className={`${inputCls("description")} resize-none`} />
          </div>
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <Warning size={13} weight="fill" />{formError}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <button onClick={handleSubmit} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white text-sm font-semibold transition-opacity">
            <CheckCircle size={15} weight="bold" />
            {isEdit ? "Save Changes" : "Add Server"}
          </button>
          <button onClick={() => dispatch(closeModal())} className="px-4 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 hover:text-[var(--text)] transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal() {
  const dispatch     = useDispatch();
  const { deleteTarget } = useSelector(s => s.servers);
  if (!deleteTarget) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) dispatch(clearDelete()); }}
    >
      <div className="w-full max-w-sm bg-[#111827] border border-white/10 rounded-2xl shadow-2xl px-6 py-7 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
          <Trash size={24} weight="fill" className="text-red-400" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[var(--text)]">Remove Server</p>
          <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
            Remove <span className="text-[var(--text)] font-medium">{deleteTarget.name}</span> from your connections?
            <br />It will no longer appear as a deploy target.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => dispatch(deleteServer(deleteTarget.id))} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors">
            Remove
          </button>
          <button onClick={() => dispatch(clearDelete())} className="flex-1 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function RiskConfigModal({ open, onClose }) {
  const [level, setLevel] = useState("LOW");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saved, setSaved] = useState(() => loadRiskConfigs());

  if (!open) return null;

  const submit = () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Value is required");
      return;
    }
    if (parsed > MAX_RISK_VALUE) {
      setError("Max value is 1 crore (10000000)");
      return;
    }
    const deduped = saved.filter((x) => x.level !== level);
    const next = saveRiskConfigs([...deduped, { level, maxValue: parsed }]);
    setSaved(next);
    setError("");
    setSuccess(`Saved ${level} with max ${parsed.toLocaleString("en-US")}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#111827] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Config Risk Level</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">Set case amount thresholds (max 1 crore)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5 transition-colors mt-0.5">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[var(--text)] mb-1.5">Risk Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0d1117] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
            >
              {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[var(--text)] mb-1.5">Max Amount</label>
            <input
              type="number"
              min="1"
              max={MAX_RISK_VALUE}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSuccess("");
                setError("");
              }}
              placeholder="e.g. 2500000"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0d1117] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
            />
            <p className="text-[11px] text-[var(--muted)] mt-1">Max allowed: 10000000</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <Warning size={13} weight="fill" />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
              <CheckCircle size={13} weight="fill" />{success}
            </div>
          )}
          {saved.length > 0 && (
            <div className="rounded-lg border border-white/10 p-3 space-y-1.5">
              {saved.map((x) => (
                <p key={x.level} className="text-[12px] text-[var(--muted)]">
                  {x.level}: <span className="text-[var(--text)] font-semibold">{x.maxValue.toLocaleString("en-US")}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex gap-2">
          <button onClick={submit} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white text-sm font-semibold transition-opacity">
            <CheckCircle size={15} weight="bold" />
            Save Config
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Server Card ──────────────────────────────────────────────────────────────
function ServerCard({ server }) {
  const dispatch = useDispatch();

  return (
    <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            server.isBuiltin
              ? "bg-slate-500/15 border border-slate-500/25"
              : "bg-violet-500/15 border border-violet-500/25"
          }`}>
            <HardDrive size={18} weight="fill" className={server.isBuiltin ? "text-slate-400" : "text-violet-400"} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[var(--text)]">{server.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">
                {server.isBuiltin ? "Built-in" : "Connected"}
              </span>
            </div>
          </div>
        </div>

        {/* Actions — only custom servers can be edited/deleted */}
        {!server.isBuiltin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => dispatch(openEditModal(server))}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
              title="Edit"
            >
              <PencilSimple size={15} />
            </button>
            <button
              onClick={() => dispatch(setDeleteTarget(server))}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remove"
            >
              <Trash size={15} />
            </button>
          </div>
        )}

        {/* Lock icon for built-ins */}
        {server.isBuiltin && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-1.5 rounded-lg text-[var(--muted)]" title="System server — cannot be removed">
              <Lock size={14} />
            </div>
          </div>
        )}
      </div>

      {/* IP + Hostname */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe size={12} className="text-[var(--muted)] flex-shrink-0" />
          <span className="text-[11px] text-[var(--muted)]">IP:</span>
          <span className="text-[11px] font-mono text-[var(--text)]">{server.ip}</span>
        </div>
        <div className="flex items-center gap-2">
          <WifiHigh size={12} className="text-[var(--muted)] flex-shrink-0" />
          <span className="text-[11px] text-[var(--muted)]">Host:</span>
          <span className="text-[11px] font-mono text-[var(--text)] truncate">{server.hostname}</span>
        </div>
        {server.description && (
          <p className="text-[11px] text-[var(--muted)] pt-1 border-t border-white/5 line-clamp-2">{server.description}</p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-[var(--muted)]">
          {server.isBuiltin ? "System default" : `Added ${server.createdAt}`}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
          server.isBuiltin
            ? server.badgeColor || "text-slate-400 bg-slate-500/20 border-slate-500/30"
            : "text-violet-400 bg-violet-500/20 border-violet-500/30"
        }`}>
          {server.isBuiltin ? (server.badge || "Built-in") : "Custom"}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyConnections() {
  const dispatch     = useDispatch();
  const customList   = useSelector(s => s.servers.list);
  const [riskModalOpen, setRiskModalOpen] = useState(false);

  // All servers = built-ins + custom
  const allServers   = [...BUILTIN_SERVERS, ...customList];
  const customCount  = customList.length;
  const totalCount   = allServers.length;
  const deployCount  = totalCount; // all servers are deploy targets

  // Filter state for stat cards
  const [filter, setFilter] = useState("ALL"); // "ALL" | "BUILTIN" | "CUSTOM"

  const displayed = filter === "BUILTIN"
    ? BUILTIN_SERVERS
    : filter === "CUSTOM"
      ? customList
      : allServers;

  const toggleFilter = (f) => setFilter(prev => prev === f ? "ALL" : f);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <div className="max-w-[1100px] mx-auto px-6 py-6 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-[18px] font-semibold text-[var(--text)]">Configurations</h1>
                <p className="text-[12px] text-[var(--muted)] mt-0.5">
                  Manage your SAP server connections. All servers appear as deploy targets in Rule Library.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRiskModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-sm font-semibold hover:bg-white/5 transition-colors"
                >
                  <SlidersHorizontal size={16} weight="bold" />
                  Config Risk Level
                </button>
                <button
                  onClick={() => dispatch(openAddModal())}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] hover:opacity-90 text-white text-sm font-semibold transition-opacity shadow-sm"
                >
                  <Plus size={16} weight="bold" />
                  Add Server
                </button>
              </div>
            </div>

            {/* Stats cards — clickable to filter */}
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => toggleFilter("ALL")}
                className={`text-left p-5 rounded-xl border transition-all ${
                  filter === "ALL"
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-lg shadow-[var(--primary)]/10"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50"
                }`}
              >
                <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">TOTAL SERVERS</p>
                <p className="text-[2rem] font-bold mt-2 leading-none text-[var(--text)]">{totalCount}</p>
                <p className="text-[11px] text-[var(--muted)] mt-1">{BUILTIN_SERVERS.length} built-in · {customCount} custom</p>
              </button>

              <button
                onClick={() => toggleFilter("CUSTOM")}
                className={`text-left p-5 rounded-xl border transition-all ${
                  filter === "CUSTOM"
                    ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-emerald-500/50"
                }`}
              >
                <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">CUSTOM SERVERS</p>
                <p className="text-[2rem] font-bold mt-2 leading-none text-emerald-400">{customCount}</p>
                <p className="text-[11px] text-[var(--muted)] mt-1">Added by you</p>
              </button>

              <button
                onClick={() => toggleFilter("BUILTIN")}
                className={`text-left p-5 rounded-xl border transition-all ${
                  filter === "BUILTIN"
                    ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-violet-500/50"
                }`}
              >
                <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">DEPLOY TARGETS</p>
                <p className="text-[2rem] font-bold mt-2 leading-none text-violet-400">{deployCount}</p>
                <p className="text-[11px] text-[var(--muted)] mt-1">{BUILTIN_SERVERS.length} default · {customCount} custom</p>
              </button>
            </div>

            {/* Active filter label */}
            {filter !== "ALL" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">
                  Showing {filter === "BUILTIN" ? "built-in" : "custom"} servers
                </span>
                <button onClick={() => setFilter("ALL")} className="text-xs text-[var(--primary)] hover:underline">
                  Clear filter
                </button>
              </div>
            )}

            {/* Server grid */}
            {displayed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-16 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <WifiSlash size={24} weight="fill" className="text-violet-400" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--text)]">No custom servers yet</p>
                  <p className="text-xs text-[var(--muted)] mt-1.5 max-w-[320px] leading-relaxed">
                    Add your own SAP server connections. They will appear alongside the 3 default environments when deploying rules.
                  </p>
                </div>
                <button
                  onClick={() => dispatch(openAddModal())}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] hover:opacity-90 text-white text-sm font-semibold transition-opacity"
                >
                  <Plus size={14} weight="bold" />
                  Add First Server
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {displayed.map(server => <ServerCard key={server.id} server={server} />)}
              </div>
            )}

            {/* Info banner */}
            {customCount > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <CheckCircle size={15} weight="fill" className="text-violet-400 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-violet-300 leading-relaxed">
                  Your {customCount} custom server{customCount > 1 ? "s are" : " is"} available as deploy targets alongside DEV, QAS, and PROD in the Rule Library.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>

      <ServerFormModal />
      <DeleteConfirmModal />
      <RiskConfigModal open={riskModalOpen} onClose={() => setRiskModalOpen(false)} />
    </div>
  );
}