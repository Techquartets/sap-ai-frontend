import { useMemo, useState } from "react";
import { CaretRight, CircleNotch, X } from "@phosphor-icons/react";
import { CaseModal } from "../../pages/caseManagement";

function ModalShell({ onClose, children, width = "max-w-xl" }) {
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

function normalizeAnomaly(raw, index) {
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
    amount: { currency, value: amountValue },
    riskScore,
    sapModule: raw.sapModule || raw.sap_module || raw.module || "FI",
    detectedAt: raw.detectedAt || raw.detected_at || raw.created_at || raw.timestamp || new Date().toISOString(),
  };
}

function getRiskColor(score) {
  if (score >= 90) return "bg-red-500";
  if (score >= 75) return "bg-orange-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

function getRiskTextColor(score) {
  if (score >= 90) return "text-red-400";
  if (score >= 75) return "text-orange-400";
  if (score >= 50) return "text-yellow-400";
  return "text-green-400";
}

function getModuleBadgeStyle(module) {
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
}

function formatDetectedAt(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
}

export default function DetectedCasesModal({
  anomalies: rawAnomalies = [],
  count,
  source = "simulation",
  loading = false,
  error = null,
  onClose,
}) {
  const [investigationCaseId, setInvestigationCaseId] = useState(null);

  const rows = useMemo(
    () => (Array.isArray(rawAnomalies) ? rawAnomalies.map(normalizeAnomaly) : []),
    [rawAnomalies]
  );
  const displayCount = rows.length || Number(count) || 0;

  const subtitle = source === "schedule"
    ? `${displayCount} cases detected from scheduled rule run`
    : `${displayCount} cases detected in simulation`;

  const emptyMessage = source === "schedule"
    ? "No detected cases found for this scheduled run."
    : "No anomalies detected for this rule and simulation.";

  const handleClose = () => {
    setInvestigationCaseId(null);
    onClose();
  };

  const openCaseInvestigation = (caseId) => {
    if (!caseId || caseId === "N/A") return;
    setInvestigationCaseId(caseId);
  };

  return (
    <>
      <ModalShell onClose={handleClose} width="max-w-6xl">
        <div className="px-8 pt-6 pb-4 border-b border-white/10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[var(--text)]">Detected Fraud Cases</h2>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                Vendor Manipulation
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-2">{subtitle}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-white/5 transition-colors">
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
              <p className="text-[var(--muted)] text-sm">{emptyMessage}</p>
            </div>
          )}

          {!loading && rows.length === 0 && error && (
            <div className="text-center py-12">
              <p className="text-sm font-semibold text-red-400">Error Loading Anomalies</p>
              <p className="text-xs text-red-400/75 mt-1">{error}</p>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <table className="w-full text-sm min-w-[1180px]">
              <thead className="bg-[var(--bg)]">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest w-8" />
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
                {rows.map((anom) => (
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
                          <div
                            className={`h-full rounded-full ${getRiskColor(anom.riskScore)}`}
                            style={{ width: `${Math.min(Math.max(Number(anom.riskScore) || 0, 0), 100)}%` }}
                          />
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
            onClick={handleClose}
            className="px-6 py-2.5 rounded-lg bg-slate-700/40 hover:bg-slate-700/60 text-[var(--text)] text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </ModalShell>

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
