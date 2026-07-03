/**
 * rulesBackendAPI.js
 * Real backend integration for Django APIs
 */

import apiClient from "../../services/apiClient";

const API_BASE = "/sap/rules";

// ─────────────────────────────────────────────────────────────
// ENVIRONMENTS
// ─────────────────────────────────────────────────────────────

export const SIM_ENVIRONMENTS = [
  {
    id: "DEV",
    name: "Development (DEV)",
    systemId: "SAP-DEV-001",
    desc: "Testing environment",
    status: "Online",
  },
  {
    id: "QA",
    name: "Quality Assurance (QA)",
    systemId: "SAP-QA-001",
    desc: "QA environment",
    status: "Online",
  },
  {
    id: "PROD",
    name: "Production (PROD)",
    systemId: "SAP-PRD-001",
    desc: "Production environment",
    status: "Online",
  },
];

export const DEPLOY_ENVIRONMENTS = [
  {
    id: "DEV",
    name: "Development",
  },
  {
    id: "QAS",
    name: "QA",
  },
  {
    id: "PROD",
    name: "Production",
  },
];

// ─────────────────────────────────────────────────────────────
// FETCH RULES
// ─────────────────────────────────────────────────────────────

export const fetchRulesAPI = async () => {
  const response = await apiClient.get(`${API_BASE}/`);
  return {
    success: true,
    data: response.data.data || [],
  };
};

// ─────────────────────────────────────────────────────────────
// FETCH RULE DETAILS (including dynamicParameters)
// ─────────────────────────────────────────────────────────────

export const fetchRuleDetailsAPI = async (ruleId) => {
  const response = await apiClient.get(`${API_BASE}/${ruleId}/`);
  return {
    success: true,
    data: response.data || {},
    dynamicParameters: response.data?.dynamicParameters || null,
  };
};

// ─────────────────────────────────────────────────────────────
// FETCH ENVIRONMENTS
// ─────────────────────────────────────────────────────────────

export const fetchEnvironmentsAPI = async () => {
  return {
    success: true,
    simEnvs: SIM_ENVIRONMENTS,
    deployEnvs: DEPLOY_ENVIRONMENTS,
  };
};

// ─────────────────────────────────────────────────────────────
// BULK DEPLOY
// ─────────────────────────────────────────────────────────────

export const deployRulesAPI = async (ids) => {
  const results = [];

  for (const id of ids) {
    const response = await apiClient.post(`${API_BASE}/${id}/deploy/`);

    results.push({
      id,
      status: "DEPLOYED",
      lifecycle: "DEPLOYED",
      deployedEnv: response.data.environment || "PROD",
    });
  }

  return {
    success: true,
    data: results,
  };
};

// ─────────────────────────────────────────────────────────────
// BULK ACTIVATE
// ─────────────────────────────────────────────────────────────

export const activateRulesAPI = async (ids) => {
  const results = [];

  for (const id of ids) {
    await apiClient.post(`${API_BASE}/${id}/activate/`);

    results.push({
      id,
      status: "ACTIVE",
      lifecycle: "ACTIVE",
      activatedAt: new Date().toISOString(),
    });
  }

  return {
    success: true,
    data: results,
  };
};

// ─────────────────────────────────────────────────────────────
// BULK DEACTIVATE
// ─────────────────────────────────────────────────────────────

export const deactivateRulesAPI = async (ids) => {
  return {
    success: true,
    data: ids.map((id) => ({
      id,
      status: "DRAFT",
      lifecycle: "DRAFT",
    })),
  };
};

// ─────────────────────────────────────────────────────────────
// RUN SIMULATION
// ─────────────────────────────────────────────────────────────

export const runSimulationAPI = async (ruleId, config) => {
  const response = await apiClient.post(
    `${API_BASE}/${ruleId}/simulate/`,
    config
  );

  return {
    success: true,
    data: {
      ...response.data,
      ruleId,
    },
  };
};

// ─────────────────────────────────────────────────────────────
// DEPLOY TO ENV
// ─────────────────────────────────────────────────────────────

export const deployRuleToEnvAPI = async (ruleId, environment) => {

  // Fetch the specific rule details from the API so deploy can use DB-backed artifacts
  const ruleResponse = await apiClient.get(`${API_BASE}/${ruleId}/`);
  const rule = ruleResponse.data.data;

  if (!rule) {
    throw new Error("Rule not found");
  }

  // Extract view name from cdsCode line like: "define view XXXXXXX"
  const extractedViewName = rule.cdsCode
    ?.match(/define\s+view(?:\s+entity)?\s+([A-Z0-9_]+)/i)?.[1]
    ?.replace(/_+$/, ""); // remove trailing underscores only

  const viewName =
    extractedViewName ||
    rule.name
      ?.replace(/[^A-Z0-9]/gi, "_")
      ?.replace(/_+$/, "") // remove trailing underscores
      ?.toUpperCase()
      ?.substring(0, 24) ||
    `ZAI_RULE_${ruleId}`;

  const payload = {
    cdsCode: rule.cdsCode || "",
    cdsBaseinfo: rule.cdsBaseinfo || "",
    cdsXml: rule.cdsXml || "",
    cdsSrvd: rule.cdsSrvd || "",
    cdsSrvb: rule.cdsSrvb || "",
    viewName,
    module: rule.module || "FI",
    environment,
  };

  console.log("RULE OBJECT:", rule);
  console.log("PAYLOAD:", payload);

  const response = await apiClient.post(
    `${API_BASE}/${ruleId}/deploy/`,
    payload
  );

  return {
    success: true,
    data: {
      ruleId,
      environment,
      status: "DEPLOYED",
      lifecycle: "DEPLOYED",
      ...response.data,
    },
  };
};