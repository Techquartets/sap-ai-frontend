export const RISK_CONFIG_STORAGE_KEY = "case_risk_level_config_v1";
export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const MAX_RISK_VALUE = 10000000; // 1 crore

function normalizeConfigs(configs) {
  // Keep one threshold per level (latest wins), then sort by max ascending
  // so ranges are fully user-defined by entered max values.
  const latestByLevel = {};
  (Array.isArray(configs) ? configs : []).forEach((x) => {
    const level = String(x.level || "").toUpperCase();
    const maxValue = Number(x.maxValue || 0);
    if (RISK_LEVELS.includes(level) && Number.isFinite(maxValue) && maxValue > 0) {
      latestByLevel[level] = maxValue;
    }
  });
  return Object.entries(latestByLevel)
    .map(([level, maxValue]) => ({ level, maxValue }))
    .sort((a, b) => a.maxValue - b.maxValue);
}

export function loadRiskConfigs() {
  try {
    const raw = localStorage.getItem(RISK_CONFIG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeConfigs(parsed);
  } catch {
    return [];
  }
}

export function saveRiskConfigs(configs) {
  const clean = normalizeConfigs(configs);
  localStorage.setItem(RISK_CONFIG_STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function resolveRiskLevelByAmount(amount, configs = loadRiskConfigs()) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return null;
  const sorted = normalizeConfigs(configs);
  if (sorted.length === 0) return null;

  let lowerBound = 1;
  for (const cfg of sorted) {
    if (value >= lowerBound && value <= cfg.maxValue) return cfg.level;
    lowerBound = cfg.maxValue + 1;
  }

  // If the amount exceeds the highest configured threshold, assign the highest risk level.
  return sorted[sorted.length - 1].level;
}
