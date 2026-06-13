/**
 * CaseManagement.jsx
 *
 * FIXES vs previous:
 * 1. Task form hidden — only shows when "+ Add Task" is clicked
 * 2. Footer buttons match screenshot EXACTLY:
 *    Reassign Case | Escalate to Senior Team (amber) | Confirmed (red) | False Positive (dark) | No Action Needed (green) | Close
 * 3. When status = "Closed" → footer action buttons hidden, only Close visible
 * 4. Unassigned cases → show "Assign to Me" + "Assign to Analyst" panel instead of action buttons
 * 5. Analyst panel shows real-time investigator list from API
 * 6. No browser alert() — replaced with in-modal confirmation toast
 * 7. Butter-smooth scroll: transform3d GPU layer, passive scroll, no layout thrashing
 * 8. Pixel-perfect section headings with colored dot circles matching screenshots
 */

import { useEffect, useState, useCallback, useRef, memo } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import {
  fetchCasesAPI, fetchCaseDetailAPI, updateCaseAPI,
  createTaskAPI, assignCaseAPI, fetchInvestigatorsAPI, TASK_PROCESSORS,
} from "../features/cases/casesApi";
import {
  MagnifyingGlass, X, Warning, CircleNotch, CheckCircle,
  Robot, FunnelSimple, FileText, Clock, Users,
  CurrencyDollar, ShieldWarning, GitBranch, UserCircle,
  ListChecks, ArrowCounterClockwise, TrendUp, Plus, Paperclip,
  UserPlus, ArrowRight, CheckFat, DownloadSimple,
} from "@phosphor-icons/react";
import { loadRiskConfigs, resolveRiskLevelByAmount, RISK_CONFIG_STORAGE_KEY } from "../features/cases/riskConfig";

// ─── Style maps ───────────────────────────────────────────────────────────────
const RISK_COLOR = s => s >= 90 ? "text-red-400" : s >= 75 ? "text-orange-400" : s >= 60 ? "text-yellow-400" : "text-green-400";
const SEV = {
  critical: "bg-red-500/20 text-red-400 border border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  low: "bg-green-500/20 text-green-400 border border-green-500/30",
};
const STATUS_CLS = {
  "New": "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  "Investigating": "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  "AI Assisted": "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  "Closed": "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  "Escalated": "bg-red-500/20 text-red-300 border border-red-500/30",
};
const ENV_CLS = { STAGING: "text-amber-400", PRODUCTION: "text-red-400", DEVELOPMENT: "text-emerald-400" };
const RISK_LEVEL_BADGE = {
  LOW: "bg-green-500/20 text-green-400 border border-green-500/30",
  MEDIUM: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  CRITICAL: "bg-red-500/20 text-red-400 border border-red-500/30",
};


// ─── Atoms ────────────────────────────────────────────────────────────────────
const SevBadge = memo(({ sev }) =>
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${SEV[sev] || SEV.low}`}>{sev}</span>
);
const StatusBadge = memo(({ status }) =>
  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${STATUS_CLS[status] || STATUS_CLS["New"]}`}>{status}</span>
);
const AssigneeChip = memo(({ name }) => {
  if (!name || name === "Unassigned") return <span className="text-[12px] text-[var(--muted)]">Unassigned</span>;
  const init = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center text-[9px] font-bold text-[var(--primary)]">{init}</div>
      <span className="text-[12px] text-[var(--text)]">{name}</span>
    </div>
  );
});

/** Colored circle dot + label — matches screenshots exactly */
function Sh({ dot = "bg-blue-500", label, badge, rightEl }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${dot}`} />
        <h3 className="text-[13px] font-semibold text-[var(--text)]">{label}</h3>
        {badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold">{badge}</span>}
      </div>
      {rightEl}
    </div>
  );
}
function InfoCell({ label, value, mono = false, cls = "" }) {
  return (
    <div className={`p-3 rounded-lg border border-[var(--border)] bg-white/[0.015] ${cls}`}>
      <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-[13px] font-medium text-[var(--text)] ${mono ? "font-mono text-[11px] break-all" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildCaseReportHtml(caseData, detail) {
  if (!caseData || !detail) return "";
  const d = detail;
  const printedAt = new Date().toLocaleString();
  const fi = d.financialImpact || { potentialLoss: 0, recoveryProbability: 0, estimatedRecovery: 0 };
  const riskIndicators = d.riskIndicators || [];
  const behavioralPatterns = d.behavioralPatterns || [];
  const complianceIssues = d.complianceIssues || [];
  const networkAnalysis = d.networkAnalysis || [];
  const relatedTransactions = d.relatedTransactions || [];
  const auditTrail = d.auditTrail || [];
  const anomalyIndicators = d.anomalyIndicators || [];
  const evidence = d.evidence || [];
  const aiRecommendations = d.aiRecommendations || [];
  const aiSummary = d.aiSummary || { confidence: 0, recommendation: "", summary: "", keyFindings: [], riskAssessment: "" };
  const ruleInfo = d.ruleInfo || {};
  const transaction = d.transaction || {};
  const userInfo = d.userInfo || {};
  const customerDetails = d.customerDetails || {};
  const section = (title, body) => `<section class="section"><h2>${escHtml(title)}</h2>${body}</section>`;
  const grid = (cells) => `<div class="grid">${cells.map(c => `<div class="cell"><span class="lbl">${escHtml(c.label)}</span><span class="val${c.mono ? " mono" : ""}">${escHtml(c.value ?? "—")}</span></div>`).join("")}</div>`;
  const list = (items) => `<ul>${items.map(i => `<li>${escHtml(i)}</li>`).join("")}</ul>`;

  const riskRows = riskIndicators.map(r =>
    `<div class="card"><div class="card-hdr"><strong>${escHtml(r.label)}</strong><span class="score">${r.score}</span></div>${r.bullets.map(b => `<p class="bullet">• ${escHtml(b)}</p>`).join("")}</div>`
  ).join("");

  const patternRows = behavioralPatterns.map(p =>
    `<div class="card"><div class="card-hdr"><strong>${escHtml(p.name)}</strong><span class="tag">${escHtml(p.severity)}</span></div><p>Frequency: ${escHtml(p.frequency)}</p><p>Last: ${escHtml(p.last)}</p></div>`
  ).join("");

  const complianceRows = complianceIssues.map(c =>
    `<div class="card"><div class="card-hdr"><strong>${escHtml(c.law)}</strong><span class="tag">${escHtml(c.severity)}</span></div><p>${escHtml(c.issue)}</p><p class="muted">Penalty: ${escHtml(c.penalty)}</p></div>`
  ).join("");

  const networkRows = networkAnalysis.map(n =>
    `<tr><td class="mono">${escHtml(n.entityId)}</td><td>${escHtml(n.type)}</td><td>${escHtml(n.relationship)}</td><td>${escHtml(n.riskLevel)}</td></tr>`
  ).join("");

  const relatedRows = relatedTransactions.map(t =>
    `<tr><td class="mono">${escHtml(t.docId)}</td><td>${escHtml(t.type)}</td><td>${escHtml(t.date)}</td><td>${escHtml(t.amount)}</td><td>${escHtml(t.status)}</td></tr>`
  ).join("");

  const auditRows = auditTrail.map(a =>
    `<div class="audit"><div class="audit-hdr"><strong>${escHtml(a.event)}</strong><span>${escHtml(a.timestamp)}</span></div><p class="muted">By: ${escHtml(a.by)}</p><p>${escHtml(a.desc)}</p></div>`
  ).join("");

  const anomalyRows = anomalyIndicators.map(a =>
    `<div class="card"><div class="card-hdr"><strong>${escHtml(a.name)}</strong><span class="tag">${escHtml(a.severity)}</span></div><p>${escHtml(a.desc)}</p></div>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Case ${escHtml(caseData.id)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #111; margin: 0; padding: 24px 32px; font-size: 12px; line-height: 1.45; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { color: #555; margin-bottom: 16px; }
  .meta { display: flex; flex-wrap: wrap; gap: 12px 24px; padding: 12px 16px; background: #f4f6f8; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 20px; }
  .meta span { font-size: 11px; }
  .meta strong { display: block; font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.04em; }
  .section { margin-bottom: 18px; page-break-inside: avoid; }
  .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #333; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin: 0 0 10px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cell, .card { border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px; background: #fafafa; }
  .lbl { display: block; font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.05em; margin-bottom: 2px; }
  .val { font-size: 12px; font-weight: 600; }
  .mono { font-family: Consolas, monospace; font-size: 11px; }
  .card-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .score { font-size: 16px; font-weight: 700; }
  .tag { font-size: 9px; text-transform: uppercase; background: #eee; padding: 2px 6px; border-radius: 3px; }
  .bullet { margin: 2px 0; color: #333; }
  .muted { color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
  ul { margin: 6px 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .audit { border-left: 3px solid #2563eb; padding-left: 10px; margin-bottom: 10px; }
  .audit-hdr { display: flex; justify-content: space-between; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #888; }
  @media print { body { padding: 12px 16px; } }
</style></head><body>
  <h1>Case Investigation Report</h1>
  <p class="subtitle">${escHtml(caseData.title)}</p>
  <div class="meta">
    <span><strong>Case ID</strong>${escHtml(caseData.id)}</span>
    <span><strong>Risk Score</strong>${caseData.riskScore}/100</span>
    <span><strong>Status</strong>${escHtml(caseData.status)}</span>
    <span><strong>Resolution</strong>${escHtml(caseData.closureStatus || "—")}</span>
    <span><strong>Assignee</strong>${escHtml(caseData.assignee)}</span>
    <span><strong>Printed</strong>${escHtml(printedAt)}</span>
  </div>
  ${section("Case Overview", grid([
    { label: "Status", value: caseData.status },
    { label: "Assignee", value: caseData.assignee },
    { label: "Rule", value: caseData.ruleName || ruleInfo.ruleName },
    { label: "Environment", value: ruleInfo.environment },
  ]))}
  ${section("AI Analysis Summary", `
    <p><strong>${aiSummary.confidence}% Confidence</strong> — Recommendation: ${escHtml(aiSummary.recommendation)}</p>
    <p>${escHtml(aiSummary.summary)}</p>
    <p class="lbl">Key Findings</p>${list(aiSummary.keyFindings || [])}
    <p class="lbl">Risk Assessment</p><p>${escHtml(aiSummary.riskAssessment)}</p>`)}
  ${section("Risk Indicators", `<div class="grid-2">${riskRows}</div>`)}
  ${section("Financial Impact", `<div class="grid-3">
    <div class="cell"><span class="lbl">Potential Loss</span><span class="val">$${Number(fi.potentialLoss).toLocaleString()} USD</span></div>
    <div class="cell"><span class="lbl">Recovery Probability</span><span class="val">${fi.recoveryProbability}%</span></div>
    <div class="cell"><span class="lbl">Estimated Recovery</span><span class="val">$${Number(fi.estimatedRecovery).toLocaleString()} USD</span></div>
  </div>`)}
  ${section(`Behavioral Patterns (${behavioralPatterns.length})`, `<div class="grid-2">${patternRows}</div>`)}
  ${section(`Compliance Issues (${complianceIssues.length})`, complianceRows)}
  ${section("Network Analysis", `<table><thead><tr><th>Entity ID</th><th>Type</th><th>Relationship</th><th>Risk</th></tr></thead><tbody>${networkRows}</tbody></table>`)}
  ${section("Rule Information", grid([
    { label: "Rule Name", value: ruleInfo.ruleName },
    { label: "Rule ID", value: ruleInfo.ruleId, mono: true },
    { label: "Environment", value: ruleInfo.environment },
    { label: "Detection Time", value: ruleInfo.detectionTime },
  ]))}
  ${section("Transaction Details", grid([
    { label: "Document Number", value: transaction.documentNumber, mono: true },
    { label: "Amount", value: transaction.amount },
    { label: "Posting Date", value: transaction.postingDate },
    { label: "Document Date", value: transaction.documentDate },
    { label: "Company Code", value: transaction.companyCode },
    { label: "Fiscal Year/Period", value: transaction.fiscalYearPeriod },
    { label: "Reference", value: transaction.reference, mono: true },
    { label: "Header Text", value: transaction.headerText },
  ]))}
  ${section("User Information", grid([
    { label: "User ID", value: userInfo.userId, mono: true },
    { label: "User Name", value: userInfo.userName },
    { label: "Role", value: userInfo.role },
    { label: "Department", value: userInfo.department },
    { label: "Location", value: userInfo.location },
    { label: "Last Login", value: userInfo.lastLogin },
    { label: "IP Address", value: userInfo.ipAddress, mono: true },
  ]))}
  ${section("Customer Details", grid([
    { label: "ID", value: customerDetails.id, mono: true },
    { label: "Name", value: customerDetails.name },
    { label: "Account Group", value: customerDetails.accountGroup },
    { label: "Country", value: customerDetails.country },
    { label: "City", value: customerDetails.city },
    { label: "Payment Terms", value: customerDetails.paymentTerms },
    { label: "Bank Account", value: customerDetails.bankAccount, mono: true },
  ]))}
  ${(anomalyIndicators.length ? section(`System Alerts (${anomalyIndicators.length})`, anomalyRows) : "")}
  ${section(`Related Transactions (${relatedTransactions.length})`, `<table><thead><tr><th>Document ID</th><th>Type</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>${relatedRows}</tbody></table>`)}
  ${section("Audit Trail", auditRows)}
  ${section("Description & Evidence", `<p>${escHtml(d.description || "")}</p><p class="lbl">Evidence</p>${list(evidence)}<p class="lbl">AI Recommendations</p>${list(aiRecommendations)}`)}
  <div class="footer">SAP-AI Case Management — Confidential investigation record</div>
</body></html>`;

  return html;
}

function downloadCaseReport(caseData, detail) {
  const html = buildCaseReportHtml(caseData, detail);
  if (!html) return;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Case-Report-${caseData.id || "unknown"}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ─── In-modal toast (replaces browser alert) ──────────────────────────────────
function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1a2035] border border-[var(--border)] rounded-2xl shadow-2xl px-6 py-5 max-w-sm w-full mx-4 text-center space-y-4">
        <CheckFat size={28} weight="fill" className="text-emerald-400 mx-auto" />
        <p className="text-[14px] font-semibold text-[var(--text)]">{msg}</p>
        <button onClick={onClose} className="px-6 py-2 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white text-[13px] font-semibold transition-opacity">OK</button>
      </div>
    </div>
  );
}

// ─── Assign Panel ─────────────────────────────────────────────────────────────
function AssignPanel({ caseId, currentUser, onAssign, onClose }) {
  const [investigators, setInvestigators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    fetchInvestigatorsAPI().then(r => { if (r.success) setInvestigators(r.data); setLoading(false); });
  }, []);

  const doAssign = async (name) => {
    setAssigning(name);
    await onAssign(name);
    setAssigning(null);
  };

  return (
    <div className="fixed inset-0 z-[55] flex" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[320px] bg-[#0f1520] border-l border-[var(--border)] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
          <h3 className="text-[13px] font-semibold text-[var(--text)]">Available Investigators</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Assign to Me */}
          <button onClick={() => doAssign(currentUser)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15 transition-colors text-left group">
            <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {currentUser?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[var(--text)]">Assign to Me</p>
              <p className="text-[10px] text-[var(--muted)]">Current User</p>
            </div>
            {assigning === currentUser ? <CircleNotch size={14} className="animate-spin text-[var(--primary)]" /> : <ArrowRight size={14} className="text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity" />}
          </button>

          {loading ? (
            <div className="py-4 flex items-center justify-center gap-2 text-[var(--muted)]">
              <CircleNotch size={14} className="animate-spin text-blue-400" />
              <span className="text-[11px]">Loading investigators...</span>
            </div>
          ) : (
            investigators.map(inv => (
              <button key={inv.id} onClick={() => doAssign(inv.name)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-white/[0.03] transition-all text-left group">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 ${inv.isAI ? "bg-purple-600" : inv.available ? "bg-teal-600" : "bg-gray-600"}`}>
                  {inv.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-semibold text-[var(--text)] truncate">{inv.name}</p>
                    {!inv.available && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 font-medium flex-shrink-0">Busy</span>}
                  </div>
                  <p className="text-[10px] text-[var(--muted)] truncate">{inv.title}</p>
                </div>
                {assigning === inv.name ? <CircleNotch size={14} className="animate-spin text-blue-400" /> : <ArrowRight size={14} className="text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Case Investigation Modal ──────────────────────────────────────────────────
export function CaseModal({ caseId, onClose, onUpdate, overlayZ = "z-50" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", assignTo: "", description: "", priority: "Medium", dueDate: "" });
  const [showAssign, setShowAssign] = useState(false);
  const [detectedAnomalies, setDetectedAnomalies] = useState([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetchCaseDetailAPI(caseId).then(r => { if (r.success) setData(r.data); setLoading(false); });
    
    // Fetch stored anomalies from database via API endpoint
    setAnomaliesLoading(true);
    fetch(`/sap/anomalies/list/?limit=100`)
      .then(res => res.json())
      .then(json => {
        if (json.status === 'success' && json.anomalies) {
          setDetectedAnomalies(json.anomalies);
        }
        setAnomaliesLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch detected anomalies:', err);
        setAnomaliesLoading(false);
      });
  }, [caseId]);

  const handleAction = useCallback(async (action) => {
    if (!data || saving) return;
    setSaving(true);
    const MAP = {
      "Escalate": { status: "Escalated", closureStatus: null },
      "Confirmed": { status: "Closed", closureStatus: "Confirmed" },
      "FalsePositive": { status: "Closed", closureStatus: "False Positive" },
      "NoAction": { status: "Closed", closureStatus: "No Action Needed" },
      "Reassign": { status: "Investigating", closureStatus: null },
    };
    const payload = MAP[action] || {};
    const r = await updateCaseAPI(data.id, payload);
    if (r.success) {
      const updates = { ...payload, ...(r.data || {}) };
      setData(p => ({ ...p, ...updates }));
      onUpdate(data.id, updates);
      if (updates.status === "Closed") {
        setToast(`Case ${data.id} closed as: ${updates.closureStatus}`);
      } else if (action === "Escalate") {
        setToast(`Case ${data.id} escalated to Senior Team`);
      } else if (action === "Reassign") {
        setToast(`Case ${data.id} marked as Investigating`);
      }
    } else {
      setToast(r.error || "Failed to update case");
    }
    setSaving(false);
  }, [data, saving, onUpdate]);

  const handleAssign = useCallback(async (name) => {
    const r = await assignCaseAPI(caseId, name);
    if (!r.success) {
      setToast(r.error || "Failed to assign case");
      return;
    }
    const updates = { assignee: name, ...(r.data?.status ? { status: r.data.status } : {}) };
    setData(p => ({ ...p, ...updates }));
    onUpdate(caseId, updates);
    setShowAssign(false);
    setToast(`Case assigned to ${name}`);
  }, [caseId, onUpdate]);

  const handleCreateTask = useCallback(async () => {
    if (!taskForm.title.trim()) { setTaskError("Task title is required."); return; }
    if (!taskForm.assignTo) { setTaskError("Please assign to someone."); return; }
    if (!taskForm.dueDate) { setTaskError("Due date is required."); return; }
    setTaskError(""); setTaskSaving(true);
    const r = await createTaskAPI(caseId, taskForm);
    if (r.success) { setTasks(p => [...p, r.data]); setTaskForm({ title: "", assignTo: "", description: "", priority: "Medium", dueDate: "" }); setShowTaskForm(false); }
    setTaskSaving(false);
  }, [caseId, taskForm]);

  const d = data?.detail;
  const isClosed = data?.status === "Closed";
  const isUnassigned = !data?.assignee || data.assignee === "Unassigned";

  const handleDownloadReport = useCallback(() => {
    if (data?.detail) downloadCaseReport(data, data.detail);
  }, [data]);

  return (
    <>
      {/* Modal */}
      <div className={`fixed inset-0 ${overlayZ} flex items-center justify-center bg-black/70 backdrop-blur-[3px]`}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="relative flex flex-col bg-[#0b0f1a] border border-[var(--border)] rounded-2xl shadow-2xl"
          style={{ width: "min(820px, 96vw)", height: "min(92vh, 920px)" }}>

          {/* Sticky header */}
          <div className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">Case Investigation</h2>
              <span className="text-[12px] font-mono text-[var(--muted)]">{data?.id}</span>
              {data && <span className={`text-[12px] font-semibold ${RISK_COLOR(data.riskScore)}`}>Risk Score: {data.riskScore}/100</span>}
              <button onClick={onClose} className="ml-auto w-7 h-7 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors">
                <X size={15} />
              </button>
            </div>
            {data && <p className="text-[12px] text-[var(--muted)] mt-0.5">{data.title}</p>}
          </div>

          {/* Scrollable body — GPU-accelerated, no scrollbar shown */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{
              willChange: "transform",
              transform: "translateZ(0)",
              scrollbarWidth: "none",       /* Firefox */
              msOverflowStyle: "none",      /* IE/Edge */
            }}
          >
            {/* Hide webkit scrollbar */}
            <style>{`.scroll-hidden::-webkit-scrollbar{display:none}`}</style>
            <div className="scroll-hidden px-6 py-5 space-y-5">

              {loading ? (
                <div className="flex items-center justify-center py-24 gap-3 text-[var(--muted)]">
                  <CircleNotch size={22} className="animate-spin text-blue-400" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : !d ? (
                <div className="py-10 text-center text-[var(--muted)] text-sm">Details unavailable.</div>
              ) : (<>

                {/* Case Overview */}
                <section>
                  <Sh dot="bg-blue-500" label="Case Overview" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-[var(--border)] bg-white/[0.02]">
                      <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-2">STATUS</p>
                      <StatusBadge status={data.status} />
                    </div>
                    <div className="p-3.5 rounded-xl border border-[var(--border)] bg-white/[0.02]">
                      <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-2">ASSIGNEE</p>
                      <AssigneeChip name={data.assignee} />
                    </div>
                  </div>
                </section>

                {/* AI Analysis */}
                <section>
                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <Robot size={14} weight="fill" className="text-blue-400" />
                        <span className="text-[13px] font-semibold text-[var(--text)]">AI Analysis Summary</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">{d.aiSummary.confidence}% Confidence</span>
                      </div>
                      <button className="px-3 py-1 rounded-md text-white text-[10px] font-bold uppercase tracking-wider transition-colors bg-red-500 hover:bg-red-400">
                        {d.aiSummary.recommendation === "escalate" ? "ESCALATE" : "INVESTIGATE"}
                      </button>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      <p className="text-[12px] text-[var(--text)] leading-relaxed">{d.aiSummary.summary}</p>
                      <div>
                        <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-2">KEY FINDINGS</p>
                        <ul className="space-y-1.5">
                          {d.aiSummary.keyFindings.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--text)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-[var(--border)]">
                        <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">RISK ASSESSMENT</p>
                        <p className="text-[12px] text-[var(--text)]">{d.aiSummary.riskAssessment}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Risk Indicators */}
                <section>
                  <Sh dot="bg-blue-500" label="Risk Indicators" />
                  <div className="grid grid-cols-2 gap-3">
                    {d.riskIndicators.map((r, i) => (
                      <div key={i} className="p-3.5 rounded-xl border border-[var(--border)] bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-semibold text-[var(--text)]">{r.label}</span>
                          <span className={`text-[18px] font-bold ${RISK_COLOR(r.score)}`}>{r.score}</span>
                        </div>
                        {r.bullets.map((b, j) => <p key={j} className="text-[11px] text-[var(--muted)]">• {b}</p>)}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Financial Impact */}
                <section>
                  <Sh dot="bg-blue-500" label="Financial Impact Analysis" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-white/[0.02]">
                      <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">POTENTIAL LOSS</p>
                      <p className="text-xl font-bold text-red-400">${d.financialImpact.potentialLoss.toLocaleString()}</p>
                      <p className="text-[10px] text-[var(--muted)]">USD</p>
                    </div>
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-white/[0.02]">
                      <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">RECOVERY PROBABILITY</p>
                      <p className="text-xl font-bold text-[var(--text)]">{d.financialImpact.recoveryProbability}%</p>
                      <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${d.financialImpact.recoveryProbability}%` }} />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-white/[0.02]">
                      <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">ESTIMATED RECOVERY</p>
                      <p className="text-xl font-bold text-emerald-400">${d.financialImpact.estimatedRecovery.toLocaleString()}</p>
                      <p className="text-[10px] text-[var(--muted)] mt-1">Based on historical recovery rates</p>
                    </div>
                  </div>
                </section>

                {/* Behavioral Patterns */}
                <section>
                  <Sh dot="bg-blue-500" label={`Behavioral Patterns (${d.behavioralPatterns.length})`} />
                  <div className="grid grid-cols-2 gap-3">
                    {d.behavioralPatterns.map((p, i) => (
                      <div key={i} className="p-3.5 rounded-xl border border-[var(--border)] bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] font-semibold text-[var(--text)]">{p.name}</span>
                          <SevBadge sev={p.severity} />
                        </div>
                        <p className="text-[11px] text-[var(--muted)]">Frequency: {p.frequency}</p>
                        <p className="text-[11px] text-[var(--muted)]">Last: {p.last}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Compliance Issues */}
                <section>
                  <Sh dot="bg-red-500" label={`Compliance & Regulatory Issues (${d.complianceIssues.length})`} />
                  <div className="space-y-2">
                    {d.complianceIssues.map((c, i) => (
                      <div key={i} className="p-3.5 rounded-xl border border-[var(--border)] bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold text-[var(--text)]">{c.law}</span>
                          <SevBadge sev={c.severity} />
                        </div>
                        <p className="text-[11px] text-[var(--muted)] mb-1">{c.issue}</p>
                        <p className="text-[11px] text-[var(--muted)]">Potential Penalty: {c.penalty}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Network Analysis */}
                <section>
                  <Sh dot="bg-blue-500" label="Network Analysis"
                    badge={`${d.networkAnalysis.filter(n => n.riskLevel === "high").length} Suspicious Connections`} />
                  <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.03] border-b border-[var(--border)]">
                        <tr>{["ENTITY ID", "TYPE", "RELATIONSHIP", "RISK LEVEL"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {d.networkAnalysis.map((n, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-2.5 text-[11px] font-mono text-[var(--text)]">{n.entityId}</td>
                            <td className="px-4 py-2.5 text-[12px] text-[var(--text)]">{n.type}</td>
                            <td className="px-4 py-2.5 text-[12px] text-[var(--muted)]">{n.relationship}</td>
                            <td className="px-4 py-2.5"><SevBadge sev={n.riskLevel} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Rule Info */}
                <section>
                  <Sh dot="bg-blue-500" label="Rule Information" />
                  <div className="grid grid-cols-4 gap-3">
                    <InfoCell label="RULE NAME" value={d.ruleInfo.ruleName} />
                    <InfoCell label="RULE ID" value={d.ruleInfo.ruleId} mono />
                    <InfoCell label="ENVIRONMENT" value={d.ruleInfo.environment} />
                    <InfoCell label="DETECTION TIME" value={d.ruleInfo.detectionTime} />
                  </div>
                </section>

                {/* Transaction Details */}
                <section>
                  <Sh dot="bg-blue-500" label="Transaction Details" />
                  <div className="grid grid-cols-4 gap-3">
                    <InfoCell label="DOCUMENT NUMBER" value={d.transaction.documentNumber} mono />
                    <InfoCell label="AMOUNT" value={d.transaction.amount} />
                    <InfoCell label="POSTING DATE" value={d.transaction.postingDate} />
                    <InfoCell label="DOCUMENT DATE" value={d.transaction.documentDate} />
                    <InfoCell label="COMPANY CODE" value={d.transaction.companyCode} />
                    <InfoCell label="FISCAL YEAR/PERIOD" value={d.transaction.fiscalYearPeriod} />
                    <InfoCell label="REFERENCE" value={d.transaction.reference} mono />
                    <InfoCell label="HEADER TEXT" value={d.transaction.headerText} cls="col-span-4" />
                  </div>
                </section>

                {/* User Info */}
                <section>
                  <Sh dot="bg-blue-500" label="User Information" />
                  <div className="grid grid-cols-4 gap-3">
                    <InfoCell label="USER ID" value={d.userInfo.userId} mono />
                    <InfoCell label="USER NAME" value={d.userInfo.userName} />
                    <InfoCell label="ROLE" value={d.userInfo.role} />
                    <InfoCell label="DEPARTMENT" value={d.userInfo.department} />
                    <InfoCell label="LOCATION" value={d.userInfo.location} />
                    <InfoCell label="LAST LOGIN" value={d.userInfo.lastLogin} />
                    <InfoCell label="IP ADDRESS" value={d.userInfo.ipAddress} mono />
                  </div>
                </section>

                {/* Customer Details */}
                <section>
                  <Sh dot="bg-blue-500" label="Customer Details" />
                  <div className="grid grid-cols-4 gap-3">
                    <InfoCell label="ID" value={d.customerDetails.id} mono />
                    <InfoCell label="NAME" value={d.customerDetails.name} cls="col-span-2" />
                    <InfoCell label="ACCOUNT GROUP" value={d.customerDetails.accountGroup} />
                    <InfoCell label="COUNTRY" value={d.customerDetails.country} />
                    <InfoCell label="CITY" value={d.customerDetails.city} />
                    <InfoCell label="CREATED DATE" value={d.customerDetails.createdDate} />
                    <InfoCell label="CHANGED DATE" value={d.customerDetails.changedDate} />
                    <InfoCell label="PAYMENT TERMS" value={d.customerDetails.paymentTerms} />
                    <InfoCell label="BANK ACCOUNT" value={d.customerDetails.bankAccount} mono cls="col-span-3" />
                  </div>
                </section>

                {/* Detected Anomalies from SAP OData
                <section>
                  <Sh dot="bg-orange-500" label={`Detected Duplicate Invoices from SAP (${detectedAnomalies.length})`} />
                  {anomaliesLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-[var(--muted)]">
                      <CircleNotch size={16} className="animate-spin text-blue-400" />
                      <span className="text-[12px]">Loading anomalies from SAP...</span>
                    </div>
                  ) : detectedAnomalies.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-[var(--border)] rounded-xl">
                      <Warning size={20} className="text-[var(--muted)] mx-auto mb-2" />
                      <p className="text-[11px] text-[var(--muted)]">No duplicate invoice anomalies detected in SAP.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-white/[0.03] border-b border-[var(--border)]">
                          <tr>{["CASE ID", "VENDOR", "AMOUNT", "CURRENCY", "RISK SCORE", "RISK LEVEL", "MODULE", "DETECTED AT"].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {detectedAnomalies.map((a, i) => {
                            const riskBg = a.riskLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : a.riskLevel === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : a.riskLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400';
                            return (
                              <tr key={i} className="hover:bg-white/[0.02]">
                                <td className="px-4 py-2.5 text-[11px] font-mono text-blue-400">{a.caseId || a.case_id}</td>
                                <td className="px-4 py-2.5 text-[12px] text-[var(--text)]">{a.vendorName || a.vendor_name || 'Unknown'}</td>
                                <td className="px-4 py-2.5 text-[12px] font-semibold text-[var(--text)]">{parseFloat(a.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                                <td className="px-4 py-2.5 text-[11px] text-[var(--muted)]">{a.currency}</td>
                                <td className="px-4 py-2.5 text-[12px] font-bold text-[var(--text)]">{a.riskScore || a.risk_score}/100</td>
                                <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${riskBg} border-opacity-30`}>{a.riskLevel || a.risk_level}</span></td>
                                <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">{a.sapModule || a.sap_module || 'FI'}</span></td>
                                <td className="px-4 py-2.5 text-[11px] text-[var(--muted)]">{new Date(a.detectedAt || a.detected_at).toLocaleDateString()} {new Date(a.detectedAt || a.detected_at).toLocaleTimeString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section> */}

                {/* Legacy Anomaly Indicators (Fallback) */}
                {d.anomalyIndicators && d.anomalyIndicators.length > 0 && (
                  <section>
                    <Sh dot="bg-orange-500" label={`System Alerts (${d.anomalyIndicators.length})`} />
                    <div className="space-y-2">
                      {d.anomalyIndicators.map((a, i) => {
                        const bg = a.severity === "critical" ? "bg-red-500/10 border-red-500/20" : a.severity === "high" ? "bg-orange-500/10 border-orange-500/20" : "bg-amber-500/10 border-amber-500/20";
                        const ic = a.severity === "critical" ? "text-red-400" : a.severity === "high" ? "text-orange-400" : "text-amber-400";
                        return (
                          <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${bg}`}>
                            <Warning size={14} weight="fill" className={`${ic} flex-shrink-0 mt-0.5`} />
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[12px] font-semibold text-[var(--text)]">{a.name}</span>
                                <SevBadge sev={a.severity} />
                              </div>
                              <p className={`text-[11px] ${ic}`}>{a.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Related Transactions */}
                <section>
                  <Sh dot="bg-blue-500" label={`Related Transactions (${d.relatedTransactions.length})`} />
                  <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.03] border-b border-[var(--border)]">
                        <tr>{["DOCUMENT ID", "TYPE", "DATE", "AMOUNT", "STATUS"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {d.relatedTransactions.map((t, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-2.5 text-[11px] font-mono text-blue-400">{t.docId}</td>
                            <td className="px-4 py-2.5 text-[12px] text-[var(--text)]">{t.type}</td>
                            <td className="px-4 py-2.5 text-[12px] text-[var(--muted)]">{t.date}</td>
                            <td className="px-4 py-2.5 text-[12px] font-semibold text-[var(--text)]">{t.amount}</td>
                            <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{t.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Audit Trail */}
                <section>
                  <Sh dot="bg-blue-500" label="Audit Trail" />
                  <div>
                    {d.auditTrail.map((a, i) => (
                      <div key={i} className="flex gap-4 pb-4">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                          {i < d.auditTrail.length - 1 && <div className="w-px flex-1 bg-[var(--border)] mt-1" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-semibold text-[var(--text)]">{a.event}</p>
                            <p className="text-[10px] text-[var(--muted)]">{a.timestamp}</p>
                          </div>
                          <p className="text-[11px] text-[var(--muted)]">By: {a.by}</p>
                          <p className="text-[11px] text-[var(--muted)] mt-0.5">{a.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Attachments */}
                <section>
                  <Sh dot="bg-blue-500" label={`Attachments (${d.attachments.length})`} />
                  <div className="grid grid-cols-2 gap-3">
                    {d.attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0"><FileText size={16} className="text-blue-400" /></div>
                        <div>
                          <p className="text-[12px] font-medium text-[var(--text)]">{a.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-[var(--muted)]">{a.type}</span>
                            <span className="text-[10px] text-[var(--muted)]">{a.size}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Description + Evidence + AI Recs */}
                <section className="space-y-4">
                  <p className="text-[12px] text-[var(--muted)] leading-relaxed p-3.5 rounded-xl border border-[var(--border)] bg-white/[0.015]">{d.description}</p>
                  <div>
                    <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-2">Evidence</p>
                    <div className="space-y-1.5">
                      {d.evidence.map((e, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-[12px] text-[var(--text)]">
                          <FileText size={12} className="text-blue-400 flex-shrink-0" />{e}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-2">AI Recommendations</p>
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-white/[0.015] space-y-2">
                      {d.aiRecommendations.map((r, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-[12px] text-[var(--text)]">
                          <CheckCircle size={13} weight="fill" className="text-teal-400 flex-shrink-0" />{r}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── Mitigation Tasks — form hidden behind "+ Add Task" ─────── */}
                <section>
                  <Sh dot="bg-teal-500" label="Mitigation Tasks"
                    rightEl={
                      <button onClick={() => setShowTaskForm(p => !p)}
                        className="flex items-center gap-1 text-[12px] text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                        <Plus size={13} weight="bold" />+ Add Task
                      </button>
                    }
                  />

                  {/* Task form — only when + Add Task clicked */}
                  {showTaskForm && (
                    <div className="p-4 rounded-xl border border-[var(--border)] bg-white/[0.015] space-y-3 mb-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">TASK TITLE *</label>
                          <input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                            placeholder="e.g., Review vendor bank account"
                            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)]" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">ASSIGN TO *</label>
                          <select value={taskForm.assignTo} onChange={e => setTaskForm(p => ({ ...p, assignTo: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]">
                            <option value="">Select task processor...</option>
                            {TASK_PROCESSORS.map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">DESCRIPTION</label>
                        <textarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                          placeholder="Provide task details..." rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] resize-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">PRIORITY</label>
                          <select value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]">
                            {["Low", "Medium", "High", "Critical"].map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-semibold text-[var(--muted)] uppercase tracking-widest mb-1">DUE DATE *</label>
                          <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]" />
                        </div>
                      </div>
                      {taskError && <p className="text-[11px] text-red-400 flex items-center gap-1"><Warning size={11} />{taskError}</p>}
                      <div className="flex gap-2">
                        <button onClick={handleCreateTask} disabled={taskSaving}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[12px] font-semibold disabled:opacity-50 transition-colors">
                          {taskSaving && <CircleNotch size={11} className="animate-spin" />}Create Task
                        </button>
                        <button onClick={() => { setShowTaskForm(false); setTaskError(""); }}
                          className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--muted)] text-[12px] hover:bg-white/5 transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Task list or empty state */}
                  {tasks.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-[var(--border)] rounded-xl">
                      <CheckCircle size={22} className="text-[var(--muted)] mx-auto mb-2" />
                      <p className="text-[11px] text-[var(--muted)]">No tasks created yet. Click "Add Task" to create mitigation tasks.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-[var(--border)]">
                          <div>
                            <p className="text-[12px] font-semibold text-[var(--text)]">{t.title}</p>
                            <p className="text-[10px] text-[var(--muted)]">{t.assignTo} · {t.priority} · Due: {t.dueDate}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">{t.taskStatus}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

              </>)}
            </div>
          </div>

          {/* ── Sticky footer ────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 px-6 py-3 border-t border-[var(--border)] bg-[#0b0f1a]">

            {/* CASE CLOSED — only show Close */}
            {isClosed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} weight="fill" className="text-emerald-400" />
                  <span className="text-[12px] text-emerald-400 font-semibold">
                    Case closed —
                    <span className="ml-1 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                      {data.closureStatus}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleDownloadReport}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-[12px] font-semibold hover:bg-white/5 transition-colors">
                    <DownloadSimple size={13} /> Download Case Report
                  </button>
                  <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#1e2030] border border-[var(--border)] text-[var(--text)] text-[12px] font-semibold hover:bg-white/5 transition-colors">
                    Close
                  </button>
                </div>
              </div>

            ) : isUnassigned ? (
              /* UNASSIGNED — show Assign to Me + Assign to Analyst */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleAssign("Admin")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--primary)] hover:opacity-90 text-white text-[12px] font-semibold transition-opacity">
                    <UserCircle size={13} /> Assign to Me
                  </button>
                  <button onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-[12px] font-semibold hover:bg-white/5 transition-colors">
                    <UserPlus size={13} /> Assign to Analyst
                  </button>
                </div>
                <button onClick={onClose} className="px-3.5 py-2 rounded-lg bg-[#1e2030] border border-[var(--border)] text-[var(--text)] text-[12px] font-semibold hover:bg-white/5 transition-colors">
                  Close
                </button>
              </div>

            ) : (
              /* NORMAL — full action buttons */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Reassign Case — outline */}
                  <button disabled={saving} onClick={() => handleAction("Reassign")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-[12px] font-semibold hover:bg-white/5 transition-colors disabled:opacity-50">
                    <UserCircle size={13} />Reassign Case
                  </button>
                  {/* Escalate to Senior Team — amber */}
                  <button disabled={saving} onClick={() => handleAction("Escalate")}
                    className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-[12px] font-semibold transition-colors disabled:opacity-50">
                    Escalate to Senior Team
                  </button>
                  {/* Confirmed — red */}
                  <button disabled={saving} onClick={() => handleAction("Confirmed")}
                    className="px-3.5 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-[12px] font-semibold transition-colors disabled:opacity-50">
                    {saving && <CircleNotch size={11} className="animate-spin inline mr-1" />}Confirmed
                  </button>
                  {/* False Positive — dark neutral */}
                  <button disabled={saving} onClick={() => handleAction("FalsePositive")}
                    className="px-3.5 py-2 rounded-lg bg-[#2a2a35] border border-[var(--border)] text-[var(--text)] text-[12px] font-semibold hover:bg-[#333] transition-colors disabled:opacity-50">
                    False Positive
                  </button>
                  {/* No Action Needed — green */}
                  <button disabled={saving} onClick={() => handleAction("NoAction")}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold transition-colors disabled:opacity-50">
                    No Action Needed
                  </button>
                </div>
                <button onClick={onClose} className="px-3.5 py-2 rounded-lg bg-[#1e2030] border border-[var(--border)] text-[var(--text)] text-[12px] font-semibold hover:bg-white/5 transition-colors">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Investigator assign panel */}
      {showAssign && (
        <AssignPanel
          caseId={caseId}
          currentUser="Admin"
          onAssign={handleAssign}
          onClose={() => setShowAssign(false)}
        />
      )}

      {/* In-modal toast (replaces browser alert) */}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CaseManagement() {
  const location = useLocation();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("All Status");
  const [closureF, setClosureF] = useState("All Resolutions");
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [riskConfigs, setRiskConfigs] = useState(() => loadRiskConfigs());

  useEffect(() => {
    // Support navigation from dashboard with pre-set status filter
    if (location.state?.statusFilter) setStatusF(location.state.statusFilter);
    
    // Fetch stored anomalies from database via API endpoint
    setLoading(true);
    fetch(`/sap/anomalies/list/?limit=1000`)
      .then(res => res.json())
      .then(json => {
        if (json.status === 'success' && json.anomalies) {
          // Transform anomalies into case format
          const transformedCases = json.anomalies.map((a, idx) => {
            // Auto-generate Case ID if not present
            const caseId = a.caseId || a.case_id || `C-${8000 + idx}`;
            const amountValue = Number(a.amount?.value ?? a.Amount ?? a.amount ?? 0) || 0;
            const currency = a.amount?.currency || a.Currency || a.currency || "USD";
            const title = `${a.vendorName || a.vendor || 'Unknown Vendor'} - ${amountValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`;
            
            return {
              id: caseId,
              riskScore: a.riskScore || a.risk_score || 0,
              amountValue,
              amountCurrency: currency,
              title,
              ruleName: "Duplicate Invoice Detection",
              ruleId: "RULE-DUPLICATE-INV",
              environment: "PRODUCTION",
              status: a.caseStatus || a.status || "New",
              closureStatus: a.closureStatus || null,
              assignee: a.assignee || "Unassigned",
              createdAt: new Date(a.detectedAt || a.detected_at).toLocaleString(),
              // Keep original anomaly data for detail modal
              _anomaly: a
            };
          });
          setCases(transformedCases);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch anomalies:', err);
        setLoading(false);
      });
  }, []);

  // Listen for risk config changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === RISK_CONFIG_STORAGE_KEY) {
        setRiskConfigs(loadRiskConfigs());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    return (!q || c.id.toLowerCase().includes(q) || c.ruleName.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
      && (statusF === "All Status" || c.status === statusF)
      && (closureF === "All Resolutions" || c.closureStatus === closureF || (closureF === "Pending" && !c.closureStatus));
  });

  const handleUpdate = useCallback((id, updates) => setCases(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)), []);
  const toggleCheck = id => setChecked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allIds = filtered.map(c => c.id);
  const allChecked = allIds.length > 0 && allIds.every(id => checked.has(id));
  const selCls = "px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] cursor-pointer";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <style>{`.no-scroll::-webkit-scrollbar{display:none}`}</style>
          <div className="no-scroll max-w-7xl mx-auto px-2 py-8 space-y-4">

            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-[17px] font-semibold text-[var(--text)]">Detected Anomalies - Duplicate Invoice Investigation</h1>
                <p className="text-[12px] text-[var(--muted)] mt-0.5">Live detected duplicate invoices from SAP OData endpoint</p>
              </div>
              <span className="text-[12px] font-semibold text-[var(--text)] px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)]">{cases.length} Total Anomalies</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by anomaly ID, vendor, or rule..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[13px] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)]" />
              </div>
              <FunnelSimple size={16} className="text-[var(--muted)] flex-shrink-0" />
              <select value={statusF} onChange={e => setStatusF(e.target.value)} className={selCls}>
                <option>All Status</option>
                {["New", "Investigating", "AI Assisted", "Escalated", "Closed"].map(s => <option key={s}>{s}</option>)}
              </select>
              <FunnelSimple size={16} className="text-[var(--muted)] flex-shrink-0" />
              <select value={closureF} onChange={e => setClosureF(e.target.value)} className={selCls}>
                <option>All Resolutions</option>
                {["Confirmed", "False Positive", "No Action", "Pending"].map(s => <option key={s}>{s}</option>)}
              </select>
              <span className="text-[12px] font-semibold text-[var(--text)] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] whitespace-nowrap">{filtered.length} results</span>
            </div>

            {loading ? (
              <div className="rounded-xl border border-[var(--border)] p-12 flex items-center justify-center gap-3 bg-[var(--card)]">
                <CircleNotch size={20} className="animate-spin text-blue-400" />
                <span className="text-sm text-[var(--muted)]">Loading cases...</span>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox" checked={allChecked}
                          onChange={e => setChecked(e.target.checked ? new Set(allIds) : new Set())}
                          className="w-4 h-4 rounded border-gray-600 cursor-pointer accent-[var(--primary)]" />
                      </th>
                      {["CASE ID", "RISK", "TITLE", "RULE", "STATUS", "CLOSURE STATUS", "ASSIGNEE"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-[var(--muted)] text-sm">No cases match your filters.</td></tr>}
                    {filtered.map(c => (
                      (() => {
                        const matchedRiskLevel = resolveRiskLevelByAmount(c.amountValue, riskConfigs);
                        return (
                      <tr key={c.id} onClick={() => setSelected(c.id)}
                        className={`cursor-pointer transition-colors ${checked.has(c.id) ? "bg-[var(--primary)]/5" : "hover:bg-white/[0.025]"}`}>
                        <td className="px-4 py-3.5" onClick={e => { e.stopPropagation(); toggleCheck(c.id); }}>
                          <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggleCheck(c.id)} className="w-4 h-4 rounded border-gray-600 cursor-pointer accent-[var(--primary)]" />
                        </td>
                        <td className="px-4 py-3.5"><span className="text-[12px] font-mono font-medium text-[var(--text)]">{c.id}</span></td>
                        <td className="px-4 py-3.5">
                          {matchedRiskLevel ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${RISK_LEVEL_BADGE[matchedRiskLevel]}`}>
                              {matchedRiskLevel}
                            </span>
                          ) : (
                            <span className={`text-[14px] font-bold ${RISK_COLOR(c.riskScore)}`}>{c.riskScore}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 max-w-[200px]">
                          <p className="text-[13px] font-medium text-[var(--text)] truncate">{c.title}</p>
                          <p className="text-[10px] text-[var(--muted)]">{c.createdAt}</p>
                        </td>
                        <td className="px-4 py-3.5 max-w-[180px]">
                          <p className="text-[12px] font-medium text-[var(--text)] truncate hover:underline">{c.ruleName}</p>
                          <p className="text-[10px] font-mono text-[var(--muted)]">{c.ruleId}</p>
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3.5">{c.closureStatus ? <span className="text-[12px] text-[var(--text)]">{c.closureStatus}</span> : <span className="text-[12px] text-[var(--muted)]">—</span>}</td>
                        <td className="px-4 py-3.5"><AssigneeChip name={c.assignee} /></td>
                      </tr>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && <CaseModal caseId={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} />}
    </div>
  );
}