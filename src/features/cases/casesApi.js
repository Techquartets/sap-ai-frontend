/**
 * casesAPI.js — Complete mock backend.
 * Replace delay()+return with real fetch() when backend is ready.
 *
 * Endpoints:
 *   GET  /api/cases
 *   GET  /api/cases/:id
 *   PATCH /api/cases/:id
 *   POST  /api/cases/:id/tasks
 *   GET  /api/dashboard/stats          ← transactions, anomaly flags, all analytics
 *   GET  /api/investigators            ← real-time investigator list
 */

import apiClient from '../../services/apiClient';
import { fetchUsersAPI } from '../security/securityAPI';

const delay = (ms = 350) => new Promise(r => setTimeout(r, ms));

// ─── Investigators (from SecurityUser records) ───────────────────────────────
export const fetchInvestigatorsAPI = async () => {
  try {
    const users = await fetchUsersAPI();
    const investigators = (users || [])
      .filter((u) => u.status === "Active" && !u.is_locked)
      .filter((u) => ["Investigator", "Analyst", "Admin", "Manager"].includes(u.role))
      .map((u) => ({
        id: u.id,
        name: u.name,
        title: u.role,
        avatar: u.name
          ? u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
          : "??",
        available: true,
      }));

    return { success: true, data: investigators };
  } catch (error) {
    console.error("fetchInvestigatorsAPI error:", error);
    return { success: false, data: [], error: error.message };
  }
};

// ─── Seed Cases ───────────────────────────────────────────────────────────────
export const SEED_CASES = JSON.parse(localStorage.getItem("cases")) || [
  { id:"C-8914", riskScore:96, title:"High-value fraud pattern",     ruleName:"High-value fraud pattern",   ruleId:"RULE-454", environment:"STAGING",     status:"Escalated",     closureStatus:null,            assignee:"Senior Team", createdAt:"3/28/2026, 11:43:51 PM" },
  { id:"C-8921", riskScore:94, title:"Large invoice anomaly",         ruleName:"Large invoice anomaly",      ruleId:"RULE-451", environment:"DEVELOPMENT", status:"New",           closureStatus:null,            assignee:"Unassigned",  createdAt:"3/28/2026, 10:12:00 AM" },
  { id:"C-8918", riskScore:92, title:"After-hours transaction",        ruleName:"After-hours transaction",    ruleId:"RULE-637", environment:"PRODUCTION",  status:"Investigating", closureStatus:null,            assignee:"J. Smith",    createdAt:"3/27/2026, 9:30:00 PM"  },
  { id:"C-8916", riskScore:89, title:"Cross-module correlation",       ruleName:"Cross-module correlation",   ruleId:"RULE-828", environment:"PRODUCTION",  status:"AI Assisted",   closureStatus:null,            assignee:"L. Davis",    createdAt:"3/27/2026, 3:45:00 PM"  },
  { id:"C-8920", riskScore:87, title:"Duplicate vendor entry",         ruleName:"Duplicate vendor entry",     ruleId:"RULE-637", environment:"STAGING",     status:"New",           closureStatus:null,            assignee:"Unassigned",  createdAt:"3/27/2026, 11:00:00 AM" },
  { id:"C-8915", riskScore:82, title:"Vendor master change",           ruleName:"Vendor master change",       ruleId:"RULE-815", environment:"DEVELOPMENT", status:"AI Assisted",   closureStatus:null,            assignee:"AI Agent",    createdAt:"3/26/2026, 8:20:00 PM"  },
  { id:"C-8919", riskScore:76, title:"Approval bypass detected",       ruleName:"Approval bypass detected",   ruleId:"RULE-799", environment:"DEVELOPMENT", status:"New",           closureStatus:null,            assignee:"Unassigned",  createdAt:"3/26/2026, 2:15:00 PM"  },
  { id:"C-8913", riskScore:71, title:"Invoice timing issue",           ruleName:"Invoice timing issue",       ruleId:"RULE-189", environment:"PRODUCTION",  status:"Closed",        closureStatus:"Confirmed",     assignee:"J. Smith",    createdAt:"3/25/2026, 5:00:00 PM"  },
  { id:"C-8917", riskScore:68, title:"Payroll anomaly",                ruleName:"Payroll anomaly",            ruleId:"RULE-838", environment:"STAGING",     status:"Investigating", closureStatus:null,            assignee:"M. Johnson",  createdAt:"3/25/2026, 10:30:00 AM" },
  { id:"C-8912", riskScore:64, title:"Data entry error",               ruleName:"Data entry error",           ruleId:"RULE-866", environment:"PRODUCTION",  status:"Closed",        closureStatus:"False Positive", assignee:"M. Johnson",  createdAt:"3/24/2026, 4:00:00 PM"  },
];

const saveCases = () => {
  localStorage.setItem("cases", JSON.stringify(SEED_CASES));
};

// ─── Rich detail for C-8914 ───────────────────────────────────────────────────
const DETAIL_8914 = {
  aiSummary:{
    confidence:92, recommendation:"escalate",
    summary:"HIGH RISK: This case exhibits multiple fraud indicators requiring immediate attention. The transaction patterns and behavioral anomalies suggest potential fraudulent activity with 92% confidence.",
    keyFindings:[
      "Transaction amount of 50,564 USD is 50% above baseline",
      "User USER2605 has 7 similar high-value transactions in the past 30 days",
      "Transaction occurred during off-hours (23:00), violating procedures",
      "Vendor bank account was modified 29 days ago",
      "Cross-reference analysis found 2 related suspicious transactions",
    ],
    riskAssessment:"Critical fraud risk - immediate escalation recommended. Pattern analysis indicates deliberate manipulation of controls.",
  },
  riskIndicators:[
    { label:"Financial Risk",    score:91,  bullets:["Transaction value: $50,564 (50% above average)","Historical pattern shows increasing transaction values"] },
    { label:"Compliance Risk",   score:94,  bullets:["SOX compliance: Segregation of duties violation detected","FCPA concern: Transaction to high-risk jurisdiction"] },
    { label:"Behavioral Risk",   score:90,  bullets:["User USER2605 has 7 similar transactions in past 30 days","After-hours transaction activity detected"] },
    { label:"Reputational Risk", score:100, bullets:["High-profile vendor with media scrutiny","Vendor associated with previous compliance investigations"] },
  ],
  financialImpact:{ potentialLoss:50564, recoveryProbability:25, estimatedRecovery:12641 },
  behavioralPatterns:[
    { name:"High-Value Transaction Clustering", severity:"high",   frequency:"9 occurrences in 30 days",  last:"3/24/2026, 9:38:08 PM"  },
    { name:"Off-Hours Activity",                severity:"high",   frequency:"3 occurrences in 30 days",  last:"3/18/2026, 11:43:56 PM" },
    { name:"Approval Workflow Deviation",        severity:"medium", frequency:"3 occurrences in 90 days",  last:"3/17/2026, 12:45:58 AM" },
  ],
  complianceIssues:[
    { law:"Sarbanes-Oxley Act (SOX)",             issue:"Inadequate internal controls",                    severity:"critical", penalty:"Regulatory investigation, potential fines up to $5M" },
    { law:"Foreign Corrupt Practices Act (FCPA)", issue:"Insufficient due diligence on third-party payments", severity:"high", penalty:"DOJ investigation, penalties up to $2M per violation" },
    { law:"Internal Audit Policy",                issue:"Approval threshold bypass",                       severity:"high",     penalty:"Internal sanctions, process remediation required" },
    { law:"Corporate Code of Conduct",            issue:"Potential policy deviation",                      severity:"medium",   penalty:"Management review and corrective action" },
  ],
  networkAnalysis:[
    { entityId:"Employee-534", type:"Employee", relationship:"Primary",              riskLevel:"high"   },
    { entityId:"USER2605",     type:"User",     relationship:"Transaction Creator",  riskLevel:"high"   },
    { entityId:"Vendor-7923",  type:"Vendor",   relationship:"Shared bank account",  riskLevel:"high"   },
    { entityId:"USER3139",     type:"User",     relationship:"Frequent collaborator", riskLevel:"medium" },
  ],
  ruleInfo:{ ruleName:"High-value fraud pattern", ruleId:"RULE-454", environment:"STAGING", detectionTime:"3/28/2026, 8:30:47 PM" },
  transaction:{ documentNumber:"MM663396", amount:"50,564 USD", postingDate:"2026-03-28", documentDate:"2026-03-18", companyCode:"1000", fiscalYearPeriod:"2024 / 03", reference:"REF-102939", headerText:"MM Transaction - Employee-534" },
  userInfo:{ userId:"USER2605", userName:"Lisa Anderson", role:"Accountant", department:"Sales", location:"Singapore", lastLogin:"3/22/2026, 8:55:44 PM", ipAddress:"192.168.242.113" },
  customerDetails:{ id:"Employee-534", name:"Industrial Parts GmbH", accountGroup:"DEBT", country:"Singapore", city:"Amsterdam", createdDate:"2020-01-06", changedDate:"2026-03-18", paymentTerms:"Net 30 days", bankAccount:"DE8964791867059433" },
  anomalyIndicators:[
    { name:"High Value Transaction", severity:"critical", desc:"Transaction amount (50,564 USD) exceeds threshold" },
    { name:"After-Hours Activity",   severity:"high",     desc:"Transaction posted outside normal business hours" },
    { name:"Vendor Master Change",   severity:"medium",   desc:"Vendor bank details modified within last 30 days" },
  ],
  relatedTransactions:[
    { docId:"MM915947", type:"Invoice",     date:"2026-03-15", amount:"$111,190", status:"Posted"  },
    { docId:"MM234032", type:"Payment",     date:"2026-02-04", amount:"$29,317",  status:"Cleared" },
    { docId:"MM780377", type:"Credit Memo", date:"2026-02-28", amount:"$10,795",  status:"Posted"  },
  ],
  auditTrail:[
    { event:"Case Created",      timestamp:"3/28/2026, 11:43:51 PM", by:"System",   desc:"Case created by automated fraud detection system" },
    { event:"Transaction Posted",timestamp:"3/18/2026, 11:43:56 PM", by:"USER2605", desc:"Document MM663396 posted with amount 50,564 USD" },
    { event:"Document Created",  timestamp:"3/18/2026, 11:42:56 PM", by:"USER2605", desc:"Document MM663396 created in MM module" },
    { event:"Case Assigned",     timestamp:"3/28/2026, 5:19:56 PM",  by:"System",   desc:"Case assigned to Senior Team" },
  ],
  attachments:[
    { name:"MM663396_Invoice.pdf",         type:"PDF", size:"1496 KB" },
    { name:"MM663396_Approval.pdf",        type:"PDF", size:"479 KB"  },
    { name:"MM663396_Supporting_Docs.zip", type:"ZIP", size:"4553 KB" },
  ],
  description:"This case was automatically generated by fraud detection rules. The system identified anomalous patterns in transaction processing that require analyst investigation. The case involves Employee-534 with transaction amount of $50,564.",
  evidence:[
    "Rule triggered on 3/28/2026, 11:43:56 PM",
    "Risk score calculated: 96/100",
    "SAP Module: MM",
    "Transaction value exceeds defined threshold",
    "After-hours activity detected",
  ],
  aiRecommendations:[
    "Review transaction details and supporting documentation",
    "Verify vendor/customer master data",
    "Check approval workflow compliance",
    "Compare with historical transaction patterns",
    "Escalate immediately if fraud pattern confirmed",
  ],
};

function buildGenericDetail(c) {
  // Slightly varied data based on case riskScore so each case looks different
  const s = c.riskScore;
  const confMap  = { "Escalated":"escalate","Investigating":"investigate","New":"investigate","AI Assisted":"investigate","Closed":"monitor" };
  const userNums = Math.floor(s * 0.07);
  const txAmt    = Math.floor(s * 523 + Math.random() * 10000);
  const riskDesc = s >= 90 ? "HIGH RISK" : s >= 75 ? "MEDIUM-HIGH RISK" : "MEDIUM RISK";
  return {
    ...DETAIL_8914,
    aiSummary:{
      ...DETAIL_8914.aiSummary,
      confidence: Math.max(60, s - 4),
      recommendation: confMap[c.status] || "investigate",
      summary: `${riskDesc}: Suspicious patterns detected that warrant thorough investigation. Several anomalies identified across transaction behavior and approval workflows.`,
      keyFindings:[
        `Transaction amount of ${txAmt.toLocaleString()} USD is ${Math.floor(s * 4)}% above baseline`,
        `User USER${Math.floor(s * 34)} has ${userNums} similar high-value transactions in the past 30 days`,
        "Transaction occurred during off-hours (23:00), violating procedures",
        `Vendor bank account was modified ${Math.floor(s * 0.3)} days ago`,
        "Cross-reference analysis found 2 related suspicious transactions",
      ],
      riskAssessment: s >= 90
        ? "Critical fraud risk - immediate escalation recommended. Pattern analysis indicates deliberate manipulation of controls."
        : "Significant fraud risk - comprehensive investigation required. Multiple indicators suggest potential policy violations.",
    },
    ruleInfo:{ ruleName:c.ruleName, ruleId:c.ruleId, environment:c.environment, detectionTime:c.createdAt },
    financialImpact:{
      potentialLoss:    txAmt,
      recoveryProbability: Math.floor(100 - s * 0.5),
      estimatedRecovery:   Math.floor(txAmt * 0.5),
    },
    description: `This case was automatically generated by fraud detection rules. The system identified anomalous patterns for ${c.ruleName} requiring analyst investigation.`,
    riskIndicators:[
      { label:"Financial Risk",    score:Math.min(100, s - 7), bullets:[`Transaction value: $${txAmt.toLocaleString()} (${Math.floor(s*4)}% above average)`,`Transaction consistent with recent patterns`] },
      { label:"Compliance Risk",   score:Math.min(100, s + 1), bullets:["SOX compliance: Segregation of duties violation detected","FCPA concern: Transaction to high-risk jurisdiction"] },
      { label:"Behavioral Risk",   score:Math.min(100, s + 1), bullets:[`User USER${Math.floor(s*34)} has ${userNums + 4} similar transactions in past 30 days`,"After-hours transaction activity detected"] },
      { label:"Reputational Risk", score:Math.min(100, s),     bullets:["Standard vendor relationship","Vendor associated with previous compliance investigations"] },
    ],
  };
}

// ─── Dashboard mock stats ─────────────────────────────────────────────────────
// All numbers come from "backend" — front-end does zero hardcoding
// const PREV_MONTH_TRANSACTIONS = 1_070_000;
// const CURR_MONTH_TRANSACTIONS = 1_200_000;

// const PREV_MONTH_ANOMALY_FLAGS = 575;
// const CURR_MONTH_ANOMALY_FLAGS = 527;

// export const fetchDashboardStatsAPI = async () => {
//   await delay(300);

//   const txChangeRaw = ((CURR_MONTH_TRANSACTIONS - PREV_MONTH_TRANSACTIONS) / PREV_MONTH_TRANSACTIONS) * 100;
//   const anomalyChangeRaw = ((CURR_MONTH_ANOMALY_FLAGS - PREV_MONTH_ANOMALY_FLAGS) / PREV_MONTH_ANOMALY_FLAGS) * 100;

//   return {
//     success: true,
//     data: {
//       transactions: {
//         current:       CURR_MONTH_TRANSACTIONS,
//         previous:      PREV_MONTH_TRANSACTIONS,
//         displayValue:  "1.2M",
//         changePercent: parseFloat(txChangeRaw.toFixed(1)),   // +12.1%
//         trend:         txChangeRaw >= 0 ? "up" : "down",
//       },
//       anomalyFlags: {
//         current:       CURR_MONTH_ANOMALY_FLAGS,
//         previous:      PREV_MONTH_ANOMALY_FLAGS,
//         displayValue:  String(CURR_MONTH_ANOMALY_FLAGS),
//         changePercent: parseFloat(anomalyChangeRaw.toFixed(1)), // -8.3%
//         trend:         anomalyChangeRaw >= 0 ? "up" : "down",
//       },
//       anomalyTrend: [
//         { label:"Jan", detected:42, baseline:28 },
//         { label:"Feb", detected:48, baseline:31 },
//         { label:"Mar", detected:55, baseline:36 },
//         { label:"Apr", detected:70, baseline:45 },
//         { label:"May", detected:78, baseline:49 },
//         { label:"Jun", detected:58, baseline:38 },
//       ],
//       sapPerformance: [
//         { time:"00:00", throughput:20, latency:18 },
//         { time:"04:00", throughput:22, latency:17 },
//         { time:"08:00", throughput:48, latency:40 },
//         { time:"12:00", throughput:65, latency:52 },
//         { time:"16:00", throughput:55, latency:48 },
//         { time:"20:00", throughput:30, latency:25 },
//       ],
//       topRules: [
//         { name:"Duplicate Vendor Detection",  detections:89,  module:"MM",    trend:"up"   },
//         { name:"Invoice Amount Anomaly",       detections:156, module:"FI",    trend:"down" },
//         { name:"Cross-module Correlation",     detections:134, module:"Multi", trend:"up"   },
//         { name:"After-hours Transaction",      detections:67,  module:"SD",    trend:"flat" },
//         { name:"Approval Bypass Pattern",      detections:23,  module:"FI",    trend:"down" },
//       ],
//     },
//   };
// };

// ─── Case APIs ─────────────────────────────────────────────────────────────────
export const fetchCasesAPI = async () => { await delay(350); return { success:true, data:SEED_CASES }; };

export const fetchAnomaliesListAPI = async ({ ruleId, limit = 1000 } = {}) => {
  const params = new URLSearchParams();
  params.append("limit", String(limit));
  if (ruleId) params.append("rule_id", ruleId);
  const response = await apiClient.get(`/sap/anomalies/list/?${params.toString()}`);
  return response.data;
};

export const generateCasesFromRuleAPI = async (ruleId, extraParams = {}) => {
  const params = new URLSearchParams();
  params.append("rule_id", ruleId);
  params.append("persist", "1");
  params.append("limit", "1000");
  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, value);
    }
  });
  const response = await apiClient.get(`/sap/anomalies/detected/?${params.toString()}`, {
    timeout: 90000,
  });
  return response.data;
};

export const fetchCaseDetailAPI = async (id) => {
  try {
    const response = await apiClient.get(
      `/sap/cases/${encodeURIComponent(id)}/`
    );

    const apiData = response.data;

    if (apiData?.status !== "success") {
      return {
        success: false,
        error: "Case detail not found",
      };
    }

    const c = apiData.data;
    const transformedCase = buildCaseDetailFromApi(c);

    // SAFE FALLBACKS
    const d = transformedCase.detail;

    d.aiSummary = d.aiSummary || {
      confidence: 0,
      recommendation: "investigate",
      summary: "",
      keyFindings: [],
      riskAssessment: "",
    };

    d.financialImpact = d.financialImpact || {
      potentialLoss: 0,
      recoveryProbability: 0,
      estimatedRecovery: 0,
    };
    d.ruleInfo = d.ruleInfo || {
      ruleName: "",
      ruleId: "",
      environment: "",
      detectionTime: "",
    };
    d.userInfo = d.userInfo || {
      userId: "",
      userName: "",
      role: "",
      department: "",
      location: "",
      lastLogin: "",
      ipAddress: "",
    };

    d.riskIndicators = d.riskIndicators || [];
    d.behavioralPatterns = d.behavioralPatterns || [];
    d.complianceIssues = d.complianceIssues || [];
    d.networkAnalysis = d.networkAnalysis || [];
    d.anomalyIndicators = d.anomalyIndicators || [];
    d.relatedTransactions = d.relatedTransactions || [];
    d.auditTrail = d.auditTrail || [];
    d.attachments = d.attachments || [];
    d.aiRecommendations = d.aiRecommendations || [];
    d.evidence = d.evidence || [];
    d.sapFields = d.sapFields || [];
    d.transactionFields = d.transactionFields || [];

    return {
      success: true,
      data: transformedCase,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.response?.data?.message || error.message || "Failed to load case",
    };
  }
};

/** Humanize SAP field names: PurchaseOrder → Purchase Order */
function labelize(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function pickRaw(raw, keys, fallback = null) {
  if (!raw || typeof raw !== "object") return fallback;
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function formatAmount(c) {
  const value = c.amount?.value ?? c.amount ?? 0;
  const currency = c.amount?.currency || c.currency || "";
  return `${value} ${currency}`.trim();
}

function resolveCurrency(c, raw = {}) {
  return (
    c.amount?.currency ||
    c.currency ||
    pickRaw(raw, ["Currency", "DocumentCurrency", "waers"], "INR")
  );
}

/** Prefer real SAP dates when stored detectedAt is epoch garbage (1970). */
function resolveDisplayTimestamp(c, raw = {}) {
  const stored = c.detectedAt || c.detected_at || null;
  const looksBad =
    !stored ||
    String(stored).startsWith("1970-") ||
    String(stored).startsWith("1969-");

  if (!looksBad) return stored;

  const fromRaw = pickRaw(raw, [
    "ReleaseDate",
    "PODate",
    "LastChangedDate",
    "DocumentDate",
    "PostingDate",
    "OriginalDocumentDate",
  ]);
  if (fromRaw) {
    // Date-only SAP fields → ISO-ish display
    const text = String(fromRaw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00`;
    return text;
  }
  return stored || "N/A";
}

function detectCaseKind(raw) {
  if (!raw || typeof raw !== "object") return "generic";
  if (raw.OriginalInvoiceDoc || raw.DuplicateInvoiceDoc) return "duplicate_invoice";
  if (raw.PurchaseOrder && (raw.CreatedBy || raw.ReleasedBy)) return "po_creator_approver";
  if (raw.PurchaseOrder || raw.POLineItem) return "purchase_order";
  return "generic";
}

/**
 * Build case investigation detail from backend /sap/cases/:id payload.
 * Narratives and field lists follow the OData `raw` shape — not a fixed duplicate-invoice template.
 */
export function buildCaseDetailFromApi(c) {
  const raw = c.raw && typeof c.raw === "object" ? c.raw : {};
  const kind = detectCaseKind(raw);
  const riskLevel = (c.riskLevel || "MEDIUM").toUpperCase();
  const sev = riskLevel.toLowerCase();
  const amountStr = formatAmount(c);
  const currency = resolveCurrency(c, raw);
  const displayAt = resolveDisplayTimestamp(c, raw);
  const ruleName = c.ruleName || "SAP Detection Rule";
  const ruleId = c.ruleId || "";
  const document =
    c.document ||
    pickRaw(raw, ["PurchaseOrder", "OriginalInvoiceDoc", "AccountingDocument", "DocumentNumber"], c.caseId);
  const vendorName = c.vendor || c.vendorName || pickRaw(raw, ["VendorName", "SupplierName"], "Unknown");
  const vendorCode = c.vendorCode || pickRaw(raw, ["Vendor", "VendorCode", "Supplier"], "");

  // Prefer important SAP keys first, then remaining raw keys
  const preferredOrder = [
    "PurchaseOrder",
    "POLineItem",
    "ChangeDocNumber",
    "CreatedBy",
    "ReleasedBy",
    "ReleaseDate",
    "ReleaseTime",
    "ReleaseTCode",
    "ReleaseStatus",
    "ReleaseIndicator",
    "SoDCriticality",
    "Vendor",
    "VendorName",
    "NetValue",
    "Currency",
    "PODate",
    "CompanyCode",
    "PurchasingOrg",
    "PurchasingGroup",
    "Material",
    "MaterialDescription",
    "Quantity",
    "Plant",
    "OriginalInvoiceDoc",
    "DuplicateInvoiceDoc",
    "OriginalDocumentDate",
    "DuplicateDocumentDate",
  ];
  const seen = new Set();
  const sapFields = [];
  for (const key of [...preferredOrder, ...Object.keys(raw)]) {
    if (seen.has(key) || !(key in raw)) continue;
    seen.add(key);
    const value = raw[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") continue;
    sapFields.push({ key, label: labelize(key), value: String(value) });
  }

  let summary;
  let keyFindings;
  let riskAssessment;
  let patternName;
  let complianceIssue;
  let alertName;
  let alertDesc;
  let recommendations;
  let auditDesc;
  let relatedTransactions;
  let networkAnalysis;
  let transactionFields;

  if (kind === "po_creator_approver" || kind === "purchase_order") {
    const po = pickRaw(raw, ["PurchaseOrder"], document);
    const createdBy = pickRaw(raw, ["CreatedBy"], "N/A");
    const releasedBy = pickRaw(raw, ["ReleasedBy"], "N/A");
    const sameUser = createdBy !== "N/A" && createdBy === releasedBy;

    summary = sameUser
      ? `Segregation of duties risk: purchase order ${po} was created and released by the same user (${createdBy}).`
      : `Purchase order ${po} flagged by rule ${ruleName}. Created by ${createdBy}, released by ${releasedBy}.`;

    keyFindings = [
      `Purchase Order: ${po}`,
      `Created By: ${createdBy}`,
      `Released By: ${releasedBy}`,
      `Vendor: ${vendorName}${vendorCode ? ` (${vendorCode})` : ""}`,
      `Amount: ${amountStr}`,
      `Release TCode: ${pickRaw(raw, ["ReleaseTCode"], "N/A")}`,
      `SoD Criticality: ${pickRaw(raw, ["SoDCriticality"], "N/A")}`,
    ];

    riskAssessment = sameUser
      ? "High probability SoD violation — creator and approver are the same user."
      : riskLevel === "HIGH" || riskLevel === "CRITICAL"
        ? "Elevated risk on PO release workflow; investigator review recommended."
        : "Requires investigator review of PO creator/approver controls.";

    patternName = "Same Creator and Approver";
    complianceIssue = "Potential segregation of duties (SoD) violation on PO create/release";
    alertName = "PO Creator / Approver Conflict";
    alertDesc = `PO ${po}: CreatedBy=${createdBy}, ReleasedBy=${releasedBy}`;
    recommendations = [
      "Verify creator and approver are different users",
      "Review release strategy and SoD configuration",
      "Validate PO value and vendor",
      "Check change documents for ME29N / release history",
    ];
    auditDesc = `Automatic detection triggered for rule ${ruleName}`;

    relatedTransactions = [
      {
        docId: po,
        type: "Purchase Order",
        date: pickRaw(raw, ["PODate", "ReleaseDate", "LastChangedDate"], "N/A"),
        amount: amountStr,
        status: pickRaw(raw, ["ReleaseStatus", "ReleaseIndicator"], "N/A"),
      },
      {
        docId: pickRaw(raw, ["ChangeDocNumber", "POLineItem"], "N/A"),
        type: pickRaw(raw, ["ChangeDocNumber"]) ? "Change Document" : "PO Line Item",
        date: pickRaw(raw, ["ReleaseDate", "LastChangedDate"], "N/A"),
        amount: amountStr,
        status: pickRaw(raw, ["ReleaseStatusAfter", "ReleaseStatus"], "N/A"),
      },
    ];

    networkAnalysis = [
      {
        entityId: createdBy,
        type: "SAP User",
        relationship: "PO Creator",
        riskLevel: sev,
      },
      {
        entityId: releasedBy,
        type: "SAP User",
        relationship: "PO Approver / Releaser",
        riskLevel: sev,
      },
      {
        entityId: vendorName,
        type: "Vendor",
        relationship: "PO Vendor",
        riskLevel: sev,
      },
    ];

    transactionFields = [
      { label: "Purchase Order", value: po, mono: true },
      { label: "PO Line Item", value: pickRaw(raw, ["POLineItem"], "N/A"), mono: true },
      { label: "Amount", value: amountStr },
      { label: "Currency", value: pickRaw(raw, ["Currency"], c.amount?.currency || "N/A") },
      { label: "PO Date", value: pickRaw(raw, ["PODate"], "N/A") },
      { label: "Release Date", value: pickRaw(raw, ["ReleaseDate"], "N/A") },
      { label: "Company Code", value: pickRaw(raw, ["CompanyCode"], "N/A") },
      { label: "Created By", value: createdBy, mono: true },
      { label: "Released By", value: releasedBy, mono: true },
      { label: "Release TCode", value: pickRaw(raw, ["ReleaseTCode"], "N/A"), mono: true },
      { label: "Plant", value: pickRaw(raw, ["Plant"], "N/A") },
      { label: "Material", value: pickRaw(raw, ["Material", "MaterialDescription"], "N/A") },
    ];
  } else if (kind === "duplicate_invoice") {
    const original = pickRaw(raw, ["OriginalInvoiceDoc"], "N/A");
    const duplicate = pickRaw(raw, ["DuplicateInvoiceDoc"], "N/A");

    summary =
      "Potential duplicate invoice detected based on invoice comparison and vendor validation.";
    keyFindings = [
      `Original Invoice: ${original}`,
      `Duplicate Invoice: ${duplicate}`,
      `Vendor: ${vendorName}`,
      `Amount: ${amountStr}`,
    ];
    riskAssessment =
      riskLevel === "HIGH" || riskLevel === "CRITICAL"
        ? "High probability duplicate invoice fraud."
        : "Requires investigator review.";
    patternName = "Duplicate Invoice Submission";
    complianceIssue = "Potential duplicate invoice payment";
    alertName = "Duplicate Invoice";
    alertDesc = `Duplicate invoice detected between ${original} and ${duplicate}`;
    recommendations = [
      "Review duplicate invoices",
      "Validate vendor payments",
      "Check approval workflow",
      "Verify posting dates",
    ];
    auditDesc = "Automatic duplicate invoice detection triggered";
    relatedTransactions = [
      {
        docId: original,
        type: "Original Invoice",
        date: pickRaw(raw, ["OriginalDocumentDate"], "N/A"),
        amount: amountStr,
        status: pickRaw(raw, ["OriginalStatus"], "N/A"),
      },
      {
        docId: duplicate,
        type: "Duplicate Invoice",
        date: pickRaw(raw, ["DuplicateDocumentDate"], "N/A"),
        amount: amountStr,
        status: pickRaw(raw, ["DuplicateStatus"], "N/A"),
      },
    ];
    networkAnalysis = [
      {
        entityId: vendorName,
        type: "Vendor",
        relationship: "Invoice Creator",
        riskLevel: sev,
      },
    ];
    transactionFields = [
      { label: "Document Number", value: document, mono: true },
      { label: "Amount", value: amountStr },
      { label: "Posting Date", value: pickRaw(raw, ["OriginalPostingDate", "PostingDate"], "N/A") },
      { label: "Document Date", value: pickRaw(raw, ["OriginalDocumentDate", "DocumentDate"], "N/A") },
      { label: "Company Code", value: pickRaw(raw, ["CompanyCode"], "N/A") },
      { label: "Fiscal Year/Period", value: pickRaw(raw, ["FiscalYear"], "N/A") },
      { label: "Reference", value: c.transactionId || "N/A", mono: true },
      { label: "Header Text", value: pickRaw(raw, ["OriginalHeaderText", "HeaderText"], "—") },
    ];
  } else {
    summary = `Anomaly detected by rule ${ruleName} for document ${document}.`;
    keyFindings = sapFields.slice(0, 8).map((f) => `${f.label}: ${f.value}`);
    if (!keyFindings.length) {
      keyFindings = [
        `Document: ${document}`,
        `Vendor: ${vendorName}`,
        `Amount: ${amountStr}`,
        `Risk Level: ${riskLevel}`,
      ];
    }
    riskAssessment = "Requires investigator review of SAP source fields.";
    patternName = "SAP Rule Detection";
    complianceIssue = `Flagged by ${ruleName}`;
    alertName = ruleName;
    alertDesc = `Document ${document} matched detection rule ${ruleId || ruleName}`;
    recommendations = [
      "Review SAP source fields",
      "Validate business partner and amount",
      "Confirm rule thresholds and parameters",
      "Check related change documents",
    ];
    auditDesc = `Automatic detection triggered for rule ${ruleName}`;
    relatedTransactions = [
      {
        docId: document,
        type: "SAP Document",
        date: pickRaw(raw, ["PODate", "DocumentDate", "PostingDate", "ReleaseDate"], "N/A"),
        amount: amountStr,
        status: riskLevel,
      },
    ];
    networkAnalysis = [
      {
        entityId: vendorName,
        type: "Vendor",
        relationship: "Related Party",
        riskLevel: sev,
      },
    ];
    transactionFields = [
      { label: "Document Number", value: document, mono: true },
      { label: "Amount", value: amountStr },
      { label: "Company Code", value: pickRaw(raw, ["CompanyCode"], "N/A") },
      { label: "Reference", value: c.transactionId || "N/A", mono: true },
      ...sapFields.slice(0, 8).map((f) => ({ label: f.label, value: f.value, mono: false })),
    ];
  }

  // Backward-compatible transaction object (legacy UI keys)
  const transaction = {
    documentNumber: document,
    amount: amountStr,
    postingDate: pickRaw(raw, ["ReleaseDate", "PostingDate", "OriginalPostingDate", "PODate"], "N/A"),
    documentDate: pickRaw(raw, ["PODate", "DocumentDate", "OriginalDocumentDate"], "N/A"),
    companyCode: pickRaw(raw, ["CompanyCode"], "N/A"),
    fiscalYearPeriod: pickRaw(raw, ["FiscalYear"], "N/A"),
    reference: c.transactionId || "N/A",
    headerText: pickRaw(raw, ["MaterialDescription", "OriginalHeaderText", "HeaderText"], "—"),
  };

  return {
    id: c.caseId,
    caseId: c.caseId,
    riskScore: c.riskScore || 0,
    title: `${vendorName} - ${document}`,
    ruleName,
    ruleId,
    environment: "SAP",
    status: c.status || c.caseStatus || (c.reviewed ? "Reviewed" : "New"),
    closureStatus: c.closureStatus || null,
    assignee: c.assignee || c.reviewedBy || "Unassigned",
    createdAt: displayAt,
    detectionKind: kind,

    detail: {
      description: summary,
      aiSummary: {
        confidence: c.riskScore || 0,
        recommendation: c.riskScore >= 80 ? "escalate" : "investigate",
        summary,
        keyFindings,
        riskAssessment,
      },
      financialImpact: {
        potentialLoss: Number(c.amount?.value ?? 0) || 0,
        currency,
        recoveryProbability: riskLevel === "HIGH" || riskLevel === "CRITICAL" ? 25 : 70,
        estimatedRecovery:
          (Number(c.amount?.value ?? 0) || 0) *
          (riskLevel === "HIGH" || riskLevel === "CRITICAL" ? 0.25 : 0.7),
      },
      transaction,
      transactionFields,
      sapFields,
      customerDetails: {
        id: vendorCode || vendorName || "N/A",
        name: vendorName || "N/A",
        accountGroup: "Vendor",
        country: pickRaw(raw, ["Country"], "N/A"),
        city: pickRaw(raw, ["City"], "N/A"),
        createdDate: pickRaw(raw, ["PODate", "CreatedDate"], "N/A"),
        changedDate: pickRaw(raw, ["LastChangedDate", "ChangedDate"], "N/A"),
        paymentTerms: pickRaw(raw, ["PaymentTerms"], "N/A"),
        bankAccount: pickRaw(raw, ["BankAccount"], "N/A"),
      },
      riskIndicators: [
        {
          label: "Financial Risk",
          score: c.riskScore || 0,
          bullets: [
            `Amount: ${amountStr}`,
            `Risk Level: ${riskLevel}`,
            kind === "po_creator_approver"
              ? `CreatedBy / ReleasedBy: ${pickRaw(raw, ["CreatedBy"], "?")} / ${pickRaw(raw, ["ReleasedBy"], "?")}`
              : `Document: ${document}`,
          ],
        },
      ],
      behavioralPatterns: [
        {
          name: patternName,
          severity: sev,
          frequency: "Detected Once",
          last: displayAt,
        },
      ],
      complianceIssues: [
        {
          law: "Internal Control Policy",
          issue: complianceIssue,
          severity: sev,
          penalty: "Manual review required",
        },
      ],
      networkAnalysis,
      anomalyIndicators: [
        {
          name: alertName,
          severity: sev,
          desc: alertDesc,
        },
      ],
      relatedTransactions,
      auditTrail: [
        {
          event: "Case Created",
          timestamp: displayAt,
          by: "System",
          desc: auditDesc,
        },
      ],
      attachments: [],
      evidence: [
        `Vendor Code: ${vendorCode || "N/A"}`,
        `Transaction ID: ${c.transactionId || "N/A"}`,
        `SAP Module: ${c.sapModule || "N/A"}`,
        `Risk Level: ${riskLevel}`,
        `Rule: ${ruleName}`,
        ...sapFields.slice(0, 6).map((f) => `${f.label}: ${f.value}`),
      ],
      aiRecommendations: recommendations,
      ruleInfo: {
        ruleName,
        ruleId: ruleId || "N/A",
        environment: "SAP",
        detectionTime: displayAt,
      },
      userInfo: {
        userId: pickRaw(raw, ["CreatedBy", "ReleasedBy"], c.reviewedBy || "SYSTEM"),
        userName: pickRaw(raw, ["CreatedBy", "ReleasedBy"], c.reviewedBy || "System User"),
        role: kind === "po_creator_approver" ? "PO Creator / Approver" : "Fraud Analyst",
        department: pickRaw(raw, ["PurchasingGroupName", "PurchasingGroup"], "Finance"),
        location: pickRaw(raw, ["Plant"], "N/A"),
        lastLogin: displayAt,
        ipAddress: "N/A",
      },
    },
  };
}

export const updateCaseAPI = async (id, payload) => {
  try {
    const response = await apiClient.patch(
      `/sap/cases/${encodeURIComponent(id)}/`,
      payload
    );
    const apiData = response.data;
    if (apiData?.status !== "success") {
      return { success: false, error: apiData?.message || "Update failed" };
    }
    const c = apiData.data;
    return {
      success: true,
      data: {
        id: c.caseId,
        assignee: c.assignee,
        assigneeId: c.assigneeId ?? null,
        status: c.caseStatus || c.status,
        closureStatus: c.closureStatus,
      },
    };
  } catch (error) {
    console.error("updateCaseAPI error:", error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || "Update failed",
    };
  }
};

export const createTaskAPI = async (caseId, task) => {
  await delay(500);
  return { success:true, data:{ id:`TASK-${Date.now()}`, caseId, ...task, createdAt:new Date().toLocaleString(), taskStatus:"Open" } };
};

export const assignCaseAPI = async (id, assigneeId) => {
  return updateCaseAPI(id, { assigneeId });
};

export const TASK_PROCESSORS = [
  "Sarah Johnson","Michael Chen","Emily Rodriguez","David Park",
  "Lisa Thompson","James Wilson","Priya Sharma","Senior Team","AI Agent",
];