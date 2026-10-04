/**
 * Schedules.jsx — Rule schedule management (Admin + Analyst).
 * Admin: view + edit frequency & execution time.
 * Analyst: view only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import DetectedCasesModal from "../components/detected-cases/DetectedCasesModal";
import {
  fetchActiveSchedulesAPI,
  fetchScheduleExecutionsAPI,
  fetchExecutionAnomaliesAPI,
  updateScheduleAPI,
  archiveScheduleAPI,
  deactivateScheduleAPI,
  activateScheduleAPI,
  deleteScheduleExecutionAPI,
  ENV_OPTIONS,
  FREQUENCY_OPTIONS,
  DAY_OF_WEEK_OPTIONS,
} from "../features/schedules/schedulesAPI";
import { fetchScheduleParameterPreviewAPI } from "../features/rules/rulesBackendAPI";
import {
  CalendarBlank,
  Clock,
  CircleNotch,
  FunnelSimple,
  MagnifyingGlass,
  PencilSimple,
  X,
  CheckCircle,
  Warning,
  Play,
  Pause,
  ListChecks,
  Archive,
  Trash,
} from "@phosphor-icons/react";

const STATUS_STYLE = {
  Active: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  Pending: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  Completed: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
  Inactive: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
  Archived: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
};

const EXEC_STATUS_STYLE = {
  SUCCESS: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  FAILED: "bg-red-500/20 text-red-300 border border-red-500/30",
  PARTIAL: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
};

function StatusBadge({ status, map = STATUS_STYLE }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
        map[status] || "bg-slate-500/20 text-slate-300 border border-slate-500/30"
      }`}
    >
      {status}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uniqueCaseCount(caseIds, fallback = 0) {
  if (!Array.isArray(caseIds) || caseIds.length === 0) return fallback;
  return new Set(caseIds.filter(Boolean)).size;
}

function scheduleTypeFromFrequency(freq) {
  return freq === "ONE_TIME" ? "ONE_TIME" : "RECURRING";
}

function frequencyFromSchedule(schedule) {
  if (schedule?.type === "ONE_TIME") return "ONE_TIME";
  return schedule?.frequency || "DAILY";
}

function scheduleFrequencyLabel(schedule) {
  if (schedule?.frequencyLabel) return schedule.frequencyLabel;
  if (schedule?.type === "ONE_TIME") return "One-time";
  const opt = FREQUENCY_OPTIONS.find((o) => o.value === schedule?.frequency);
  return opt?.label || schedule?.frequency || "—";
}

function scheduleParamInputType(abapType) {
  if (!abapType) return "text";
  const lower = abapType.toLowerCase();
  if (lower.includes("dats") || lower.includes("date")) return "date";
  if (lower.includes("tims") || lower.includes("time")) return "time";
  if (lower.includes("dec") || lower.includes("float") || lower.includes("numc")) return "number";
  return "text";
}

function EditScheduleModal({ schedule, onClose, onSaved }) {
  const [frequency, setFrequency] = useState(() => frequencyFromSchedule(schedule));
  const [environment, setEnvironment] = useState(schedule?.environment || "QA");
  const [executionTime, setExecutionTime] = useState(schedule?.executionTime || "09:00");
  const [endDate, setEndDate] = useState(schedule?.endDate || "");
  const [dayOfWeek, setDayOfWeek] = useState(schedule?.dayOfWeek || "MON");
  const [dayOfMonth, setDayOfMonth] = useState(String(schedule?.dayOfMonth || 1));
  const [parameterValues, setParameterValues] = useState(schedule?.parameterValues || {});
  const [parameterPreview, setParameterPreview] = useState({});
  const [loadingParams, setLoadingParams] = useState(false);
  const [paramsError, setParamsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isRecurring = frequency !== "ONE_TIME";
  const ruleIds = schedule?.ruleIds || [];

  useEffect(() => {
    if (!ruleIds.length || !environment) {
      setParameterPreview({});
      setParamsError("");
      return;
    }

    let cancelled = false;
    setLoadingParams(true);
    setParamsError("");

    fetchScheduleParameterPreviewAPI(ruleIds, environment)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setParamsError(res.message || "Failed to load CDS parameters");
          setParameterPreview({});
          return;
        }

        const preview = res.data || {};
        setParameterPreview(preview);

        const merged = {};
        Object.entries(preview).forEach(([ruleId, rulePreview]) => {
          const stored = schedule?.parameterValues?.[ruleId] || {};
          const values = {};
          (rulePreview.parameters || []).forEach((param) => {
            const existing = stored[param.name];
            values[param.name] =
              existing !== undefined && existing !== null && existing !== ""
                ? existing
                : param.value ?? "";
          });
          if (Object.keys(values).length > 0) {
            merged[ruleId] = values;
          }
        });
        setParameterValues(merged);
      })
      .catch((err) => {
        if (cancelled) return;
        setParamsError(err?.message || "Failed to load CDS parameters");
        setParameterPreview({});
      })
      .finally(() => {
        if (!cancelled) setLoadingParams(false);
      });

    return () => { cancelled = true; };
  }, [schedule?.id, environment, ruleIds.join(",")]);

  const handleParamChange = (ruleId, paramName, value) => {
    setParameterValues((prev) => ({
      ...prev,
      [ruleId]: { ...(prev[ruleId] || {}), [paramName]: value },
    }));
  };

  const validateParameters = () => {
    for (const ruleId of ruleIds) {
      const preview = parameterPreview[ruleId];
      if (!preview?.parameters?.length) continue;
      const values = parameterValues[ruleId] || {};
      const missing = preview.parameters
        .filter((param) => !values[param.name])
        .map((param) => param.label || param.name);
      if (missing.length > 0) {
        return `${preview.ruleName || ruleId}: please fill CDS parameters — ${missing.join(", ")}`;
      }
    }
    return "";
  };

  const handleSave = async () => {
    setError("");
    const paramValidationError = validateParameters();
    if (paramValidationError) {
      setError(paramValidationError);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: scheduleTypeFromFrequency(frequency),
        frequency: isRecurring ? frequency : null,
        environment,
        executionTime,
        dayOfWeek: frequency === "WEEKLY" ? dayOfWeek : null,
        dayOfMonth: frequency === "MONTHLY" ? Number(dayOfMonth) : null,
        parameterValues,
      };
      if (isRecurring) {
        payload.endDate = endDate || null;
      }
      const res = await updateScheduleAPI(schedule.id, payload);
      if (!res.success) throw new Error(res.message || "Update failed");
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--card)] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Edit Schedule</h2>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 font-mono">{schedule.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-2">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={`px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors ${
                    frequency === opt.value
                      ? "bg-[var(--primary)]/20 border-[var(--primary)]/40 text-[var(--primary)]"
                      : "border-white/10 text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {frequency === "WEEKLY" && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
              >
                {DAY_OF_WEEK_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {frequency === "MONTHLY" && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">Day of Month</label>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
            >
              {ENV_OPTIONS.map((env) => (
                <option key={env} value={env}>{env}</option>
              ))}
            </select>
          </div>

          {isRecurring && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">
                End Date <span className="text-[var(--muted)] font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
              />
              <p className="text-[10px] text-[var(--muted)] mt-1">
                Schedule stops running after this date. Leave empty for no end date.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">Execution Time</label>
            <input
              type="time"
              value={executionTime}
              onChange={(e) => setExecutionTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
            />
            <p className="text-[10px] text-[var(--muted)] mt-1">Local server timezone</p>
          </div>

          {environment && ruleIds.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div>
                <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">
                  CDS View Parameters
                </p>
                <p className="text-[11px] text-[var(--muted)] mt-1">
                  Edit parameter values used when this schedule runs.
                </p>
              </div>

              {loadingParams ? (
                <div className="flex items-center gap-2 text-xs text-[var(--muted)] py-2">
                  <CircleNotch size={14} className="animate-spin" />
                  Loading parameters...
                </div>
              ) : paramsError ? (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <Warning size={12} /> {paramsError}
                </p>
              ) : (
                ruleIds.map((ruleId) => {
                  const preview = parameterPreview[ruleId];
                  if (!preview) return null;

                  return (
                    <div
                      key={ruleId}
                      className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-3"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[var(--text)]">{preview.ruleName || ruleId}</p>
                        <p className="text-[10px] text-[var(--muted)] font-mono mt-0.5">{ruleId}</p>
                      </div>

                      {!preview.parameters?.length ? (
                        <p className="text-xs text-[var(--muted)]">No CDS view parameters for this rule.</p>
                      ) : (
                        preview.parameters.map((param) => (
                          <div key={`${ruleId}-${param.name}`}>
                            <label className="block text-xs font-semibold text-[var(--text)] mb-1.5">
                              {param.label || param.name}
                            </label>
                            <input
                              type={scheduleParamInputType(param.type)}
                              placeholder={param.label || param.name}
                              value={parameterValues[ruleId]?.[param.name] || ""}
                              onChange={(e) => handleParamChange(ruleId, param.name, e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <Warning size={12} /> {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-[var(--muted)] text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingParams}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <CircleNotch size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterBar({ tab, filters, onChange }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <FunnelSimple size={14} className="text-[var(--muted)]" />
        <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-widest">Filters</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 items-end">
        <div className="relative xl:col-span-2">
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            placeholder={tab === "active" ? "Search schedule ID, rule..." : "Search rule, case ID, schedule ID..."}
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
          />
        </div>

        <select
          value={filters.environment}
          onChange={(e) => onChange({ environment: e.target.value })}
          className="px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
        >
          <option value="">All Environments</option>
          {ENV_OPTIONS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>

        {tab === "active" ? (
          <select
            value={filters.frequency}
            onChange={(e) => onChange({ frequency: e.target.value })}
            className="px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
          >
            <option value="">All Frequencies</option>
            {FREQUENCY_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        ) : (
          <>
            <select
              value={filters.status}
              onChange={(e) => onChange({ status: e.target.value })}
              className="px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="PARTIAL">Partial</option>
            </select>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">
                From
              </label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => onChange({ fromDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">
                To
              </label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => onChange({ toDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-white/10 text-sm text-[var(--text)]"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function canToggleSchedulePause(schedule) {
  if (schedule?.isArchived || schedule?.status === "Completed") return false;
  return true;
}

function isSchedulePaused(schedule) {
  return schedule?.isActive === false || schedule?.status === "Inactive";
}

export default function Schedules() {
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role === "Admin";
  const canAccess = user?.role === "Admin" || user?.role === "Analyst";

  const [tab, setTab] = useState("active");
  const [filters, setFilters] = useState({
    search: "",
    environment: "",
    frequency: "",
    status: "",
    fromDate: "",
    toDate: "",
  });
  const [schedules, setSchedules] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [loadingExecutionId, setLoadingExecutionId] = useState(null);
  const [executionCasesModal, setExecutionCasesModal] = useState(null);
  const [togglingActiveId, setTogglingActiveId] = useState(null);
  const [deletingExecutionId, setDeletingExecutionId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);

  const activeFilters = useMemo(() => {
    const out = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) out[k] = v;
    });
    return out;
  }, [filters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "active") {
        const res = await fetchActiveSchedulesAPI(activeFilters);
        if (!res.success) throw new Error(res.message || "Failed to load schedules");
        setSchedules((res.data || []).filter((s) => s.status !== "Completed"));
      } else {
        const res = await fetchScheduleExecutionsAPI({ ...activeFilters, limit: 200 });
        if (!res.success) throw new Error(res.message || "Failed to load execution history");
        setExecutions(res.data);
      }
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [tab, activeFilters]);

  useEffect(() => {
    if (!canAccess) return;
    const timer = setTimeout(loadData, 250);
    return () => clearTimeout(timer);
  }, [canAccess, loadData]);

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  const updateFilters = (patch) => setFilters((prev) => ({ ...prev, ...patch }));

  const handleScheduleSaved = (updated) => {
    setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleScheduleArchived = (scheduleId) => {
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
  };

  const handleArchiveSchedule = async (schedule) => {
    const confirmed = window.confirm(
      "Archive this schedule? It will stop running but all history and details are kept."
    );
    if (!confirmed) return;

    setArchivingId(schedule.id);
    setError("");
    try {
      const res = await archiveScheduleAPI(schedule.id);
      if (!res.success) throw new Error(res.message || "Archive failed");
      handleScheduleArchived(schedule.id);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to archive schedule");
    } finally {
      setArchivingId(null);
    }
  };

  const handleToggleScheduleActive = async (schedule, activate) => {
    if (!isAdmin || !canToggleSchedulePause(schedule)) return;
    setTogglingActiveId(schedule.id);
    try {
      const res = activate
        ? await activateScheduleAPI(schedule.id)
        : await deactivateScheduleAPI(schedule.id);
      if (!res.success) {
        throw new Error(res.message || `Failed to ${activate ? "activate" : "pause"} schedule`);
      }
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, ...res.data } : s))
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          `Failed to ${activate ? "activate" : "pause"} schedule`
      );
    } finally {
      setTogglingActiveId(null);
    }
  };

  const handleDeleteExecution = async (executionId) => {
    if (!isAdmin) return;
    setDeletingExecutionId(executionId);
    try {
      const res = await deleteScheduleExecutionAPI(executionId);
      if (!res.success) throw new Error(res.message || "Failed to delete execution");
      setExecutions((prev) => prev.filter((ex) => ex.id !== executionId));
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to delete execution");
    } finally {
      setDeletingExecutionId(null);
    }
  };

  const handleExecutionRowClick = async (ex) => {
    if (loadingExecutionId) return;
    setLoadingExecutionId(ex.id);
    setError("");
    try {
      const caseIds = ex.caseIds || [];
      let anomalies = [];
      if (ex.ruleId && caseIds.length > 0) {
        const res = await fetchExecutionAnomaliesAPI(ex.ruleId, caseIds);
        if (!res.success) throw new Error(res.message || "Failed to load detected cases");
        anomalies = res.data;
      }
      setExecutionCasesModal({
        anomalies,
        count: anomalies.length || uniqueCaseCount(caseIds, ex.anomaliesDetected ?? 0),
        ruleName: ex.ruleName,
      });
    } catch (err) {
      setError(err.message || "Failed to load detected cases");
    } finally {
      setLoadingExecutionId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-[1400px] mx-auto space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                    <CalendarBlank size={18} className="text-blue-400" weight="duotone" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-[var(--text)]">Schedules</h1>
                    <p className="text-[12px] text-[var(--muted)] mt-0.5">
                      {isAdmin ? "View and manage rule execution schedules" : "View rule execution schedules"}
                    </p>
                  </div>
                </div>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--muted)]">
                {user?.role}
              </span>
            </div>

            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/10 w-fit">
              <button
                onClick={() => setTab("active")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                  tab === "active"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <Play size={14} weight={tab === "active" ? "fill" : "regular"} />
                Active Schedules
              </button>
              <button
                onClick={() => setTab("history")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                  tab === "history"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <ListChecks size={14} weight={tab === "history" ? "fill" : "regular"} />
                Execution History
              </button>
            </div>

            <FilterBar tab={tab} filters={filters} onChange={updateFilters} />

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <Warning size={16} /> {error}
              </div>
            )}

            <div className="rounded-xl border border-white/10 overflow-hidden bg-[var(--card)]">
              {loading ? (
                <div className="flex items-center justify-center py-20 text-[var(--muted)] gap-2">
                  <CircleNotch size={20} className="animate-spin" />
                  Loading...
                </div>
              ) : tab === "active" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        {[
                          "Schedule ID",
                          "Rule(s)",
                          "Env",
                          "Frequency",
                          "Status",
                          "Next Run",
                          "End Date",
                          "Last Run",
                          ...(isAdmin ? ["Actions"] : []),
                        ].map((h) => (
                          <th key={h} className="px-4 py-3 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 9 : 8} className="px-4 py-12 text-center text-[var(--muted)] text-sm">
                            No schedules found
                          </td>
                        </tr>
                      ) : (
                        schedules.map((s) => (
                          <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="px-4 py-3.5">
                              <p className="text-[12px] font-mono font-semibold text-[var(--text)]">{s.id}</p>
                            </td>
                            <td className="px-4 py-3.5 text-[12px] text-[var(--text)] max-w-[220px]">
                              <span className="line-clamp-2">{s.rulesDisplay}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[11px] font-mono font-semibold text-blue-300">{s.environment}</span>
                            </td>
                            <td className="px-4 py-3.5 text-[12px] text-[var(--text)]">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-[var(--muted)]" />
                                {scheduleFrequencyLabel(s)}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="px-4 py-3.5 text-[12px] text-[var(--text)] whitespace-nowrap">
                              {formatDateTime(s.nextRunAt)}
                            </td>
                            <td className="px-4 py-3.5 text-[12px] text-[var(--muted)] whitespace-nowrap">
                              {s.endDate || "—"}
                            </td>
                            <td className="px-4 py-3.5 text-[12px] text-[var(--muted)] whitespace-nowrap">
                              {formatDateTime(s.lastRunAt)}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1">
                                  {canToggleSchedulePause(s) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleScheduleActive(s, isSchedulePaused(s))
                                      }
                                      disabled={togglingActiveId === s.id}
                                      title={isSchedulePaused(s) ? "Resume schedule" : "Pause schedule"}
                                      className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-50"
                                    >
                                      {togglingActiveId === s.id ? (
                                        <CircleNotch size={16} className="animate-spin" />
                                      ) : isSchedulePaused(s) ? (
                                        <Play size={16} weight="fill" />
                                      ) : (
                                        <Pause size={16} weight="fill" />
                                      )}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setEditingSchedule(s)}
                                    className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                                    title="Edit schedule"
                                  >
                                    <PencilSimple size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleArchiveSchedule(s)}
                                    disabled={archivingId === s.id}
                                    title="Archive schedule"
                                    className="p-2 rounded-lg text-[var(--muted)] hover:text-purple-300 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {archivingId === s.id ? (
                                      <CircleNotch size={16} className="animate-spin" />
                                    ) : (
                                      <Archive size={16} />
                                    )}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        {[
                          "Executed At",
                          "Schedule ID",
                          "Rule",
                          "Env",
                          "Status",
                          "Scanned",
                          "Anomalies",
                          ...(isAdmin ? ["Actions"] : []),
                        ].map((h) => (
                          <th key={h} className="px-4 py-3 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {executions.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center text-[var(--muted)] text-sm">
                            No execution history found
                          </td>
                        </tr>
                      ) : (
                        executions.map((ex) => (
                          <tr
                            key={ex.id}
                            onClick={() => handleExecutionRowClick(ex)}
                            className={`border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors ${
                              loadingExecutionId === ex.id ? "opacity-60" : ""
                            }`}
                          >
                            <td className="px-4 py-3.5 text-[12px] text-[var(--text)] whitespace-nowrap">
                              {formatDateTime(ex.executedAt)}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[12px] font-mono text-[var(--text)]">{ex.scheduleId || "—"}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-[12px] text-[var(--text)]">{ex.ruleName}</p>
                              <p className="text-[10px] text-[var(--muted)] font-mono">{ex.ruleId}</p>
                            </td>
                            <td className="px-4 py-3.5 text-[11px] font-mono text-blue-300">{ex.environment || "—"}</td>
                            <td className="px-4 py-3.5">
                              <StatusBadge status={ex.status} map={EXEC_STATUS_STYLE} />
                            </td>
                            <td className="px-4 py-3.5 text-[12px] text-[var(--text)]">
                              {ex.transactionsScanned?.toLocaleString?.() ?? ex.transactionsScanned ?? 0}
                            </td>
                            <td className="px-4 py-3.5 text-[12px] font-semibold text-red-400">
                              {uniqueCaseCount(ex.caseIds, ex.anomaliesDetected ?? 0)}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteExecution(ex.id);
                                  }}
                                  disabled={deletingExecutionId === ex.id}
                                  className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                  title="Delete execution record"
                                >
                                  {deletingExecutionId === ex.id ? (
                                    <CircleNotch size={14} className="animate-spin" />
                                  ) : (
                                    <Trash size={14} />
                                  )}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {editingSchedule && (
        <EditScheduleModal
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSaved={handleScheduleSaved}
        />
      )}

      {executionCasesModal && (
        <DetectedCasesModal
          anomalies={executionCasesModal.anomalies}
          count={executionCasesModal.count}
          source="schedule"
          onClose={() => setExecutionCasesModal(null)}
        />
      )}
    </div>
  );
}
