/**
 * rulesSlice.js — Complete state for Rule Library.
 *
 * FIX: fetchRules.fulfilled now MERGES instead of overwriting.
 *   AI-generated rules (origin === "AI Architect") survive page navigation.
 *   Server rules are refreshed; local-only rules are preserved.
 *
 * EVERYTHING ELSE UNCHANGED — all reducers, thunks, selectors identical.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchRulesAPI, fetchEnvironmentsAPI,
  deployRulesAPI, activateRulesAPI, deactivateRulesAPI,
  runSimulationAPI, deployRuleToEnvAPI,
} from "./rulesBackendAPI";

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchRules = createAsyncThunk("rules/fetch", async (_, { rejectWithValue }) => {
  try { const r = await fetchRulesAPI(); return r.data; }
  catch (e) { return rejectWithValue(e.message); }
});

export const fetchEnvironments = createAsyncThunk("rules/fetchEnvs", async (_, { rejectWithValue }) => {
  try { return await fetchEnvironmentsAPI(); }
  catch (e) { return rejectWithValue(e.message); }
});

export const bulkDeploy = createAsyncThunk("rules/bulkDeploy", async (ids, { rejectWithValue }) => {
  try { const r = await deployRulesAPI(ids); if (!r.success) return rejectWithValue("Failed"); return r.data; }
  catch (e) { return rejectWithValue(e.message); }
});

export const bulkActivate = createAsyncThunk("rules/bulkActivate", async (ids, { rejectWithValue }) => {
  try { const r = await activateRulesAPI(ids); if (!r.success) return rejectWithValue("Failed"); return r.data; }
  catch (e) { return rejectWithValue(e.message); }
});

export const bulkDeactivate = createAsyncThunk("rules/bulkDeactivate", async (ids, { rejectWithValue }) => {
  try { const r = await deactivateRulesAPI(ids); if (!r.success) return rejectWithValue("Failed"); return r.data; }
  catch (e) { return rejectWithValue(e.message); }
});

export const runSimulation = createAsyncThunk("rules/runSimulation", async ({ ruleId, config }, { rejectWithValue }) => {
  try { const r = await runSimulationAPI(ruleId, config); if (!r.success) return rejectWithValue("Simulation failed"); return r.data; }
  catch (e) { return rejectWithValue(e.message); }
});

export const deployRuleToEnv = createAsyncThunk("rules/deployRuleToEnv", async ({ ruleId, environment }, { rejectWithValue }) => {
  try { const r = await deployRuleToEnvAPI(ruleId, environment); if (!r.success) return rejectWithValue("Deploy failed"); return r.data; }
  catch (e) { return rejectWithValue(e.message); }
});

// ─── Simulation State Machine ─────────────────────────────────────────────────
const initSim = {
  step: 0, mode: null, selectedEnv: null,
  config: { transactionCount: 10000, fromDate: "", toDate: "" },
  loading: false, error: null,
};

// ─── Slice ────────────────────────────────────────────────────────────────────
const rulesSlice = createSlice({
  name: "rules",
  initialState: {
    list: [], loading: false, error: null,
    simEnvs: [], deployEnvs: [],
    search: "", statusFilter: "ALL", moduleFilter: "ALL",
    selected: [],
    modalType: null, activeRule: null, modalData: null,
    bulkLoading: false, bulkError: null,
    deployTarget: null, deployLoading: false, deployError: null,
    deploySuccessMsg: "",
    scheduleConfig: { type: "ONE_TIME", environment: "", fromDate: "", toDate: "" },
    scheduleError: "",
    simulation: { ...initSim },
  },

  reducers: {
    // ── AI Rule mutations (called from AIRuleArchitect) ───────────────────────
    addGeneratedRule: (s, a) => {
      // Prevent duplicate IDs
      const exists = s.list.some(r => r.id === a.payload.id);
      if (!exists) s.list.unshift(a.payload);
    },
    updateGeneratedRule: (s, a) => {
      const idx = s.list.findIndex(r => r.id === a.payload.id);
      if (idx !== -1) s.list[idx] = { ...s.list[idx], ...a.payload.changes };
    },

    // ── Filters ───────────────────────────────────────────────────────────────
    setSearch:       (s, a) => { s.search       = a.payload; },
    setStatusFilter: (s, a) => { s.statusFilter = a.payload; },
    setModuleFilter: (s, a) => { s.moduleFilter = a.payload; },

    // ── Selection ─────────────────────────────────────────────────────────────
    toggleSelect: (s, a) => {
      const id = a.payload;
      s.selected = s.selected.includes(id) ? s.selected.filter(i => i !== id) : [...s.selected, id];
    },
    selectAll: (s, a) => {
      const ids = a.payload;
      s.selected = ids.every(id => s.selected.includes(id)) ? [] : ids;
    },
    clearSelection: (s) => { s.selected = []; },

    // ── Modals ────────────────────────────────────────────────────────────────
    openModal:  (s, a) => {
      s.modalType = a.payload.type;
      s.activeRule = a.payload.rule || null;
      s.modalData = a.payload || null;
      s.bulkError = null;
      s.deployError = null;
    },
    closeModal: (s)    => {
      s.modalType = null;
      s.activeRule = null;
      s.modalData = null;
      s.bulkError = null;
      s.deployError = null;
      s.deploySuccessMsg = "";
    },

    // ── Simulation Control ────────────────────────────────────────────────────
    openSimulation: (s, a) => { s.simulation = { ...initSim, step: 1 }; s.activeRule = a.payload; s.modalType = null; s.modalData = null; },
    setSimStep:     (s, a) => { s.simulation.step = a.payload; },
    setSimMode:     (s, a) => { s.simulation.mode = a.payload; },
    setSimEnv:      (s, a) => { s.simulation.selectedEnv = a.payload; },
    setSimConfig:   (s, a) => { s.simulation.config = { ...s.simulation.config, ...a.payload }; },
    closeSimulation:(s)    => { s.simulation = { ...initSim }; s.activeRule = null; s.modalData = null; },

    // ── Deploy-to-env ─────────────────────────────────────────────────────────
    setDeployTarget: (s, a) => { s.deployTarget = a.payload; s.deployError = null; },
    closeDeployEnv:  (s)    => { s.deployTarget = null; s.deployError = null; },

    // ── Schedule ──────────────────────────────────────────────────────────────
    setScheduleConfig: (s, a) => { s.scheduleConfig = { ...s.scheduleConfig, ...a.payload }; s.scheduleError = ""; },
    setScheduleError:  (s, a) => { s.scheduleError = a.payload; },
  },

  extraReducers: (b) => {
    // ── fetchRules ────────────────────────────────────────────────────────────
    b.addCase(fetchRules.pending,  (s)    => { s.loading = true; s.error = null; });
    b.addCase(fetchRules.rejected, (s, a) => { s.loading = false; s.error = a.payload; });

    // KEY FIX: merge instead of overwrite — AI-generated rules survive navigation
    b.addCase(fetchRules.fulfilled, (s, a) => {
      s.loading = false;
      const serverRules  = a.payload;
      const serverIds    = new Set(serverRules.map(r => r.id));
      // Keep any locally-added rules (AI Architect) that aren't in server response
      const localOnlyRules = s.list.filter(r => !serverIds.has(r.id));
      s.list = [...localOnlyRules, ...serverRules];
    });

    // ── fetchEnvironments ─────────────────────────────────────────────────────
    b.addCase(fetchEnvironments.fulfilled, (s, a) => {
      s.simEnvs   = a.payload.simEnvs;
      s.deployEnvs = a.payload.deployEnvs;
    });

    // ── Bulk actions ──────────────────────────────────────────────────────────
    const bulkPending  = (s)    => { s.bulkLoading = true; s.bulkError = null; };
    const bulkRejected = (s, a) => { s.bulkLoading = false; s.bulkError = a.payload; };
    const applyBulk    = (s, a) => {
      s.bulkLoading = false; s.modalType = null;
      a.payload.forEach(({ id, status, lifecycle, activatedAt, deployedEnv }) => {
        const r = s.list.find(x => x.id === id);
        if (r) {
          r.status = status; r.lifecycle = lifecycle;
          if (activatedAt) r.activatedAt = activatedAt;
          if (deployedEnv != null) r.deployedEnv = deployedEnv;
        }
      });
      s.selected = [];
    };
    b.addCase(bulkDeploy.pending,     bulkPending);
    b.addCase(bulkDeploy.fulfilled,   applyBulk);
    b.addCase(bulkDeploy.rejected,    bulkRejected);
    b.addCase(bulkActivate.pending,   bulkPending);
    b.addCase(bulkActivate.fulfilled, applyBulk);
    b.addCase(bulkActivate.rejected,  bulkRejected);
    b.addCase(bulkDeactivate.pending,   bulkPending);
    b.addCase(bulkDeactivate.fulfilled, applyBulk);
    b.addCase(bulkDeactivate.rejected,  bulkRejected);

    // ── Simulation ────────────────────────────────────────────────────────────
    b.addCase(runSimulation.pending, (s) => {
      s.simulation.loading = true; s.simulation.error = null; s.simulation.step = 5;
    });
    b.addCase(runSimulation.fulfilled, (s, a) => {
      s.simulation.loading = false; s.simulation.step = 6;
      const result = a.payload;
      const rule   = s.list.find(r => r.id === result.ruleId);
      if (rule) {
        rule.simulationHistory = [result, ...rule.simulationHistory];
        rule.status    = "SIMULATION";
        rule.lifecycle = "SIMULATION";
      }
      if (s.activeRule?.id === result.ruleId && rule) s.activeRule = { ...rule };
    });
    b.addCase(runSimulation.rejected, (s, a) => {
      s.simulation.loading = false; s.simulation.error = a.payload;
      s.simulation.step = s.simulation.mode === "test" ? 2 : 4;
    });

    // ── Deploy to specific env ────────────────────────────────────────────────
    b.addCase(deployRuleToEnv.pending,   (s)    => { s.deployLoading = true; s.deployError = null; });
    b.addCase(deployRuleToEnv.fulfilled, (s, a) => {
      s.deployLoading = false;
      const { ruleId, environment } = a.payload;
      const rule = s.list.find(r => r.id === ruleId);
      if (rule) { rule.status = "DEPLOYED"; rule.lifecycle = "DEPLOYED"; rule.deployedEnv = environment; }
      if (s.activeRule?.id === ruleId) { s.activeRule = { ...rule }; }
      const envLabel = { DEV: "DEV environment", QAS: "QA environment", PROD: "PRODUCTION environment" };
      s.deploySuccessMsg = `${s.activeRule?.name || ""} has been deployed to ${envLabel[environment] || environment}.\nStatus: DEPLOYED\nThe active rule has been archived to the selected environment.`;
      s.modalType   = "DEPLOY_SUCCESS";
      s.deployTarget = null;
    });
    b.addCase(deployRuleToEnv.rejected, (s, a) => { s.deployLoading = false; s.deployError = a.payload; });
  },
});

export const {
  addGeneratedRule, updateGeneratedRule,
  setSearch, setStatusFilter, setModuleFilter,
  toggleSelect, selectAll, clearSelection,
  openModal, closeModal,
  openSimulation, setSimStep, setSimMode, setSimEnv, setSimConfig, closeSimulation,
  setDeployTarget, closeDeployEnv,
  setScheduleConfig, setScheduleError,
} = rulesSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectFilteredRules = (s) => {
  const { list, search, statusFilter, moduleFilter } = s.rules;
  const q = search.toLowerCase();
  return list.filter(r => {
    const ms  = !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
    const ss  = statusFilter === "ALL" || r.status === statusFilter;
    const ms2 = moduleFilter === "ALL" || r.module === moduleFilter;
    return ms && ss && ms2;
  });
};

export const selectStats = (s) => {
  const rules = s.rules.list || [];

  return {
    total: rules.length, 

    active: rules.filter(r => r.status === "ACTIVE").length,

    deployed: rules.filter(r => 
      r.status === "DEPLOYED" || r.lifecycle === "DEPLOYED"
    ).length,

    simulation: rules.filter(r => 
      r.status === "SIMULATION" || r.lifecycle === "SIMULATION"
    ).length,

    draft: rules.filter(r => r.status === "DRAFT").length,
  };
};

export default rulesSlice.reducer;