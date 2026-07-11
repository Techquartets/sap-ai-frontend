const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// ─────────────────────────────────────────────────────────────
// FETCH ALL RULES
// GET /rules/
// ─────────────────────────────────────────────────────────────
export const fetchRulesAPI = async () => {
  try {
    const res = await fetch(`${API_BASE}/rules/`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    return {
      success: true,
      data: data.data || [],
    };
  } catch (err) {
    console.error("fetchRulesAPI error:", err);

    return {
      success: false,
      data: [],
      error: err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────
// CREATE RULE
// POST /rules/
// ─────────────────────────────────────────────────────────────
export const createRuleAPI = async (rulePayload) => {
  try {
    const res = await fetch(`${API_BASE}/rules/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rulePayload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    return {
      success: true,
      data: data.data,
    };
  } catch (err) {
    console.error("createRuleAPI error:", err);

    return {
      success: false,
      error: err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────
// RUN SIMULATION
// POST /rules/:id/simulate/
// ─────────────────────────────────────────────────────────────
export const runSimulationAPI = async (ruleId, config) => {
  try {
    const res = await fetch(
      `${API_BASE}/rules/${ruleId}/simulate/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    return {
      success: true,
      data: data.data,
    };
  } catch (err) {
    console.error("runSimulationAPI error:", err);

    return {
      success: false,
      error: err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────
// ACTIVATE RULE
// POST /rules/:id/activate/
// ─────────────────────────────────────────────────────────────
export const activateRulesAPI = async (ids) => {
  try {
    const results = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(
          `${API_BASE}/rules/${id}/activate/`,
          {
            method: "POST",
          }
        );

        return res.json();
      })
    );

    return {
      success: true,
      data: results,
    };
  } catch (err) {
    console.error("activateRulesAPI error:", err);

    return {
      success: false,
      error: err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────
// DEPLOY RULE
// POST /rules/:id/deploy/
// ─────────────────────────────────────────────────────────────
export const deployRuleToEnvAPI = async (
  ruleId,
  environment
) => {
  try {
    const res = await fetch(
      `${API_BASE}/rules/${ruleId}/deploy/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          environment,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    return {
      success: true,
      data: data.data,
    };
  } catch (err) {
    console.error("deployRuleToEnvAPI error:", err);

    return {
      success: false,
      error: err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE RULE
// DELETE /rules/:id/
// ─────────────────────────────────────────────────────────────
export const deleteRuleAPI = async (ruleId) => {
  try {
    const res = await fetch(
      `${API_BASE}/rules/${ruleId}/`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return {
      success: true,
    };
  } catch (err) {
    console.error("deleteRuleAPI error:", err);

    return {
      success: false,
      error: err.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────
// RULE STATS
// GET /rules/statistics/
// ─────────────────────────────────────────────────────────────
export const fetchRuleStatsAPI = async () => {
  try {
    const res = await fetch(
      `${API_BASE}/rules/statistics/`
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    return {
      success: true,
      data: data.data,
    };
  } catch (err) {
    console.error("fetchRuleStatsAPI error:", err);

    return {
      success: false,
      error: err.message,
    };
  }
};