import apiClient from "./apiClient";

export const llmSettingsService = {
  fetchSettings: async () => {
    const response = await apiClient.get("/sap/llm/settings/");
    return response.data;
  },

  updateSettings: async (payload) => {
    const response = await apiClient.put("/sap/llm/settings/", payload);
    return response.data;
  },

  createModelPricing: async (payload) => {
    const response = await apiClient.post("/sap/llm/model-pricing/", payload);
    return response.data;
  },

  updateModelPricing: async (id, payload) => {
    const response = await apiClient.put(`/sap/llm/model-pricing/${id}/`, payload);
    return response.data;
  },

  deleteModelPricing: async (id) => {
    const response = await apiClient.delete(`/sap/llm/model-pricing/${id}/`);
    return response.data;
  },

  createByolBudget: async (payload) => {
    const response = await apiClient.post("/sap/llm/byol-budgets/", payload);
    return response.data;
  },

  updateByolBudget: async (id, payload) => {
    const response = await apiClient.put(`/sap/llm/byol-budgets/${id}/`, payload);
    return response.data;
  },

  deleteByolBudget: async (id) => {
    const response = await apiClient.delete(`/sap/llm/byol-budgets/${id}/`);
    return response.data;
  },
};
