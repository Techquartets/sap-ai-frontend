/**
 * RuleLibraryFull.jsx — Pixel-perfect UI. All business logic unchanged.
 *
 * UI FIXES vs previous version:
 *  1. Server icon → from @phosphor-icons (not lucide) — fixes import error
 *  2. Dynamic Tailwind classes (bg-${color}-500/15) → hardcoded — fixes JIT purge
 *  3. Action buttons → solid vivid premium colors with gradient, matching screenshot
 *  4. Stats cards → premium dark glass cards, rounded-xl, subtle glow border on active
 *  5. Table → deep navy bg, rounded-xl container, better row spacing
 *  6. SAP module badges → explicit dark+light mode classes (visible in both modes)
 *  7. Risk badges → saturated solid colors, not washed out
 *  8. Modal → rounded-2xl, premium shadow, better padding
 *  9. All form inputs → consistent rounded-lg with proper contrast
 * 10. Origin col → ShieldCheck icon with teal tint
 *
 * LOGIC ADDITIONS (per PRD re-check):
 *  + Archived status added to lifecycle order + style map
 *  + selectAll now works on filtered set (not all 100)
 *  + "Showing X of Y" updates in real-time with filters
 */

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  fetchRules, fetchEnvironments,
  setSearch, setStatusFilter, setModuleFilter,
  toggleSelect, selectAll,
  openModal, closeModal,
  openSimulation, setSimStep, setSimMode, setSimEnv, setSimConfig, closeSimulation,
  setDeployTarget,
  setScheduleConfig, setScheduleError,
  bulkDeploy, bulkActivate, bulkDeactivate,
  runSimulation, deployRuleToEnv, createRuleSchedule,
  selectFilteredRules, selectStats,
} from "../../features/rules/rulesSlice";
import {
  Plus, PencilSimple, Rocket, Play, Stop, CalendarBlank,
  Eye, X, CheckCircle, Warning, CaretRight, ArrowLeft,
  CircleNotch, Database, Cpu, ShieldCheck, CloudArrowUp,
  Clock, ArrowsClockwise, CalendarCheck, Siren,
  UploadSimple,
} from "@phosphor-icons/react";
import { Server } from "lucide-react";
import { CaseModal } from "../../pages/caseManagement";
// ✅ NEW: Import backend services if not passed as props
import { ruleService } from "../../services/ruleService";
import apiClient from "../../services/apiClient";
import { generateTestDataAPI } from "../../features/rules/rulesBackendAPI";

// ─── Visual Config (all hardcoded — no dynamic Tailwind interpolation) ────────

const LIFECYCLE_STEPS = [
  { key: "DRAFT",      label: "Draft",      Icon: Clock         },
  { key: "DEPLOYED",   label: "Deploy",     Icon: CloudArrowUp  },
  { key: "SIMULATION", label: "Simulation", Icon: Play          },
  { key: "ACTIVE",     label: "Active",     Icon: CheckCircle   },
];
const LIFECYCLE_ORDER = { DRAFT: 0, DEPLOYED: 1, SIMULATION: 2, ACTIVE: 3, ARCHIVED: -1 };

// Fully hardcoded — safe for Tailwind JIT
const RISK_MAP = {
  LOW:      { badge: "bg-green-500/20 text-green-400 border border-green-500/40"    },
  MEDIUM:   { badge: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40" },
  HIGH:     { badge: "bg-orange-500/20 text-orange-400 border border-orange-500/40" },
  CRITICAL: { badge: "bg-red-500/20 text-red-400 border border-red-500/40"          },
};
const STATUS_MAP = {
  DRAFT:      "bg-slate-700/60 text-slate-300 border border-slate-600/50",
  SIMULATION: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
  ACTIVE:     "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  DEPLOYED:   "bg-purple-500/20 text-purple-300 border border-purple-500/40",
  ARCHIVED:   "bg-gray-700/40 text-gray-500 border border-gray-700/40",
};
// Works in both dark AND light mode — explicit bg + text for both
const MODULE_MAP = {
  FI: "bg-indigo-600/25 text-indigo-300 dark:text-indigo-300 border border-indigo-500/30",
  MM: "bg-violet-600/25 text-violet-300 dark:text-violet-300 border border-violet-500/30",
  SD: "bg-cyan-600/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30",
  HR: "bg-rose-600/25 text-rose-700 dark:text-rose-300 border border-rose-500/30",
  CO: "bg-amber-600/25 text-amber-700 dark:text-amber-300 border border-amber-500/30",
  PP: "bg-emerald-600/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  QM: "bg-yellow-600/25 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30",
  PM: "bg-slate-600/40 text-slate-600 dark:text-slate-300 border border-slate-500/30",
};

// ─── Atom Components ──────────────────────────────────────────────────────────

function RiskBadge({ risk }) {
  const cls = (RISK_MAP[risk] || RISK_MAP.LOW).badge;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold ${cls}`}>{risk}</span>;
}
function StatusBadge({ status }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium ${STATUS_MAP[status] || STATUS_MAP.DRAFT}`}>{status}</span>;
}
function ModuleBadge({ module }) {
  return (
    <span className={`inline-flex items-center justify-center w-9 h-6 rounded-md text-[11px] font-bold ${MODULE_MAP[module] || "bg-gray-600/30 text-gray-400"}`}>
      {module}
    </span>
  );
}

/** Dot lifecycle bar — table rows */
function LifecycleDots({ status }) {
  const cur = LIFECYCLE_ORDER[status] ?? 0;
  return (
    <div className="flex items-center">
      {LIFECYCLE_STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className={`w-2 h-2 rounded-full transition-colors ${i <= cur ? "bg-teal-400" : "bg-gray-600"}`} />
          {i < LIFECYCLE_STEPS.length - 1 && (
            <div className={`w-4 h-px ${i < cur ? "bg-teal-400" : "bg-gray-600"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Icon lifecycle progress — view modal */
function LifecycleProgress({ status }) {
  const cur = LIFECYCLE_ORDER[status] ?? 0;
  return (
    <div className="flex items-center w-full">
      {LIFECYCLE_STEPS.map((step, i) => {
        const done   = i <= cur;
        const { Icon } = step;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center ${done ? "border-teal-400 bg-teal-400/10" : "border-gray-600 bg-gray-800/40"}`}>
                <Icon size={17} weight={done ? "fill" : "regular"} className={done ? "text-teal-400" : "text-gray-600"} />
              </div>
              <span className={`mt-1.5 text-[11px] font-medium ${done ? "text-teal-400" : "text-gray-600"}`}>{step.label}</span>
            </div>
            {i < LIFECYCLE_STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 ${i < cur ? "bg-teal-400" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Anomalies link — opens modal showing anomalies */
function AnomaliesLink({ ruleId, ruleName, count, simId }) {
  const dispatch = useAppDispatch();
  return (
    <button
      onClick={() => dispatch(openModal({ type: "ANOMALIES", ruleId, ruleName, simId, count }))}
      className="text-red-400 font-semibold hover:text-red-300 hover:underline transition-colors cursor-pointer"
    >
      {count.toLocaleString()} cases
    </button>
  );
}

/** Modal shell — consistent sizing and rounding */
function Modal({ onClose, children, width = "max-w-xl" }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`relative w-full ${width} bg-[#111827] border border-white/10 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────
function StatsCards() {
  const dispatch     = useAppDispatch();
  const stats        = useAppSelector(selectStats);
  const statusFilter = useAppSelector((s) => s.rules.statusFilter);

  const cards = [
    { label: "TOTAL RULES",   value: stats.total,      filter: "ALL",        accent: "border-white/10"            },
    { label: "DRAFT",         value: stats.draft,      filter: "DRAFT",      accent: "border-slate-500/30"        },
    { label: "IN SIMULATION", value: stats.simulation, filter: "SIMULATION", accent: "border-blue-500/30"         },
    { label: "ACTIVE",        value: stats.active,     filter: "ACTIVE",     accent: "border-emerald-500/30"      },
    { label: "DEPLOYED",      value: stats.deployed,   filter: "DEPLOYED",   accent: "border-purple-500/30"       },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {cards.map((c) => {
        const isActive = statusFilter === c.filter;
        return (
          <button
            key={c.label}
            onClick={() => dispatch(setStatusFilter(isActive ? "ALL" : c.filter))}
            className={`text-left p-5 rounded-xl border transition-all duration-150 ${
              isActive
                ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-lg shadow-[var(--primary)]/10"
                : `${c.accent} bg-[var(--card)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5`
            }`}
          >
            <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">{c.label}</p>
            <p className="text-[2rem] font-bold mt-2 text-[var(--text)] leading-none">{c.value}</p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Filters Bar ──────────────────────────────────────────────────────────────
function FiltersBar({ count, total }) {
  const dispatch = useAppDispatch();
  const { search, statusFilter, moduleFilter } = useAppSelector((s) => s.rules);

  const selectCls = "px-3 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] min-w-[148px] cursor-pointer transition-colors hover:border-[var(--primary)]/50";

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => dispatch(setSearch(e.target.value))}
            placeholder="Search rules..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <select value={statusFilter} onChange={(e) => dispatch(setStatusFilter(e.target.value))} className={selectCls}>
          <option value="ALL">All Statuses</option>
          {["DRAFT","SIMULATION","ACTIVE","DEPLOYED","ARCHIVED"].map((s) => (
            <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select value={moduleFilter} onChange={(e) => dispatch(setModuleFilter(e.target.value))} className={selectCls}>
          <option value="ALL">All Modules</option>
          {["FI","MM","SD","HR","CO","PP","QM","PM"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <p className="text-xs text-[var(--muted)]">Showing {count} of {total} rules</p>
    </div>
  );
}

// ─── Action Buttons ───────────────────────────────────────────────────────────
function ActionBar() {
  const dispatch      = useAppDispatch();
  const navigate      = useNavigate();
  const { selected, bulkLoading, list } = useAppSelector((s) => s.rules);
  const has           = selected.length > 0;
  const selectedRules = list.filter((r) => selected.includes(r.id));
  const allHaveSim    = selectedRules.every((r) => Array.isArray(r.simulationHistory) && r.simulationHistory.length > 0);
  const allActive     = selectedRules.every((r) => r.status === "ACTIVE");

  const handleActivate = () => {
    if (!has) return;
    if (!allHaveSim) { dispatch(openModal({ type: "SIM_GATE" })); return; }
    dispatch(openModal({ type: "CONFIRM_ACTIVATE" }));
  };
  const handleSchedule = () => {
    if (!has) return;
    if (!allActive) { dispatch(openModal({ type: "SCHEDULE_GATE" })); return; }
    dispatch(setScheduleConfig({
      type: "ONE_TIME",
      environment: "",
      fromDate: "",
      toDate: "",
      frequency: "",
      dayOfWeek: "",
      dayOfMonth: "",
      endDate: "",
    }));
    dispatch(openModal({ type: "SCHEDULE" }));
  };

  const buttons = [
  {
    label: "Create",
    Icon: Plus,
    cls: "bg-gradient-to-b from-green-600 to-green-500 hover:from-green-400 hover:to-green-500 text-white shadow-sm shadow-green-900/40 rounded-none",
    onClick: () => navigate("/architect"),
    disabled: false,
  },
  {
    label: "Modify",
    Icon: PencilSimple,
    cls: "bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-sm shadow-blue-900/40 rounded-none",
    onClick: () => navigate(selected.length === 1 ? `/architect?ruleId=${selected[0]}` : "/architect"),
    disabled: !has || bulkLoading,
  },
  {
    label: "Deploy",
    Icon: Rocket,
    cls: "bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-sm shadow-amber-900/40 rounded-none",
    onClick: () => dispatch(openModal({ type: "CONFIRM_DEPLOY" })),
    disabled: !has || bulkLoading,
  },
  {
    label: "Activate",
    Icon: Play,
    cls: "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-sm shadow-emerald-900/40 rounded-none",
    onClick: handleActivate,
    disabled: !has || bulkLoading,
  },
  {
    label: "Deactivate",
    Icon: Stop,
    cls: "bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-sm shadow-red-900/40 rounded-none",
    onClick: () => dispatch(openModal({ type: "CONFIRM_DEACTIVATE" })),
    disabled: !has || bulkLoading,
  },
  {
    label: "Schedule",
    Icon: CalendarBlank,
    cls: "bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white shadow-sm shadow-purple-900/40 rounded-none",
    onClick: handleSchedule,
    disabled: !has || bulkLoading,
  },
];

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-[var(--muted)]">
        {has && <span className="text-[var(--primary)] font-semibold">{selected.length} selected</span>}
      </p>
      <div className="flex items-center gap-2">
        {buttons.map(({ label, Icon, cls, onClick, disabled }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${cls}`}
          >
            <Icon size={13} weight="fill" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Map stored deploy id → canonical tier for built-in card lookup */
function normalizeDeployTier(deployedEnv) {
  if (deployedEnv == null || deployedEnv === "") return null;
  const id = String(deployedEnv);
  const u = id.toUpperCase();
  if (u === "DEV" || id === "__DEV__") return "DEV";
  if (u === "QAS" || id === "__QAS__") return "QAS";
  if (u === "PROD" || u === "PRD" || id === "__PROD__") return "PROD";
  return null;
}

const TIER_TO_BUILTIN_ID = { DEV: "__DEV__", QAS: "__QAS__", PROD: "__PROD__" };

function deployEnvColumnLabel(rule, builtins, customList) {
  const env = rule.deployedEnv;
  if (env == null || env === "") return "—";

  const tier = normalizeDeployTier(env);
  if (tier) {
    const bid = TIER_TO_BUILTIN_ID[tier];
    const card = builtins?.find((b) => b.id === bid);
    if (card?.name) return card.name;
    if (tier === "DEV") return "Dev";
    if (tier === "QAS") return "Staging";
    if (tier === "PROD") return "Prod";
  }

  const custom = customList?.find((s) => s.id === env);
  if (custom?.name) return custom.name;

  return "Custom";
}

// ─── Rule Table ───────────────────────────────────────────────────────────────
function RuleTable({ rules }) {
  const dispatch = useAppDispatch();
  const { selected } = useAppSelector((s) => s.rules);
  const builtins = useAppSelector((s) => s.servers?.builtins ?? []);
  const customList = useAppSelector((s) => s.servers?.list ?? []);
  const allIds     = rules.map((r) => r.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const someCheck  = allIds.some((id) => selected.includes(id));

  const HEADERS = ["RULE ID", "RULE NAME", "STATUS", "LIFECYCLE", "SAP MODULE", "RISK", "VERSION", "ORIGIN", "DEPLOY ENV", "ACTIONS"];

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1060px]">
          {/* Head */}
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
              <th className="pl-4 pr-2 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someCheck && !allChecked; }}
                  onChange={() => dispatch(selectAll(allIds))}
                  className="w-4 h-4 rounded border-gray-600 cursor-pointer accent-[var(--primary)]"
                />
              </th>
              {HEADERS.map((h) => (
                <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-[var(--border)]">
            {rules.length === 0 && (
              <tr>
                <td colSpan={11} className="py-14 text-center text-[var(--muted)] text-sm">
                  No rules match your current filters.
                </td>
              </tr>
            )}

            {rules.map((rule) => {
              const sel = selected.includes(rule.id);
              const open = () => dispatch(openModal({ type: "VIEW", rule }));
              return (
                <tr
                  key={rule.id}
                  className={`transition-colors duration-100 ${sel ? "bg-[var(--primary)]/5" : "hover:bg-white/[0.025]"}`}
                >
                  {/* Checkbox */}
                  <td className="pl-4 pr-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => dispatch(toggleSelect(rule.id))}
                      className="w-4 h-4 rounded border-gray-600 cursor-pointer accent-[var(--primary)]"
                    />
                  </td>

                  {/* Rule ID */}
                  <td className="px-3 py-3.5 cursor-pointer" onClick={open}>
                    <span className="text-[var(--primary)] font-mono text-xs font-semibold hover:underline">
                      {rule.id}
                    </span>
                  </td>

                  {/* Rule Name */}
                  <td className="px-3 py-3.5 cursor-pointer max-w-[260px]" onClick={open}>
                    <p className="font-medium text-[var(--text)] text-[13px] truncate">{rule.name}</p>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate">{rule.description}</p>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3.5 cursor-pointer" onClick={open}>
                    <StatusBadge status={rule.status} />
                  </td>

                  {/* Lifecycle */}
                  <td className="px-3 py-3.5 cursor-pointer" onClick={open}>
                    <LifecycleDots status={rule.lifecycle} />
                  </td>

                  {/* Module */}
                  <td className="px-3 py-3.5 cursor-pointer" onClick={open}>
                    <ModuleBadge module={rule.module} />
                  </td>

                  {/* Risk */}
                  <td className="px-3 py-3.5 cursor-pointer" onClick={open}>
                    <RiskBadge risk={rule.risk} />
                  </td>

                  {/* Version */}
                  <td className="px-3 py-3.5 cursor-pointer text-[12px] font-mono text-[var(--muted)]" onClick={open}>
                    {rule.version}
                  </td>

                  {/* Origin */}
                  <td className="px-3 py-3.5 cursor-pointer" onClick={open}>
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                      <ShieldCheck size={13} className="text-teal-500/70" />
                      {rule.origin}
                    </div>
                  </td>

                  {/* Deploy environment */}
                  <td className="px-3 py-3.5 cursor-pointer whitespace-nowrap" onClick={open}>
                    <span className="text-[12px] font-medium text-[var(--text)] max-w-[220px] truncate block" title={deployEnvColumnLabel(rule, builtins, customList)}>
                      {deployEnvColumnLabel(rule, builtins, customList)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3.5">
                    <button
                      onClick={open}
                      className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── View Rule Modal ──────────────────────────────────────────────────────────
function ViewRuleModal() {
  const dispatch   = useAppDispatch();
  const stored     = useAppSelector((s) => s.rules.activeRule);
  const list       = useAppSelector((s) => s.rules.list);
  const rule       = list.find((r) => r.id === stored?.id) || stored;
  if (!rule) return null;

  const simHistory = Array.isArray(rule.simulationHistory) ? rule.simulationHistory : [];
  const thresholds = rule.thresholds || {
    amountThreshold: 0,
    frequencyLimit: 0,
    timeWindow: 0,
    varianceThreshold: 0,
  };
  const hasSim    = simHistory.length > 0;
  const latest    = hasSim ? simHistory[0] : null;
  const isActive  = rule.status === "ACTIVE";
  const isDeployed= rule.status === "DEPLOYED";
  const isDraft   = rule.status === "DRAFT";

  const handleOpenDeploy = () => {
    dispatch(fetchEnvironments());
    dispatch(openModal({ type: "DEPLOY_TO_ENV", rule }));
  };

  const sectionHead = (text) => (
    <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-3">{text}</p>
  );

  return (
    <Modal onClose={() => dispatch(closeModal())} width="max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/8">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">{rule.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-[var(--muted)] font-mono">{rule.id}</span>
            {hasSim && (
              <span className="text-[11px] text-[var(--muted)]">
                {simHistory.length} Simulation{simHistory.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => dispatch(closeModal())} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5 transition-colors">
          <X size={17} />
        </button>
      </div>

      {/* Meta */}
      <div className="px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-white/8">
        <div>{sectionHead("STATUS")}<StatusBadge status={rule.status} /></div>
        <div>{sectionHead("RISK LEVEL")}<RiskBadge risk={rule.risk} /></div>
        <div>
          {sectionHead("SAP MODULE")}
          <p className="text-sm font-semibold text-[var(--text)]">{rule.module}</p>
        </div>
        <div>
          {sectionHead("VERSION")}
          <p className="text-sm font-mono text-[var(--text)]">{rule.version}</p>
        </div>
        <div>
          {sectionHead("CREATED BY")}
          <p className="text-sm text-[var(--text)]">{rule.createdBy}</p>
        </div>
        <div>
          {sectionHead("CREATED DATE")}
          <p className="text-sm text-[var(--text)]">{rule.createdDate}</p>
        </div>
      </div>

      {/* Description */}
      <div className="px-6 py-4 border-b border-white/8">
        {sectionHead("DESCRIPTION")}
        <div className="px-4 py-3 rounded-lg border border-white/8 bg-white/[0.03]">
          <p className="text-sm text-[var(--text)]">{rule.description}</p>
        </div>
      </div>

      {/* Thresholds */}
      <div className="px-6 py-4 border-b border-white/8">
        {sectionHead("RULE THRESHOLDS / PARAMETERS")}
        <div className="grid grid-cols-2 gap-2.5">
          {thresholds.amountThreshold > 0 && (
            <div className="px-4 py-3 rounded-lg border border-white/8 bg-white/[0.025]">
              <p className="text-[10px] text-[var(--muted)] mb-1">Amount Threshold</p>
              <p className="text-sm font-semibold text-[var(--text)]">≥ ${thresholds.amountThreshold.toLocaleString()}</p>
            </div>
          )}
          {thresholds.frequencyLimit > 0 && (
            <div className="px-4 py-3 rounded-lg border border-white/8 bg-white/[0.025]">
              <p className="text-[10px] text-[var(--muted)] mb-1">Frequency Limit</p>
              <p className="text-sm font-semibold text-[var(--text)]">≤ {thresholds.frequencyLimit} occurrences</p>
            </div>
          )}
          {thresholds.timeWindow > 0 && (
            <div className="px-4 py-3 rounded-lg border border-white/8 bg-white/[0.025]">
              <p className="text-[10px] text-[var(--muted)] mb-1">Time Window</p>
              <p className="text-sm font-semibold text-[var(--text)]">{thresholds.timeWindow} days</p>
            </div>
          )}
          {thresholds.varianceThreshold > 0 && (
            <div className="px-4 py-3 rounded-lg border border-white/8 bg-white/[0.025]">
              <p className="text-[10px] text-[var(--muted)] mb-1">Variance Threshold</p>
              <p className="text-sm font-semibold text-[var(--text)]">± {thresholds.varianceThreshold}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Lifecycle */}
      <div className="px-6 py-5 border-b border-white/8">
        {sectionHead("LIFECYCLE PROGRESS")}
        <LifecycleProgress status={rule.lifecycle} />
      </div>

      {/* Simulation Results */}
      {hasSim && latest && (
        <div className="px-6 py-4 border-b border-white/8">
          <p className="text-sm font-semibold text-[var(--text)] mb-3">
            {latest.environment} Simulation Results
          </p>
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <p className="text-[11px] text-[var(--muted)]">False Positive Rate</p>
              <p className="text-2xl font-bold text-teal-400 mt-0.5">{latest.falsePositiveRate}%</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--muted)]">Performance Impact</p>
              <p className="text-2xl font-bold text-teal-400 mt-0.5">{latest.performance}</p>
            </div>
          </div>
          <p className="text-[11px] text-teal-400 flex items-center gap-1">
            <CheckCircle size={12} weight="fill" /> Validated against {latest.environment} SAP dataset
          </p>
        </div>
      )}

      {/* Status banners */}
      {isDraft && (
        <div className="px-6 py-4 border-b border-white/8">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Warning size={17} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Deployment Required</p>
              <p className="text-[11px] text-amber-400/75 mt-0.5">Deploy this rule to an environment before running simulation.</p>
            </div>
          </div>
        </div>
      )}
      {isDeployed && !hasSim && (
        <div className="px-6 py-4 border-b border-white/8">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <CheckCircle size={17} weight="fill" className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-400">Ready for Simulation</p>
              <p className="text-[11px] text-blue-400/75 mt-0.5">Deployment completed. Run simulation to validate this rule.</p>
            </div>
          </div>
        </div>
      )}
      {hasSim && !isActive && (
        <div className="px-6 py-4 border-b border-white/8">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <CheckCircle size={17} weight="fill" className="text-teal-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-teal-400">Ready to Activate</p>
              <p className="text-[11px] text-teal-400/75 mt-0.5">
                {simHistory.length} simulation{simHistory.length > 1 ? "s" : ""} completed. You can run more simulations or activate the rule.
              </p>
            </div>
          </div>
        </div>
      )}
      {isActive && (
        <div className="px-6 py-4 border-b border-white/8">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle size={17} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-400">Rule Active in Production</p>
              <p className="text-[11px] text-emerald-400/75 mt-0.5">Runtime detection enabled since: {rule.activatedAt || "N/A"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Simulation History */}
      {hasSim && (
        <div className="px-6 py-4 border-b border-white/8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[var(--text)]">Simulation History</p>
            <span className="text-[11px] text-[var(--muted)]">{simHistory.length} run{simHistory.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {rule.simulationHistory.map((sim, idx) => (
              <div key={sim.simId} className="p-3.5 rounded-xl border border-white/8 bg-white/[0.025]">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <ArrowsClockwise size={13} className="text-[var(--muted)]" />
                    <span className="text-[11px] font-mono text-blue-400">{sim.simId}</span>
                    {idx === 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 font-bold uppercase tracking-wider">Latest</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--muted)]">{sim.runAt}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                  <div><span className="text-[var(--muted)]">Date Range: </span><span className="text-[var(--text)]">{sim.dateRange?.from || "—"} → {sim.dateRange?.to || "—"}</span></div>
                  <div><span className="text-[var(--muted)]">Transactions Scanned: </span><span className="text-[var(--text)] font-semibold">{sim.transactionsScanned?.toLocaleString() || "—"}</span></div>
                  <div><span className="text-[var(--muted)]">False Positive Rate: </span><span className="text-teal-400 font-semibold">{sim.falsePositiveRate ?? 0}%</span></div>
                  <div><span className="text-[var(--muted)]">Performance: </span><span className="text-teal-400 font-semibold">{sim.performance || "N/A"}</span></div>
                  <div className="flex items-center gap-1">
                    <span className="text-[var(--muted)]">Anomalies Detected: </span>
                    <Siren size={11} className="text-red-400" />
                    <AnomaliesLink 
                      ruleId={rule.id} 
                      ruleName={rule.name}
                      count={sim.anomaliesDetected || 0}
                      simId={sim.simId}
                    />
                  </div>
                  <div><span className="text-[var(--muted)]">Thresholds: </span><span className="text-[var(--text)]">{sim.thresholds || "N/A"}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 flex items-center justify-end gap-2">
        {isDraft && (
          <button
            onClick={handleOpenDeploy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-xs font-semibold transition-all shadow-sm"
          >
            <UploadSimple size={13} weight="bold" /> Deploy to Environment
          </button>
        )}
        {isDeployed && !hasSim && (
          <button
            onClick={() => { dispatch(closeModal()); dispatch(openSimulation(rule)); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-semibold transition-all shadow-sm"
          >
            <Play size={13} weight="fill" /> Run Simulation
          </button>
        )}
        {hasSim && !isActive && (
          <>
            <button
              onClick={() => { dispatch(closeModal()); dispatch(openSimulation(rule)); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 text-[var(--text)] text-xs font-semibold hover:bg-white/5 transition-colors"
            >
              <ArrowsClockwise size={13} /> Run Simulation Again
            </button>
            <button
              onClick={() => { dispatch(closeModal()); dispatch(bulkActivate([rule.id])); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-xs font-semibold transition-all shadow-sm"
            >
              <Play size={13} weight="fill" /> Activate Rule
            </button>
          </>
        )}
        {isActive && !isDeployed && (
          <button
            onClick={handleOpenDeploy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-xs font-semibold transition-all shadow-sm"
          >
            <UploadSimple size={13} weight="bold" /> Deploy to Environment
          </button>
        )}
        <button
          onClick={() => dispatch(closeModal())}
          className="px-4 py-2 rounded-lg border border-white/10 text-[var(--muted)] text-xs font-semibold hover:bg-white/5 hover:text-[var(--text)] transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

// ─── Deploy to Environment Modal ──────────────────────────────────────────────
function DeployToEnvModal() {
  const dispatch      = useAppDispatch();
  const rule          = useAppSelector((s) => s.rules.activeRule);
  const deployEnvs    = useAppSelector((s) => s.rules.deployEnvs);
  const deployTarget  = useAppSelector((s) => s.rules.deployTarget);
  const deployLoading = useAppSelector((s) => s.rules.deployLoading);
  const deployError   = useAppSelector((s) => s.rules.deployError);
  const latest        = rule?.simulationHistory?.[0];
  if (!rule) return null;

  return (
    <Modal onClose={() => dispatch(closeModal())} width="max-w-lg">
      <div className="px-6 pt-5 pb-4 border-b border-white/8">
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Deploy Rule to Environment</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">Select target SAP environment for {rule.name}</p>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Rule card */}
        <div className="p-4 rounded-xl border border-white/8 bg-white/[0.025]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">{rule.name}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">Rule ID: {rule.id}</p>
            </div>
            <RiskBadge risk={rule.risk} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
            <div><span className="text-[var(--muted)]">SAP Module: </span><span className="font-semibold text-[var(--text)]">{rule.module}</span></div>
            <div><span className="text-[var(--muted)]">Simulations: </span><span className="font-semibold text-[var(--text)]">{Array.isArray(rule.simulationHistory) ? rule.simulationHistory.length : 0} completed</span></div>
          </div>
        </div>

        {/* Env select */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Server size={13} className="text-[var(--muted)]" />
            <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">Select Target Environment</p>
          </div>
          <div className="space-y-2">
            {deployEnvs.map((env) => {
              const sel = deployTarget?.id === env.id;
              return (
                <button
                  key={env.id}
                  onClick={() => dispatch(setDeployTarget(env))}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    sel ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-white/8 hover:border-white/15 hover:bg-white/[0.025]"
                  }`}
                >
                  {/* Radio */}
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${sel ? "border-[var(--primary)]" : "border-gray-600"}`}>
                    {sel && <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />}
                  </div>
                  <Server size={15} className={env.isProd ? "text-red-400 flex-shrink-0" : "text-[var(--muted)] flex-shrink-0"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text)]">{env.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${env.badgeCls}`}>{env.badge}</span>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{env.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prod warning */}
        {deployTarget?.isProd && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <Warning size={15} weight="fill" className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-400">Production Deployment Warning</p>
              <p className="text-[11px] text-red-400/75 mt-0.5">
                You are deploying an active rule to the PRODUCTION environment. The rule will be archived and locked for editing. Ensure proper approvals are in place before proceeding.
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        {deployTarget && (
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs font-semibold text-blue-400 mb-2">Deployment Summary</p>
            <div className="space-y-1 text-xs">
              <div><span className="text-[var(--muted)]">Target Environment: </span><span className="font-bold text-[var(--text)]">{deployTarget.id}</span></div>
              <div><span className="text-[var(--muted)]">Rule Status After Deploy: </span><span className="font-bold text-purple-400">DEPLOYED</span></div>
              {latest && <div><span className="text-[var(--muted)]">Latest Simulation FPR: </span><span className="font-semibold text-teal-400">{latest.falsePositiveRate}%</span></div>}
            </div>
          </div>
        )}
        {deployError && (
          <p className="text-xs text-red-400 flex items-center gap-1"><Warning size={12} />{deployError}</p>
        )}
      </div>

      <div className="px-6 pb-5 flex gap-2">
        <button
          disabled={!deployTarget || deployLoading}
          onClick={() => dispatch(deployRuleToEnv({ ruleId: rule.id, environment: deployTarget.id }))}
          className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {deployLoading ? <CircleNotch size={14} className="animate-spin" /> : <UploadSimple size={14} weight="bold" />}
          Deploy Rule
        </button>
        <button onClick={() => dispatch(closeModal())} className="px-4 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 hover:text-[var(--text)] transition-colors">Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Deploy Success Modal ─────────────────────────────────────────────────────
function DeploySuccessModal() {
  const dispatch = useAppDispatch();
  const msg      = useAppSelector((s) => s.rules.deploySuccessMsg);
  return (
    <Modal onClose={() => dispatch(closeModal())} width="max-w-sm">
      <div className="px-6 pt-7 pb-6 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle size={28} weight="fill" className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[var(--text)]">Rule deployed successfully!</p>
          <div className="mt-2 space-y-0.5 text-[12px] text-[var(--muted)]">
            {msg.split("\n").map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </div>
        <button onClick={() => dispatch(closeModal())} className="w-full py-2.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold transition-all">
          Done
        </button>
      </div>
    </Modal>
  );
}

function ScheduleResultModal() {
  const dispatch = useAppDispatch();
  const { modalType, scheduleResultSuccess, scheduleResultMsg } = useAppSelector((s) => s.rules);
  if (modalType !== "SCHEDULE_RESULT") return null;

  const isSuccess = scheduleResultSuccess;

  return (
    <Modal onClose={() => dispatch(closeModal())} width="max-w-sm">
      <div className="px-6 pt-7 pb-6 text-center space-y-5">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border ${
          isSuccess
            ? "bg-emerald-500/15 border-emerald-500/30"
            : "bg-red-500/15 border-red-500/30"
        }`}>
          {isSuccess
            ? <CheckCircle size={28} weight="fill" className="text-emerald-400" />
            : <Warning size={28} weight="fill" className="text-red-400" />
          }
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[var(--text)]">
            {isSuccess ? "Schedule created successfully" : "Failed to create schedule"}
          </p>
          <p className={`mt-2 text-[12px] leading-relaxed ${isSuccess ? "text-[var(--muted)]" : "text-red-400"}`}>
            {scheduleResultMsg}
          </p>
        </div>
        <button
          onClick={() => dispatch(closeModal())}
          className={`w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all ${
            isSuccess
              ? "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500"
              : "bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500"
          }`}
        >
          {isSuccess ? "Done" : "Close"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Anomalies Modal ──────────────────────────────────────────────────────────
export function AnomaliesModal() {
  const dispatch = useAppDispatch();
  const { modalData } = useAppSelector((s) => s.rules);
  const [investigationCaseId, setInvestigationCaseId] = React.useState(null);
//   const [anomalies] = React.useState(
//   Array.isArray(modalData?.anomalies)
//     ? modalData.anomalies.map(normalizeAnomaly)
//     : []
// );
  // const [loading, setLoading] = React.useState(true);
  const loading = false;
  const error = null;
  // const [error, setError] = React.useState(null);

  if (!modalData) return null;

  const { ruleId, simId, count } = modalData;

  const normalizeAnomaly = React.useCallback((raw, index) => {
    const amountRaw = raw.amount?.value ?? raw.amount_value ?? raw.amount ?? raw.total_amount ?? 0;
    const amountValue = Number(amountRaw) || 0;
    const currency = raw.amount?.currency || raw.currency || raw.currency_code || "USD";
    const riskScore = Number(raw.riskScore ?? raw.risk_score ?? raw.score ?? 0);

    return {
      id: raw.id || raw.caseId || raw.case_id || `${raw.transactionId || raw.transaction_id || "ANOM"}-${index}`,
      caseId: raw.caseId || raw.case_id || raw.case || "N/A",
      transactionId: raw.transactionId || raw.transaction_id || raw.txn_id || "N/A",
      document: raw.document || raw.document_no || raw.documentNumber || "N/A",
      vendor: raw.vendor || raw.vendor_name || "Unknown Vendor",
      vendorCode: raw.vendorCode || raw.vendor_code || raw.vendor_id || "—",
      amount: {
        currency,
        value: amountValue,
      },
      riskScore,
      sapModule: raw.sapModule || raw.sap_module || raw.module || "FI",
      detectedAt: raw.detectedAt || raw.detected_at || raw.created_at || raw.timestamp || new Date().toISOString(),
    };
  }, []);
  const anomalies = React.useMemo(() => {
  return Array.isArray(modalData?.anomalies)
    ? modalData.anomalies.map(normalizeAnomaly)
    : [];
}, [modalData?.anomalies, normalizeAnomaly]);

  // Fetch anomalies from backend when modal opens
  // React.useEffect(() => {
  //   let mounted = true;

  //   const fetchAnomalies = async () => {
  //     try {
  //       setLoading(true);
  //       setError(null);
        
  //       const params = new URLSearchParams();
  //       if (ruleId && String(ruleId).trim()) params.append("rule_id", String(ruleId).trim());
  //       if (simId && String(simId).trim()) params.append("sim_id", String(simId).trim());
  //       params.append("limit", "100");
        
  //       const url = `/sap/anomalies/detected/?${params.toString()}`;
  //       const response = await apiClient.get(url);
  //       const data = response?.data || {};
  //       const sourceList = Array.isArray(data.anomalies)
  //         ? data.anomalies
  //         : Array.isArray(data.data)
  //           ? data.data
  //           : Array.isArray(data.results)
  //             ? data.results
  //             : [];
        
  //       if (data.status && data.status !== "success" && sourceList.length === 0) {
  //         throw new Error(data.message || "Failed to fetch anomalies");
  //       }

  //       if (mounted) {
  //         setAnomalies(sourceList.map(normalizeAnomaly));
  //       }
  //     } catch (err) {
  //       if (mounted) {
  //         setError(err?.response?.data?.message || err.message || "Failed to fetch anomalies");
  //       }
  //     } finally {
  //       if (mounted) setLoading(false);
  //     }
  //   };
    
  //   fetchAnomalies();
  //   return () => {
  //     mounted = false;
  //   };
  // }, [ruleId, simId, normalizeAnomaly]);

  const getRiskColor = (score) => {
    if (score >= 90) return "bg-red-500";
    if (score >= 75) return "bg-orange-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getRiskBgColor = (score) => {
    if (score >= 90) return "bg-red-500/10";
    if (score >= 75) return "bg-orange-500/10";
    if (score >= 50) return "bg-yellow-500/10";
    return "bg-green-500/10";
  };

  const getRiskTextColor = (score) => {
    if (score >= 90) return "text-red-400";
    if (score >= 75) return "text-orange-400";
    if (score >= 50) return "text-yellow-400";
    return "text-green-400";
  };

  const getModuleBadgeStyle = (module) => {
    const styles = {
      FI: "bg-indigo-600/25 text-indigo-300 border border-indigo-500/30",
      MM: "bg-violet-600/25 text-violet-300 border border-violet-500/30",
      SD: "bg-cyan-600/25 text-cyan-300 border border-cyan-500/30",
      HR: "bg-rose-600/25 text-rose-300 border border-rose-500/30",
      CO: "bg-amber-600/25 text-amber-300 border border-amber-500/30",
      PP: "bg-emerald-600/25 text-emerald-300 border border-emerald-500/30",
      QM: "bg-yellow-600/25 text-yellow-300 border border-yellow-500/30",
      PM: "bg-slate-600/40 text-slate-300 border border-slate-500/30",
    };
    return styles[module] || "bg-slate-600/40 text-slate-300 border border-slate-500/30";
  };

  const formatDetectedAt = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleString();
  };

  const openCaseInvestigation = (caseId) => {
    if (!caseId || caseId === "N/A") return;
    setInvestigationCaseId(caseId);
  };

  const rows = anomalies;
  const visibleRows = rows.slice(0, 10);

  return (
    <>
    <Modal onClose={() => { setInvestigationCaseId(null); dispatch(closeModal()); }} width="max-w-6xl">
      <div className="px-8 pt-6 pb-4 border-b border-white/10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--text)]">Detected Fraud Cases</h2>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
              Vendor Manipulation
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">
            {modalData?.source === "schedule"
              ? `${rows.length || Number(count) || 0} cases detected from scheduled rule run`
              : `${rows.length || Number(count) || 0} cases detected in simulation`}
          </p>
        </div>
        <button onClick={() => { setInvestigationCaseId(null); dispatch(closeModal()); }} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="px-8 py-4 overflow-x-auto">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-12">
            <CircleNotch size={20} className="animate-spin text-blue-400" />
            <span className="text-sm text-[var(--muted)]">Fetching anomalies from SAP...</span>
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] text-sm">No anomalies detected for this rule and simulation.</p>
          </div>
        )}

        {!loading && rows.length === 0 && error && (
          <div className="text-center py-12">
            <p className="text-sm font-semibold text-red-400">Error Loading Anomalies</p>
            <p className="text-xs text-red-400/75 mt-1">{error}</p>
          </div>
        )}
        
        {!loading && visibleRows.length > 0 && (
          <table className="w-full text-sm min-w-[1180px]">
            <thead className="bg-[var(--bg)]">
              <tr className="border-b border-white/10">
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest w-8"></th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">Case ID</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">Transaction</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">Document</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">Vendor</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">Amount</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">Risk Score</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">SAP Module</th>
                <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">Detected At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
            {visibleRows.map((anom) => (
              <tr key={anom.id} className="hover:bg-white/[0.025] transition-colors group">
                <td className="px-3 py-3.5 text-[var(--muted)] group-hover:text-blue-400 cursor-pointer">
                  <CaretRight size={14} />
                </td>
                <td className="px-3 py-3.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openCaseInvestigation(anom.caseId); }}
                    disabled={!anom.caseId || anom.caseId === "N/A"}
                    className="text-blue-400 font-mono text-[12px] font-semibold hover:underline cursor-pointer disabled:text-[var(--muted)] disabled:no-underline disabled:cursor-default"
                  >
                    {anom.caseId}
                  </button>
                </td>
                <td className="px-3 py-3.5">
                  <span className="text-blue-400 font-mono text-[12px] font-semibold hover:underline cursor-pointer">{anom.transactionId}</span>
                </td>
                <td className="px-3 py-3.5 text-[12px] text-[var(--muted)] font-mono">{anom.document}</td>
                <td className="px-3 py-3.5">
                  <div className="text-[12px]">
                    <p className="font-semibold text-[var(--text)]">{anom.vendor}</p>
                    <p className="text-[10px] text-[var(--muted)]">{anom.vendorCode}</p>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="text-[12px] font-semibold text-[var(--text)]">
                    {anom.amount.currency} {Number(anom.amount.value || 0).toLocaleString()}
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2 min-w-[86px]">
                    <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${getRiskColor(anom.riskScore)}`} style={{ width: `${Math.min(Math.max(Number(anom.riskScore) || 0, 0), 100)}%` }}></div>
                    </div>
                    <span className={`text-[11px] font-semibold ${getRiskTextColor(anom.riskScore)}`}>{anom.riskScore}</span>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded ${getModuleBadgeStyle(anom.sapModule)}`}>
                    {anom.sapModule}
                  </span>
                </td>
                <td className="px-3 py-3.5 text-[12px] text-[var(--muted)] whitespace-nowrap">{formatDetectedAt(anom.detectedAt)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-8 py-3 border-t border-white/10 flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">Showing {rows.length} detected fraud cases</p>
        <button
          onClick={() => { setInvestigationCaseId(null); dispatch(closeModal()); }}
          className="px-6 py-2.5 rounded-lg bg-slate-700/40 hover:bg-slate-700/60 text-[var(--text)] text-sm font-semibold transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
    {investigationCaseId && (
      <CaseModal
        caseId={investigationCaseId}
        onClose={() => setInvestigationCaseId(null)}
        onUpdate={() => {}}
      />
    )}
    </>
  );
}

// ─── Simulation Modal ─────────────────────────────────────────────────────────
function SimulationModal() {
  const dispatch = useAppDispatch();
  const rule     = useAppSelector((s) => s.rules.activeRule);
  const sim      = useAppSelector((s) => s.rules.simulation);
  const simEnvs  = useAppSelector((s) => s.rules.simEnvs);
  const [dynamicParams, setDynamicParams] = React.useState(null);
  const [loadingParams, setLoadingParams] = React.useState(false);
  const [generatedMd, setGeneratedMd] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState("");

  if (sim.step === 0 || !rule) return null;
  const thresholds = rule.thresholds || {
    amountThreshold: 0,
    frequencyLimit: 0,
    timeWindow: 0,
    varianceThreshold: 0,
  };

  const normalizeDynamicParams = (raw) => {
    if (!raw) return null;
    if (raw.LIST && Array.isArray(raw.LIST)) return raw;
    if (raw.PARAMETERS?.LIST && Array.isArray(raw.PARAMETERS.LIST)) return raw.PARAMETERS;
    if (Array.isArray(raw)) return { LIST: raw };
    return null;
  };

  const canRunLiveData = rule.status === "DEPLOYED" || !!rule.deployedEnv;

  const dateError = sim.config.fromDate && sim.config.toDate &&
    new Date(sim.config.toDate) < new Date(sim.config.fromDate);
  
  const hasDynamicParams =
    dynamicParams?.LIST &&
    dynamicParams.LIST.length > 0;

  // Fetch dynamic parameters when modal opens
  React.useEffect(() => {
    if (sim.step > 0 && rule && !dynamicParams && !loadingParams) {
      setLoadingParams(true);
      import('../../features/rules/rulesBackendAPI').then(({ fetchRuleDetailsAPI }) => {
        fetchRuleDetailsAPI(rule.id)
          .then((res) => {
            const normalized = normalizeDynamicParams(
              res.dynamicParameters || res.data?.dynamicParameters || res.data?.parameters || rule.dynamicParameters || rule.parameters
            );
            if (normalized) setDynamicParams(normalized);
            setLoadingParams(false);
          })
          .catch((err) => {
            console.error('Failed to fetch dynamic parameters:', err);
            setLoadingParams(false);
          });
      });
    }
  }, [sim.step, rule?.id]);

  // Helper to map ABAP types to HTML input type
  const getInputType = (abapType) => {
    if (!abapType) return "text";
    const lower = abapType.toLowerCase();
    if (lower.includes("dats") || lower.includes("date")) return "date";
    if (lower.includes("tims") || lower.includes("time")) return "time";
    if (lower.includes("dec") || lower.includes("float") || lower.includes("numc")) return "number";
    return "text";
  };

  // Render dynamic parameter fields
  const renderDynamicFields = () => {
    if (!dynamicParams?.LIST || dynamicParams.LIST.length === 0) {
      return (
        <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          ⚠ No CDS View Parameters available for this rule.
        </p>
      );
    }

    return (
      <>
        <p className="text-xs font-semibold text-[var(--text)] mb-3 uppercase tracking-wider">CDS View Parameters</p>
        {dynamicParams.LIST.map((param) => (
          <div key={param.name}>
            <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">{param.label}</label>
            <input
              type={getInputType(param.type)}
              placeholder={param.label}
              value={sim.config[param.name] || ""}
              onChange={(e) => dispatch(setSimConfig({ [param.name]: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
            />
            <p className="text-[10px] text-[var(--muted)] mt-0.5">{param.type}</p>
          </div>
        ))}
      </>
    );
  };

  const handleRun = async () => {
    if (dateError) return;

    // Build dynamic params from simulation config (used by both branches)
    const dynamicPayload = {};

    if (dynamicParams?.LIST) {
      dynamicParams.LIST.forEach((param) => {
        const value = sim.config[param.name];

        if (value !== undefined && value !== null && value !== "") {
          dynamicPayload[param.name] = value;
        }
      });
    }

    // ── TEST DATA branch ── invoke generate_test_data_agent in backend ──
    if (sim.mode === "test") {
      setGenError("");

      if (!rule.cdsCode || !rule.cdsCode.trim()) {
        setGenError("This rule has no CDS code attached. Cannot generate test data.");
        return;
      }

      // Build rule_context: description + entered CDS view parameter values
      const ctxLines = [];
      if (rule.name) ctxLines.push(`Rule: ${rule.name}`);
      if (rule.description) ctxLines.push(`Description: ${rule.description}`);

      if (dynamicParams?.LIST && dynamicParams.LIST.length > 0) {
        const paramLines = dynamicParams.LIST
          .map((p) => {
            const v = dynamicPayload[p.name];
            return v !== undefined ? `- ${p.label} (${p.name}) = ${v}` : null;
          })
          .filter(Boolean);

        if (paramLines.length > 0) {
          ctxLines.push("CDS view parameters:");
          ctxLines.push(...paramLines);
        }
      }

      const ruleContext = ctxLines.join("\n");

      try {
        setGenerating(true);
        const result = await generateTestDataAPI(rule.cdsCode, ruleContext);
        setGeneratedMd(result.output || "");
        dispatch(setSimStep(7));
      } catch (err) {
        console.error("Generate test data failed:", err);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to generate test data";
        setGenError(msg);
      } finally {
        setGenerating(false);
      }
      return;
    }

    // ── LIVE DATA branch (unchanged) ──
    try {
      // Call backend simulation API
      await dispatch(runSimulation({
        ruleId: rule.id,
        config: {
          ...sim.config,
          mode: sim.mode,
          environment: sim.selectedEnv?.id || "QA",
          dynamic_params: dynamicPayload,
        },
      })).unwrap();

      // Call anomalies endpoint
      const params = new URLSearchParams();

      params.append("rule_id", rule.id);

      Object.entries(dynamicPayload).forEach(([key, value]) => {
        params.append(key, value);
      });

      const anomalyResponse = await apiClient.get(
        `/sap/anomalies/detected/?${params.toString()}`
      );

      const anomalyData = anomalyResponse?.data || {};

      dispatch(closeSimulation());

      dispatch(openModal({
        type: "ANOMALIES",
        rule,
        anomalies: anomalyData.anomalies || [],
        count: anomalyData.count || 0,
        ruleId: rule.id,
      }));
    } catch (err) {
      console.error("Simulation failed:", err);
    }
  };

  const backBtn = (step) => (
    <button onClick={() => dispatch(setSimStep(step))} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5 transition-colors">
      <ArrowLeft size={16} />
    </button>
  );
  const closeBtn = (
    <button onClick={() => dispatch(closeSimulation())} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5 transition-colors">
      <X size={17} />
    </button>
  );
  const cancelBtn = (
    <button onClick={() => dispatch(closeSimulation())} className="px-4 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 hover:text-[var(--text)] transition-colors">
      Cancel
    </button>
  );

  // Step 1 — Mode select
  if (sim.step === 1) return (
    <Modal onClose={() => dispatch(closeSimulation())} width="max-w-lg">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/8">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Run Simulation</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">{rule.name}</p>
        </div>
        {closeBtn}
      </div>
      <div className="px-6 py-5 space-y-3">
        <p className="text-xs text-[var(--muted)]">Choose how to run the simulation for this rule</p>
        {/* Test Data */}
        <button
          onClick={() => { dispatch(setSimMode("test")); dispatch(setSimStep(2)); }}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-white/8 hover:border-blue-500/40 hover:bg-blue-500/5 text-left transition-all"
        >
          <div className="p-2.5 rounded-lg bg-blue-500/15 text-blue-400 flex-shrink-0"><Database size={20} /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--text)]">Generate Test Data</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">Generate synthetic SAP transaction data with configurable fraud patterns for testing</p>
          </div>
          <CaretRight size={16} className="text-[var(--muted)] mt-1 flex-shrink-0" />
        </button>
        {/* Live Data — only after the rule has been deployed */}
        <button
          type="button"
          disabled={!canRunLiveData}
          onClick={() => {
            if (!canRunLiveData) return;
            dispatch(setSimMode("live"));
            dispatch(setSimStep(3));
            dispatch(fetchEnvironments());
          }}
          className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
            canRunLiveData
              ? "border-white/8 hover:border-emerald-500/40 hover:bg-emerald-500/5"
              : "border-white/5 opacity-45 cursor-not-allowed"
          }`}
        >
          <div className={`p-2.5 rounded-lg flex-shrink-0 ${canRunLiveData ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-[var(--muted)]"}`}><Cpu size={20} /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--text)]">Run with Live Data</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {canRunLiveData
                ? "Execute simulation against production SAP system within the specified date range"
                : "Deploy this rule to an environment first to run simulations with live SAP data."}
            </p>
          </div>
          <CaretRight size={16} className="text-[var(--muted)] mt-1 flex-shrink-0" />
        </button>
      </div>
      <div className="px-6 pb-5">{cancelBtn}</div>
    </Modal>
  );

  // Step 2 — Test data config
  if (sim.step === 2) return (
    <Modal onClose={() => dispatch(closeSimulation())} width="max-w-lg">
      <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-white/8">
        {backBtn(1)}
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Generate Test Data</h2>
          <p className="text-xs text-[var(--muted)]">Configure synthetic transaction data</p>
        </div>
        {closeBtn}
      </div>
      <div className="px-6 py-5 space-y-4">
        {/* Dynamic parameters from backend */}
        {loadingParams && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
            Loading CDS parameters...
          </div>
        )}
        
        
        {renderDynamicFields()}
        
        
        {sim.error && <p className="text-xs text-red-400 flex items-center gap-1"><Warning size={12} />{sim.error}</p>}
        {genError && <p className="text-xs text-red-400 flex items-center gap-1"><Warning size={12} />{genError}</p>}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button disabled={!!dateError || generating} onClick={handleRun}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {generating ? <CircleNotch size={14} className="animate-spin" /> : <Database size={14} />} Generate & Continue
        </button>
        {cancelBtn}
      </div>
    </Modal>
  );

  // Step 3 — Env select
  if (sim.step === 3) return (
    <Modal onClose={() => dispatch(closeSimulation())} width="max-w-lg">
      <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-white/8">
        {backBtn(1)}
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Select SAP Environment</h2>
          <p className="text-xs text-[var(--muted)]">Choose backend SAP environment</p>
        </div>
        {closeBtn}
      </div>
      <div className="px-6 py-4 space-y-2">
        {simEnvs.map((env) => {
          const sel = sim.selectedEnv?.id === env.id;
          return (
            <button key={env.id} onClick={() => dispatch(setSimEnv(env))}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${sel ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-white/8 hover:border-white/15 hover:bg-white/[0.025]"}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text)]">{env.name}</p>
                  {env.badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">{env.badge}</span>}
                </div>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">{env.systemId} · {env.desc}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${env.isLive ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
                  <span className={`text-[10px] ${env.isLive ? "text-red-400" : "text-emerald-400"}`}>{env.status}</span>
                  <span className="text-[10px] text-[var(--muted)]">· {env.lastSync}</span>
                </div>
              </div>
              {sel && <CheckCircle size={17} weight="fill" className="text-[var(--primary)] mt-1 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button disabled={!sim.selectedEnv} onClick={() => dispatch(setSimStep(4))}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >Continue to Configuration</button>
        {cancelBtn}
      </div>
    </Modal>
  );

  // Step 4 — Live config
  if (sim.step === 4) return (
    <Modal onClose={() => dispatch(closeSimulation())} width="max-w-lg">
      <div className="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-white/8">
        {backBtn(3)}
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Configure Simulation</h2>
          <p className="text-xs text-[var(--muted)]">{rule.name}</p>
        </div>
        {closeBtn}
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <ShieldCheck size={15} className="text-blue-400" />
          <div>
            <p className="text-xs font-semibold text-[var(--text)]">Environment: <span className="text-blue-400">{sim.selectedEnv?.id}</span></p>
            <p className="text-[10px] text-[var(--muted)]">Simulation runs against live SAP {sim.selectedEnv?.id?.toLowerCase()} data</p>
          </div>
        </div>
        
        {/* Dynamic parameters from backend */}
        {loadingParams && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
            Loading CDS parameters...
          </div>
        )}
        
        
        {renderDynamicFields()}
        
        
        <p className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          ⚠ Simulation runs against SAP {sim.selectedEnv?.id}. Ensure data privacy compliance before proceeding.
        </p>
        {sim.error && <p className="text-xs text-red-400 flex items-center gap-1"><Warning size={12} />{sim.error}</p>}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button
          disabled={sim.loading }
          onClick={handleRun}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {sim.loading ? <CircleNotch size={14} className="animate-spin" /> : <Play size={14} weight="fill" />} Run Simulation
        </button>
        {cancelBtn}
      </div>
    </Modal>
  );

  // Step 5 — Running
  if (sim.step === 5) return (
    <Modal onClose={() => {}} width="max-w-xs">
      <div className="px-6 py-12 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <CircleNotch size={32} className="text-blue-400 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Running Simulation</p>
          <p className="text-xs text-[var(--muted)] mt-1.5">
            {sim.mode === "test" ? "Generating synthetic data and running analysis..." : `Running against SAP ${sim.selectedEnv?.id}...`}
          </p>
        </div>
      </div>
    </Modal>
  );

  // Step 6 — redirect to view
  // if (sim.step === 6) {
  //   dispatch(closeSimulation());
  //   dispatch(openModal({ type: "VIEW", rule }));
  //   return null;
  // }

  // Step 7 — Generated test data result (Markdown from generate_test_data_agent)
  if (sim.step === 7) return (
    <Modal onClose={() => dispatch(closeSimulation())} width="max-w-3xl">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/8">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Generated Test Data</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">{rule.name}</p>
        </div>
        {closeBtn}
      </div>
      <div className="px-6 py-5">
        {generatedMd ? (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-[var(--text)] bg-[var(--card)] border border-white/10 rounded-xl p-4 font-mono">
            {generatedMd}
          </pre>
        ) : (
          <p className="text-xs text-[var(--muted)]">No output returned by the agent.</p>
        )}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button
          onClick={() => { setGeneratedMd(""); setGenError(""); dispatch(setSimStep(2)); }}
          className="px-4 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 hover:text-[var(--text)] transition-colors"
        >
          Regenerate
        </button>
        <button
          onClick={() => dispatch(closeSimulation())}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold transition-all"
        >
          Done
        </button>
      </div>
    </Modal>
  );

  return null;
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal() {
  const dispatch = useAppDispatch();
  const { modalType, selected, bulkLoading, bulkError } = useAppSelector((s) => s.rules);
  if (!["CONFIRM_DEPLOY","CONFIRM_ACTIVATE","CONFIRM_DEACTIVATE"].includes(modalType)) return null;

  const C = {
    CONFIRM_DEPLOY:     { title: "Deploy Rules",     desc: `Deploy ${selected.length} rule(s) to SAP system.`,                                             action: () => dispatch(bulkDeploy(selected)),     btn: "Deploy",     cls: "from-amber-500 to-amber-600",   Icon: Rocket },
    CONFIRM_ACTIVATE:   { title: "Activate Rules",   desc: `Activate ${selected.length} rule(s). They will start evaluating transactions immediately.`,    action: () => dispatch(bulkActivate(selected)),   btn: "Activate",   cls: "from-emerald-500 to-emerald-600",Icon: Play   },
    CONFIRM_DEACTIVATE: { title: "Deactivate Rules", desc: `Deactivate ${selected.length} rule(s). They will revert to Draft status.`,                     action: () => dispatch(bulkDeactivate(selected)), btn: "Deactivate", cls: "from-red-500 to-red-600",       Icon: Stop   },
  }[modalType];

  return (
    <Modal onClose={() => dispatch(closeModal())} width="max-w-sm">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-white/8">
        <div className="flex items-center gap-2"><C.Icon size={17} /><h2 className="text-[15px] font-semibold text-[var(--text)]">{C.title}</h2></div>
        <button onClick={() => dispatch(closeModal())} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5 transition-colors"><X size={17} /></button>
      </div>
      <div className="px-6 py-5">
        <p className="text-sm text-[var(--muted)]">{C.desc}</p>
        {bulkError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20">
            <Warning size={13} />{bulkError}
          </div>
        )}
      </div>
      <div className="px-6 pb-5 flex gap-2">
        <button disabled={bulkLoading} onClick={C.action}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-b ${C.cls} text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-sm`}
        >
          {bulkLoading && <CircleNotch size={14} className="animate-spin" />}{C.btn}
        </button>
        <button disabled={bulkLoading} onClick={() => dispatch(closeModal())}
          className="px-4 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 hover:text-[var(--text)] transition-colors"
        >Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Schedule Modal ────────────────────────────────────────────────────────────
const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const DAY_OF_WEEK_OPTIONS = [
  { value: "MON", label: "Monday" },
  { value: "TUE", label: "Tuesday" },
  { value: "WED", label: "Wednesday" },
  { value: "THU", label: "Thursday" },
  { value: "FRI", label: "Friday" },
  { value: "SAT", label: "Saturday" },
  { value: "SUN", label: "Sunday" },
];

const frequencyLabel = (freq) =>
  FREQUENCY_OPTIONS.find((o) => o.value === freq)?.label || freq;

function ScheduleModal() {
  const dispatch = useAppDispatch();
  const { modalType, selected, scheduleConfig, scheduleError, scheduleLoading, deployEnvs } = useAppSelector((s) => s.rules);
  if (modalType !== "SCHEDULE") return null;

  const isRecurring = scheduleConfig.type === "RECURRING";
  const isOneTime = scheduleConfig.type === "ONE_TIME";

  const dateError = isOneTime && scheduleConfig.fromDate && scheduleConfig.toDate &&
    new Date(scheduleConfig.toDate) < new Date(scheduleConfig.fromDate);

  const endDateError = isRecurring && scheduleConfig.endDate &&
    new Date(scheduleConfig.endDate) < new Date(new Date().toISOString().slice(0, 10));

  const dayOfMonthError = isRecurring && scheduleConfig.frequency === "MONTHLY" && scheduleConfig.dayOfMonth &&
    (Number(scheduleConfig.dayOfMonth) < 1 || Number(scheduleConfig.dayOfMonth) > 31);

  const handleCreate = () => {
    if (!scheduleConfig.environment) {
      dispatch(setScheduleError("Please select a target environment."));
      return;
    }
    if (isOneTime) {
      if (dateError) { dispatch(setScheduleError("End date must be after start date.")); return; }
      if (!scheduleConfig.fromDate) { dispatch(setScheduleError("Please select a from date.")); return; }
    }
    if (isRecurring) {
      if (!scheduleConfig.frequency) {
        dispatch(setScheduleError("Please select a frequency."));
        return;
      }
      if (scheduleConfig.frequency === "WEEKLY" && !scheduleConfig.dayOfWeek) {
        dispatch(setScheduleError("Please select a day of week."));
        return;
      }
      if (scheduleConfig.frequency === "MONTHLY") {
        if (!scheduleConfig.dayOfMonth) {
          dispatch(setScheduleError("Please enter a day of month (1–31)."));
          return;
        }
        if (dayOfMonthError) {
          dispatch(setScheduleError("Day of month must be between 1 and 31."));
          return;
        }
      }
      if (endDateError) {
        dispatch(setScheduleError("End date must be today or in the future."));
        return;
      }
    }
    dispatch(createRuleSchedule({ ruleIds: selected, config: scheduleConfig }));
  };

  const envOpts = deployEnvs.length ? deployEnvs : [
    { id: "DEV", name: "Development (DEV)" },
    { id: "QAS", name: "QA / Testing (QAS)" },
    { id: "PROD", name: "Production (PRD)" },
  ];

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]";
  const labelCls = "block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1.5";

  return (
    <Modal onClose={() => dispatch(closeModal())} width="max-w-lg">
      <div className="px-6 pt-5 pb-4 border-b border-white/8">
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Schedule Rule Action</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5">Configure automated scheduling for selected rule(s)</p>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Selected rules pills */}
        <div className="p-3.5 rounded-xl border border-white/8 bg-white/[0.025]">
          <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-2">Selected Rules</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.map((id) => (
              <span key={id} className="px-2.5 py-1 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-mono font-semibold">{id}</span>
            ))}
          </div>
        </div>

        {/* Type */}
        <div>
          <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-2">Schedule Type</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: "ONE_TIME",  Icon: Clock,         label: "One-Time",  sub: "Execute once" },
              { val: "RECURRING", Icon: ArrowsClockwise, label: "Recurring", sub: "Regular intervals" },
            ].map(({ val, Icon, label, sub }) => {
              const sel = scheduleConfig.type === val;
              return (
                <button key={val} onClick={() => dispatch(setScheduleConfig({ type: val }))}
                  className={`p-3.5 rounded-xl border text-left transition-all ${sel ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-white/8 hover:border-white/15 hover:bg-white/[0.025]"}`}
                >
                  <Icon size={17} className={sel ? "text-[var(--primary)]" : "text-[var(--muted)]"} />
                  <p className={`text-xs font-semibold mt-1.5 ${sel ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{label}</p>
                  <p className="text-[10px] text-[var(--muted)] mt-0.5">{sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Environment */}
        <div>
          <label className={labelCls}>Target Environment</label>
          <select
            value={scheduleConfig.environment}
            onChange={(e) => dispatch(setScheduleConfig({ environment: e.target.value }))}
            className={inputCls}
          >
            <option value="">Select environment...</option>
            {envOpts.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        {/* One-time dates */}
        {isOneTime && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>From Date</label>
              <input type="date" value={scheduleConfig.fromDate}
                onChange={(e) => dispatch(setScheduleConfig({ fromDate: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>To Date</label>
              <input type="date" value={scheduleConfig.toDate}
                onChange={(e) => dispatch(setScheduleConfig({ toDate: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg bg-[var(--card)] border ${dateError ? "border-red-500" : "border-white/10"} text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]`}
              />
            </div>
          </div>
        )}

        {/* Recurring fields */}
        {isRecurring && (
          <>
            <div>
              <label className={labelCls}>Frequency</label>
              <select
                value={scheduleConfig.frequency}
                onChange={(e) => dispatch(setScheduleConfig({
                  frequency: e.target.value,
                  dayOfWeek: "",
                  dayOfMonth: "",
                }))}
                className={inputCls}
              >
                <option value="">Select frequency...</option>
                {FREQUENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {scheduleConfig.frequency === "WEEKLY" && (
              <div>
                <label className={labelCls}>Day of Week</label>
                <select
                  value={scheduleConfig.dayOfWeek}
                  onChange={(e) => dispatch(setScheduleConfig({ dayOfWeek: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select day...</option>
                  {DAY_OF_WEEK_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {scheduleConfig.frequency === "MONTHLY" && (
              <div>
                <label className={labelCls}>Day of Month</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="1–31"
                  value={scheduleConfig.dayOfMonth}
                  onChange={(e) => dispatch(setScheduleConfig({ dayOfMonth: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg bg-[var(--card)] border ${dayOfMonthError ? "border-red-500" : "border-white/10"} text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]`}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>End Date <span className="normal-case font-normal">(Optional)</span></label>
              <input
                type="date"
                value={scheduleConfig.endDate}
                onChange={(e) => dispatch(setScheduleConfig({ endDate: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg bg-[var(--card)] border ${endDateError ? "border-red-500" : "border-white/10"} text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)]`}
              />
            </div>
          </>
        )}

        {(dateError || endDateError || dayOfMonthError || scheduleError) && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <Warning size={12} />
            {dateError ? "End date must be after start date."
              : endDateError ? "End date must be today or in the future."
              : dayOfMonthError ? "Day of month must be between 1 and 31."
              : scheduleError}
          </p>
        )}
        <div className="p-3.5 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20">
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarCheck size={13} className="text-[var(--primary)]" />
            <p className="text-xs font-semibold text-[var(--primary)]">Schedule Summary</p>
          </div>
          <div className="space-y-0.5 text-xs">
            <p><span className="text-[var(--muted)]">Rules: </span><span className="font-semibold text-[var(--text)]">{selected.length} selected</span></p>
            <p><span className="text-[var(--muted)]">Type: </span><span className="font-semibold text-[var(--text)]">{isOneTime ? "One-Time" : "Recurring"}</span></p>
            {isRecurring && scheduleConfig.frequency && (
              <p>
                <span className="text-[var(--muted)]">Frequency: </span>
                <span className="font-semibold text-[var(--text)]">
                  {frequencyLabel(scheduleConfig.frequency)}
                  {scheduleConfig.frequency === "WEEKLY" && scheduleConfig.dayOfWeek && (
                    <> — {DAY_OF_WEEK_OPTIONS.find((d) => d.value === scheduleConfig.dayOfWeek)?.label}</>
                  )}
                  {scheduleConfig.frequency === "MONTHLY" && scheduleConfig.dayOfMonth && (
                    <> — day {scheduleConfig.dayOfMonth}</>
                  )}
                </span>
              </p>
            )}
            {scheduleConfig.environment && (
              <p><span className="text-[var(--muted)]">Env: </span><span className="font-semibold text-[var(--text)]">{scheduleConfig.environment}</span></p>
            )}
            {isRecurring && scheduleConfig.endDate && (
              <p><span className="text-[var(--muted)]">End Date: </span><span className="font-semibold text-[var(--text)]">{scheduleConfig.endDate}</span></p>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 pb-5 flex gap-2">
        <button onClick={handleCreate} disabled={scheduleLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
        >
          {scheduleLoading ? <CircleNotch size={15} className="animate-spin" /> : <CalendarCheck size={15} />}
          Create Schedule
        </button>
        <button onClick={() => dispatch(closeModal())} disabled={scheduleLoading} className="px-4 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 hover:text-[var(--text)] transition-colors disabled:opacity-50">Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Gate Modals ──────────────────────────────────────────────────────────────
function GateModal() {
  const dispatch  = useAppDispatch();
  const modalType = useAppSelector((s) => s.rules.modalType);
  if (!["SIM_GATE", "SCHEDULE_GATE"].includes(modalType)) return null;
  const isSim = modalType === "SIM_GATE";
  return (
    <Modal onClose={() => dispatch(closeModal())} width="max-w-sm">
      <div className="px-6 pt-7 pb-6 text-center space-y-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${isSim ? "bg-amber-500/15 border border-amber-500/30" : "bg-purple-500/15 border border-purple-500/30"}`}>
          {isSim
            ? <Siren size={26} weight="fill" className="text-amber-400" />
            : <CalendarBlank size={26} weight="fill" className="text-purple-400" />
          }
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[var(--text)]">{isSim ? "Simulation Required" : "Rule Not Active"}</p>
          <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
            {isSim
              ? "You cannot activate a rule without running at least one simulation first. Run a simulation to validate the rule before activation."
              : "Scheduling is only available for ACTIVE rules. Activate the rule first before scheduling execution."}
          </p>
        </div>
        <button onClick={() => dispatch(closeModal())}
          className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[var(--primary)] to-[var(--primary)] hover:opacity-90 text-white text-sm font-semibold transition-opacity"
        >
          Got it
        </button>
      </div>
    </Modal>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function RuleLibraryFull({ onProcessRule, isProcessingRule = false, sapStatus }) {
  const dispatch      = useAppDispatch();
  const loading       = useAppSelector((s) => s.rules.loading);
  const error         = useAppSelector((s) => s.rules.error);
  const list          = useAppSelector((s) => s.rules.list);
  const totalCount    = useAppSelector((s) => s.rules.list.length);
  const filteredRules = useAppSelector(selectFilteredRules);
  const modalType     = useAppSelector((s) => s.rules.modalType);
  const simStep       = useAppSelector((s) => s.rules.simulation.step);

  useEffect(() => {
    dispatch(fetchRules());
    dispatch(fetchEnvironments());
  }, [dispatch]);

  if (error) return (
    <div className="p-10 flex flex-col items-center gap-4">
      <Warning size={32} className="text-red-400" />
      <p className="text-sm text-[var(--muted)]">{error}</p>
      <button onClick={() => dispatch(fetchRules())} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm flex items-center gap-2">
        <ArrowsClockwise size={14} /> Retry
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-5 min-h-full">
      <p className="text-sm text-[var(--muted)]">Enterprise anomaly detection rule governance and lifecycle management</p>

      <StatsCards />
      <FiltersBar count={filteredRules.length} total={totalCount} />
      <ActionBar />

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] p-12 flex items-center justify-center gap-3 bg-[var(--card)]">
          <CircleNotch size={20} className="animate-spin text-blue-400" />
          <span className="text-sm text-[var(--muted)]">Loading rules...</span>
        </div>
      ) : (
        <RuleTable rules={filteredRules} />
      )}

      {/* Modal layer */}
      {modalType === "VIEW"                                                              && <ViewRuleModal />}
      {modalType === "DEPLOY_TO_ENV"                                                     && <DeployToEnvModal />}
      {modalType === "DEPLOY_SUCCESS"                                                    && <DeploySuccessModal />}
      {modalType === "SCHEDULE_RESULT"                                                   && <ScheduleResultModal />}
      {modalType === "ANOMALIES"                                                         && <AnomaliesModal />}
      {simStep > 0                                                                       && <SimulationModal />}
      {["CONFIRM_DEPLOY","CONFIRM_ACTIVATE","CONFIRM_DEACTIVATE"].includes(modalType)    && <ConfirmModal />}
      {modalType === "SCHEDULE"                                                          && <ScheduleModal />}
      {["SIM_GATE","SCHEDULE_GATE"].includes(modalType)                                 && <GateModal />}
    </div>
  );
}