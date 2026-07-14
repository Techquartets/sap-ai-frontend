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

    // UI-compatible transformed object
    const transformedCase = {
      id: c.caseId,
      caseId: c.caseId,
      riskScore: c.riskScore || 0,
      title: `Duplicate Invoice Detection - ${c.vendor}`,
      ruleName: "Duplicate Invoice Check",
      ruleId: c.ruleId || "RULE-DUP-001",
      environment: "SAP",
      status: c.reviewed ? "Reviewed" : "New",
      closureStatus: null,
      assignee: c.assignee || "Unassigned",
      assigneeId: c.assigneeId ?? null,
      createdAt: c.detectedAt,

      detail: {
        aiSummary: {
          confidence: c.riskScore || 0,
          recommendation:
            c.riskScore >= 80 ? "escalate" : "investigate",
          summary:
            "Potential duplicate invoice detected based on invoice comparison and vendor validation.",
          keyFindings: [
            `Original Invoice: ${c.raw?.OriginalInvoiceDoc || "N/A"}`,
            `Duplicate Invoice: ${c.raw?.DuplicateInvoiceDoc || "N/A"}`,
            `Vendor: ${c.vendor || "N/A"}`,
            `Amount: ${c.amount?.value || 0} ${
              c.amount?.currency || ""
            }`,
          ],
          riskAssessment:
            c.riskLevel === "HIGH"
              ? "High probability duplicate invoice fraud."
              : "Requires investigator review.",
        },

        financialImpact: {
          potentialLoss: c.amount?.value || 0,
          recoveryProbability:
            c.riskLevel === "HIGH" ? 25 : 70,
          estimatedRecovery:
            (c.amount?.value || 0) *
            (c.riskLevel === "HIGH" ? 0.25 : 0.7),
        },

        transaction: {
          documentNumber: c.document || "N/A",
          amount: `${c.amount?.value || 0} ${
            c.amount?.currency || ""
          }`,
          postingDate: c.raw?.OriginalPostingDate || "N/A",
          documentDate: c.raw?.OriginalDocumentDate || "N/A",
          companyCode: c.raw?.CompanyCode || "N/A",
          fiscalYearPeriod: c.raw?.FiscalYear || "N/A",
          reference: c.transactionId || "N/A",
          headerText: c.raw?.OriginalHeaderText || "",
        },

        customerDetails: {
          id: c.vendor || "N/A",
          name: c.vendor || "N/A",
          accountGroup: "Vendor",
          country: "N/A",
          city: "N/A",
          createdDate: "N/A",
          changedDate: "N/A",
          paymentTerms: "N/A",
          bankAccount: "N/A",
        },

        riskIndicators: [
          {
            label: "Financial Risk",
            score: c.riskScore || 0,
            bullets: [
              `Invoice Amount: ${c.amount?.value || 0} ${
                c.amount?.currency || ""
              }`,
              `Risk Level: ${c.riskLevel || "UNKNOWN"}`,
            ],
          },
        ],

        behavioralPatterns: [
          {
            name: "Duplicate Invoice Submission",
            severity: c.riskLevel?.toLowerCase() || "medium",
            frequency: "Detected Once",
            last: c.detectedAt || "N/A",
          },
        ],

        complianceIssues: [
          {
            law: "Internal Finance Policy",
            issue: "Potential duplicate invoice payment",
            severity: c.riskLevel?.toLowerCase() || "medium",
            penalty: "Manual review required",
          },
        ],

        networkAnalysis: [
          {
            entityId: c.vendor || "N/A",
            type: "Vendor",
            relationship: "Invoice Creator",
            riskLevel: c.riskLevel?.toLowerCase() || "medium",
          },
        ],

        anomalyIndicators: [
          {
            name: "Duplicate Invoice",
            severity: c.riskLevel?.toLowerCase() || "medium",
            desc: `Duplicate invoice detected between ${
              c.raw?.OriginalInvoiceDoc || "N/A"
            } and ${
              c.raw?.DuplicateInvoiceDoc || "N/A"
            }`,
          },
        ],

        relatedTransactions: [
          {
            docId: c.raw?.OriginalInvoiceDoc || "N/A",
            type: "Original Invoice",
            date: c.raw?.OriginalDocumentDate || "N/A",
            amount: `${c.amount?.value || 0} ${
              c.amount?.currency || ""
            }`,
            status: c.raw?.OriginalStatus || "N/A",
          },
          {
            docId: c.raw?.DuplicateInvoiceDoc || "N/A",
            type: "Duplicate Invoice",
            date: c.raw?.DuplicateDocumentDate || "N/A",
            amount: `${c.amount?.value || 0} ${
              c.amount?.currency || ""
            }`,
            status: c.raw?.DuplicateStatus || "N/A",
          },
        ],

        auditTrail: [
          {
            event: "Case Created",
            timestamp: c.detectedAt || "N/A",
            by: "System",
            desc:
              "Automatic duplicate invoice detection triggered",
          },
        ],

        attachments: [],

        evidence: [
          `Vendor Code: ${c.vendorCode || "N/A"}`,
          `Transaction ID: ${c.transactionId || "N/A"}`,
          `SAP Module: ${c.sapModule || "N/A"}`,
          `Risk Level: ${c.riskLevel || "N/A"}`,
        ],

        aiRecommendations: [
          "Review duplicate invoices",
          "Validate vendor payments",
          "Check approval workflow",
          "Verify posting dates",
        ],
        ruleInfo: {
          ruleName: "Duplicate Invoice Check",
          ruleId: c.ruleId || "RULE-DUP-001",
          environment: "SAP",
          detectionTime: c.detectedAt || "N/A",
        },
        userInfo: {
          userId: c.reviewedBy || "SYSTEM",
          userName: c.reviewedBy || "System User",
          role: "Fraud Analyst",
          department: "Finance",
          location: "N/A",
          lastLogin: c.detectedAt || "N/A",
          ipAddress: "N/A",
        },
      },
    };

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

    return {
      success: true,
      data: transformedCase,
    };
  } catch (error) {
    console.error("fetchCaseDetailAPI error:", error);

    return {
      success: false,
      error: error.message || "Failed to fetch case detail",
    };
  }
};

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