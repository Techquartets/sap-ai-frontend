import apiClient from "../../services/apiClient";

const SCHEDULES_BASE = "/sap/rules/schedules";

export const fetchActiveSchedulesAPI = async (filters = {}) => {
  const params = new URLSearchParams({ active: "false" });
  if (filters.environment) params.append("environment", filters.environment);
  if (filters.frequency) params.append("frequency", filters.frequency);
  if (filters.type) params.append("type", filters.type);
  if (filters.search) params.append("search", filters.search);

  const response = await apiClient.get(`${SCHEDULES_BASE}/list/?${params.toString()}`);
  return {
    success: response.data?.status === "success",
    data: response.data?.data || [],
    message: response.data?.message,
  };
};

export const fetchScheduleExecutionsAPI = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.environment) params.append("environment", filters.environment);
  if (filters.status) params.append("status", filters.status);
  if (filters.ruleId) params.append("ruleId", filters.ruleId);
  if (filters.scheduleId) params.append("scheduleId", filters.scheduleId);
  if (filters.search) params.append("search", filters.search);
  if (filters.fromDate) params.append("fromDate", filters.fromDate);
  if (filters.toDate) params.append("toDate", filters.toDate);
  if (filters.limit) params.append("limit", String(filters.limit));

  const response = await apiClient.get(
    `${SCHEDULES_BASE}/executions/?${params.toString()}`
  );
  return {
    success: response.data?.status === "success",
    data: response.data?.data || [],
    message: response.data?.message,
  };
};

export const updateScheduleAPI = async (scheduleId, payload) => {
  const response = await apiClient.patch(
    `${SCHEDULES_BASE}/${scheduleId}/`,
    payload
  );
  return {
    success: response.data?.status === "success",
    data: response.data?.data,
    message: response.data?.message || "Schedule updated",
  };
};

export const archiveScheduleAPI = async (scheduleId) =>
  updateScheduleAPI(scheduleId, { archive: true });

export const deactivateScheduleAPI = async (scheduleId) =>
  updateScheduleAPI(scheduleId, { isActive: false });

export const activateScheduleAPI = async (scheduleId) =>
  updateScheduleAPI(scheduleId, { isActive: true });

export const fetchExecutionAnomaliesAPI = async (ruleId, caseIds = []) => {
  const ids = Array.isArray(caseIds) ? caseIds.filter(Boolean) : [];
  if (!ruleId || ids.length === 0) {
    return { success: true, data: [], count: 0 };
  }

  const params = new URLSearchParams({ limit: "500", rule_id: ruleId });
  params.append("case_ids", ids.join(","));

  const response = await apiClient.get(`/sap/anomalies/list/?${params.toString()}`);
  const payload = response.data || {};
  const anomalies = Array.isArray(payload.anomalies)
    ? payload.anomalies
    : Array.isArray(payload.data)
      ? payload.data
      : [];

  return {
    success: payload.status === "success",
    data: anomalies,
    count: anomalies.length,
    message: payload.message,
  };
};

export const deleteScheduleExecutionAPI = async (executionId) => {
  const response = await apiClient.delete(
    `${SCHEDULES_BASE}/executions/${executionId}/`
  );
  return {
    success: response.data?.status === "success",
    message: response.data?.message || "Execution deleted",
  };
};

export const ENV_OPTIONS = ["DEV", "QA", "PROD"];

export const FREQUENCY_OPTIONS = [
  { value: "ONE_TIME", label: "One-time" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

export const DAY_OF_WEEK_OPTIONS = [
  { value: "MON", label: "Monday" },
  { value: "TUE", label: "Tuesday" },
  { value: "WED", label: "Wednesday" },
  { value: "THU", label: "Thursday" },
  { value: "FRI", label: "Friday" },
  { value: "SAT", label: "Saturday" },
  { value: "SUN", label: "Sunday" },
];
