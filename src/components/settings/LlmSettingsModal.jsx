import { useEffect, useMemo, useState } from "react";
import { CircleNotch, Plus, Trash, X } from "@phosphor-icons/react";
import { llmSettingsService } from "../../services/llmSettingsService";

const DEFAULT_MODEL_OPTIONS = [
  { provider: "openai", model: "gpt-5.4", label: "OpenAI — GPT-5.4" },
  { provider: "anthropic", model: "claude-opus-4-7", label: "Anthropic — Claude Opus 4.7" },
];

function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-[var(--muted)]">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

function inputClass(extra = "") {
  return `w-full p-2.5 rounded-lg bg-[#0d1117] border border-[var(--border)] text-[13px] text-[var(--text)] ${extra}`;
}

function modelKey(provider, model) {
  return `${provider}::${model}`;
}

function providerLabel(provider) {
  if (provider === "anthropic") return "Anthropic";
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Google Gemini";
  return provider;
}

function isActivePricingRow(row) {
  return row.isActive !== false;
}

function modelsForProvider(pricingRows, provider) {
  return pricingRows.filter(
    (row) => row.provider === provider && isActivePricingRow(row)
  );
}

function findPricingRow(pricingRows, provider, model) {
  return pricingRows.find(
    (row) =>
      row.provider === provider && row.model === model && isActivePricingRow(row)
  );
}

function isModelInPricing(pricingRows, provider, model) {
  return Boolean(findPricingRow(pricingRows, provider, model));
}

const EMPTY_PRICING_EDIT = {
  id: null,
  provider: "openai",
  model: "",
  promptPricePer1m: "",
  completionPricePer1m: "",
};

export default function LlmSettingsModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [providerMode, setProviderMode] = useState("platform");
  const [settings, setSettings] = useState({
    monthlyBudget: "",
    warningThresholdPercent: "",
    oversubscriptionFactor: "",
    selectedProvider: "openai",
    selectedModel: "gpt-5.4",
    promptPricePer1m: "",
    completionPricePer1m: "",
  });
  const [platformBudget, setPlatformBudget] = useState(null);
  const [modelPricing, setModelPricing] = useState([]);
  const [byolEntry, setByolEntry] = useState({
    id: null,
    provider: "openai",
    model: "",
    apiKey: "",
  });
  const [modelPricingOpen, setModelPricingOpen] = useState(false);
  const [pricingEdit, setPricingEdit] = useState(EMPTY_PRICING_EDIT);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const modelOptions = useMemo(() => {
    if (modelPricing.length > 0) {
      return modelPricing.filter(isActivePricingRow).map((row) => ({
        provider: row.provider,
        model: row.model,
        label: `${providerLabel(row.provider)} — ${row.model}`,
      }));
    }
    return DEFAULT_MODEL_OPTIONS;
  }, [modelPricing]);
  const pricingProviders = useMemo(() => {
    const providers = [
      ...new Set(modelPricing.filter(isActivePricingRow).map((row) => row.provider)),
    ];
    return providers.sort();
  }, [modelPricing]);
  const byolProviderOptions = useMemo(() => {
    const providers = new Set(pricingProviders);
    if (byolEntry.provider) {
      providers.add(byolEntry.provider);
    }
    return [...providers].sort();
  }, [pricingProviders, byolEntry.provider]);
  const byolModelsForProvider = useMemo(
    () => modelsForProvider(modelPricing, byolEntry.provider),
    [modelPricing, byolEntry.provider]
  );
  const byolModelOrphaned = useMemo(() => {
    if (!byolEntry.model.trim()) return false;
    return !isModelInPricing(modelPricing, byolEntry.provider, byolEntry.model);
  }, [byolEntry.provider, byolEntry.model, modelPricing]);
  const selectedModelKey = modelKey(settings.selectedProvider, settings.selectedModel);
  const activeModelSummary = useMemo(() => {
    if (providerMode === "customer") {
      if (!byolEntry.model.trim()) {
        return { label: "Not configured", pricing: null, orphaned: false };
      }
      const pricingRow = findPricingRow(
        modelPricing,
        byolEntry.provider,
        byolEntry.model
      );
      return {
        label: `${providerLabel(byolEntry.provider)} — ${byolEntry.model}`,
        pricing: pricingRow
          ? {
              prompt: pricingRow.promptPricePer1m,
              completion: pricingRow.completionPricePer1m,
            }
          : null,
        orphaned: !pricingRow,
      };
    }

    const option = modelOptions.find(
      (row) =>
        row.provider === settings.selectedProvider && row.model === settings.selectedModel
    );
    return {
      label: option
        ? option.label
        : `${providerLabel(settings.selectedProvider)} — ${settings.selectedModel}`,
      pricing: {
        prompt: settings.promptPricePer1m,
        completion: settings.completionPricePer1m,
      },
      orphaned: false,
    };
  }, [
    providerMode,
    byolEntry.provider,
    byolEntry.model,
    modelOptions,
    modelPricing,
    settings.selectedProvider,
    settings.selectedModel,
    settings.promptPricePer1m,
    settings.completionPricePer1m,
  ]);
  const applyModelPricing = (provider, model, pricingRows) => {
    const row = pricingRows.find(
      (item) => item.provider === provider && item.model === model
    );
    setSettings((prev) => ({
      ...prev,
      selectedProvider: provider,
      selectedModel: model,
      promptPricePer1m: row ? String(row.promptPricePer1m) : "",
      completionPricePer1m: row ? String(row.completionPricePer1m) : "",
    }));
  };
  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await llmSettingsService.fetchSettings();
      if (data.status !== "success") {
        throw new Error(data.message || "Failed to load settings");
      }

      const billingMode = data.settings.billingMode;
      const selectedProvider = data.settings.selectedProvider || "openai";
      const selectedModel = data.settings.selectedModel || "gpt-5.4";
      const pricingRows = data.modelPricing || [];
      const selectedPricing =
        data.selectedModelPricing ||
        pricingRows.find(
          (row) => row.provider === selectedProvider && row.model === selectedModel
        );

      setProviderMode(billingMode === "byol" ? "customer" : "platform");
      setSettings({
        monthlyBudget: String(data.settings.monthlyBudget ?? ""),
        warningThresholdPercent: String(
          data.settings.warningThresholdPercent ??
            (data.settings.warningThreshold != null
              ? data.settings.warningThreshold * 100
              : "")
        ),
        oversubscriptionFactor: String(data.settings.oversubscriptionFactor ?? ""),
        selectedProvider,
        selectedModel,
        promptPricePer1m: selectedPricing ? String(selectedPricing.promptPricePer1m) : "",
        completionPricePer1m: selectedPricing
          ? String(selectedPricing.completionPricePer1m)
          : "",
      });
      setModelPricing(pricingRows);
      setPlatformBudget(data.platformBudget || null);

      const byolRows = data.byolBudgets || [];
      const activeByolId = data.settings.activeByolBudgetId;
      const activeByol =
        byolRows.find((row) => row.id === activeByolId) || byolRows[0];
      if (activeByol) {
        setByolEntry({
          id: activeByol.id,
          provider: activeByol.provider,
          model: activeByol.model,
          apiKey: "",
        });
      } else if (pricingRows.length > 0) {
        const firstRow = pricingRows.find(isActivePricingRow) || pricingRows[0];
        setByolEntry({
          id: null,
          provider: firstRow.provider,
          model: firstRow.model,
          apiKey: "",
        });
      }

    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const savePlatformSettings = async () => {
    setSaving(true);
    setError("");
    try {
      const data = await llmSettingsService.updateSettings({
        billingMode: "platform",
        monthlyBudget: Number(settings.monthlyBudget),
        warningThresholdPercent: Number(settings.warningThresholdPercent),
        oversubscriptionFactor: Number(settings.oversubscriptionFactor),
        selectedProvider: settings.selectedProvider,
        selectedModel: settings.selectedModel,
        promptPricePer1m: Number(settings.promptPricePer1m || 0),
        completionPricePer1m: Number(settings.completionPricePer1m || 0),
      });
      if (data.status !== "success") {
        throw new Error(data.message || "Failed to save settings");
      }
      setProviderMode("platform");
      if (data.selectedModelPricing) {
        setSettings((prev) => ({
          ...prev,
          promptPricePer1m: String(data.selectedModelPricing.promptPricePer1m),
          completionPricePer1m: String(data.selectedModelPricing.completionPricePer1m),
        }));
        setModelPricing((rows) => {
          const existing = rows.find(
            (row) =>
              row.provider === data.selectedModelPricing.provider &&
              row.model === data.selectedModelPricing.model
          );
          if (existing) {
            return rows.map((row) =>
              row.id === existing.id ? data.selectedModelPricing : row
            );
          }
          return [...rows, data.selectedModelPricing];
        });
      }
      onClose();

    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const saveCustomerSettings = async () => {
    if (!byolEntry.model.trim()) {
      setError("Model is required for customer-managed configuration");
      return;
    }
    if (!isModelInPricing(modelPricing, byolEntry.provider, byolEntry.model)) {
      setError(
        "The selected model is no longer available. Choose a valid model from Model & Pricing before saving."
      );
      return;
    }
    if (!byolEntry.id && !byolEntry.apiKey.trim()) {
      setError("API key is required when creating a customer-managed configuration");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        provider: byolEntry.provider,
        model: byolEntry.model.trim(),
        apiKey: byolEntry.apiKey,
        setAsActive: true,
      };
      let activeByolId = byolEntry.id;
      if (byolEntry.id) {
        await llmSettingsService.updateByolBudget(byolEntry.id, payload);
      } else {
        const data = await llmSettingsService.createByolBudget(payload);
        activeByolId = data.byolBudget.id;
        setByolEntry((prev) => ({ ...prev, id: activeByolId }));
      }

      await llmSettingsService.updateSettings({
        billingMode: "byol",
        activeByolBudgetId: activeByolId,
      });
      setProviderMode("customer");
      onClose();

    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleByolProviderChange = (provider) => {
    const models = modelsForProvider(modelPricing, provider);
    const keepCurrentModel = models.some((row) => row.model === byolEntry.model);
    setByolEntry({
      ...byolEntry,
      provider,
      model: keepCurrentModel ? byolEntry.model : models[0]?.model || "",
    });
  };

  const handleSave = () => {
    if (providerMode === "platform") {
      savePlatformSettings();
    } else {
      saveCustomerSettings();
    }
  };

  const openModelPricing = () => {
    const row = modelPricing.find(
      (item) =>
        item.provider === settings.selectedProvider && item.model === settings.selectedModel
    );
    setPricingEdit(
      row
        ? {
            id: row.id,
            provider: row.provider,
            model: row.model,
            promptPricePer1m: String(row.promptPricePer1m),
            completionPricePer1m: String(row.completionPricePer1m),
          }
        : {
            ...EMPTY_PRICING_EDIT,
            provider: settings.selectedProvider,
            model: settings.selectedModel,
            promptPricePer1m: settings.promptPricePer1m,
            completionPricePer1m: settings.completionPricePer1m,
          }
    );
    setPricingError("");
    setModelPricingOpen(true);
  };

  const selectPricingRow = (row) => {
    setPricingEdit({
      id: row.id ?? null,
      provider: row.provider,
      model: row.model,
      promptPricePer1m: String(row.promptPricePer1m ?? ""),
      completionPricePer1m: String(row.completionPricePer1m ?? ""),
    });
    setPricingError("");
  };

  const setActiveModel = (provider, model) => {
    applyModelPricing(provider, model, modelPricing);
  };

  const startNewPricingEntry = () => {
    setPricingEdit({ ...EMPTY_PRICING_EDIT });
    setPricingError("");
  };

  const savePricingEntry = async () => {
    if (!pricingEdit.model.trim()) {
      setPricingError("Model name is required");
      return;
    }
    setPricingSaving(true);
    setPricingError("");
    try {
      const payload = {
        provider: pricingEdit.provider,
        model: pricingEdit.model.trim(),
        promptPricePer1m: Number(pricingEdit.promptPricePer1m || 0),
        completionPricePer1m: Number(pricingEdit.completionPricePer1m || 0),
      };
      let savedRow;
      if (pricingEdit.id) {
        const data = await llmSettingsService.updateModelPricing(pricingEdit.id, payload);
        if (data.status !== "success") {
          throw new Error(data.message || "Failed to update model pricing");
        }
        savedRow = data.modelPricing;
        setModelPricing((rows) =>
          rows.map((row) => (row.id === savedRow.id ? savedRow : row))
        );
      } else {
        const data = await llmSettingsService.createModelPricing(payload);
        if (data.status !== "success") {
          throw new Error(data.message || "Failed to create model pricing");
        }
        savedRow = data.modelPricing;
        setModelPricing((rows) => {
          const exists = rows.some((row) => row.id === savedRow.id);
          return exists ? rows : [...rows, savedRow];
        });
        setPricingEdit((prev) => ({ ...prev, id: savedRow.id }));
      }
      setActiveModel(savedRow.provider, savedRow.model);
    } catch (err) {
      setPricingError(err.response?.data?.message || err.message || "Failed to save pricing");
    } finally {
      setPricingSaving(false);
    }
  };

  const deletePricingEntry = async (row) => {
    if (!row.id) return;
    setPricingSaving(true);
    setPricingError("");
    try {
      const data = await llmSettingsService.deleteModelPricing(row.id);
      if (data.status !== "success") {
        throw new Error(data.message || "Failed to delete model pricing");
      }
      setModelPricing((rows) => rows.filter((item) => item.id !== row.id));
      if (pricingEdit.id === row.id) {
        setPricingEdit({ ...EMPTY_PRICING_EDIT });
      }
      if (
        settings.selectedProvider === row.provider &&
        settings.selectedModel === row.model
      ) {
        const remaining = modelPricing.filter((item) => item.id !== row.id);
        if (remaining.length > 0) {
          setActiveModel(remaining[0].provider, remaining[0].model);
        }
      }
    } catch (err) {
      setPricingError(err.response?.data?.message || err.message || "Failed to delete pricing");
    } finally {
      setPricingSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-[#111827] rounded-2xl border border-[var(--border)] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">LLM Configurations</h2>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">
              Choose how LLM access is managed and configure budget or credentials.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-[var(--muted)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[var(--muted)]">
              <CircleNotch size={24} className="animate-spin mr-2" />
              Loading settings...
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--muted)]">
                    Active Model
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide">
                      ({providerMode === "platform" ? "Platform" : "Customer"})
                    </span>
                  </p>
                  <p className="text-[13px] font-semibold text-[var(--text)] mt-1 truncate">
                    {activeModelSummary.label}
                  </p>
                  {activeModelSummary.orphaned && (
                    <p className="text-[11px] text-amber-300 mt-1">
                      This model is no longer in Model & Pricing. Select a valid model before
                      saving.
                    </p>
                  )}
                  {activeModelSummary.pricing &&
                    (activeModelSummary.pricing.prompt || activeModelSummary.pricing.completion) && (
                      <p className="text-[11px] text-[var(--muted)] mt-1">
                        Prompt ${Number(activeModelSummary.pricing.prompt || 0).toFixed(4)} /
                        Completion ${Number(activeModelSummary.pricing.completion || 0).toFixed(4)} per
                        1M tokens
                      </p>
                    )}
                </div>
                <button
                  type="button"
                  onClick={openModelPricing}
                  className="shrink-0 px-4 py-2 rounded-xl border border-[var(--border)] bg-white/5 hover:bg-white/10 text-[13px] font-medium text-[var(--text)]"
                >
                  Model & Pricing
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[var(--muted)]">LLM Provider Mode</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      key: "platform",
                      title: "Platform Managed",
                      description: "Use platform API keys, budget controls, and model pricing.",
                    },
                    {
                      key: "customer",
                      title: "Customer Managed",
                      description: "Bring your own LLM provider credentials and model.",
                    },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setProviderMode(option.key)}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        providerMode === option.key
                          ? "border-[var(--primary)] bg-[var(--primary)]/10"
                          : "border-[var(--border)] hover:bg-white/5"
                      }`}
                    >
                      <p className="text-[13px] font-semibold text-[var(--text)]">
                        {option.title}
                      </p>
                      <p className="text-[11px] text-[var(--muted)] mt-1">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {providerMode === "platform" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Monthly Budget (USD)">
                      <input
                        type="number"
                        step="0.01"
                        value={settings.monthlyBudget}
                        onChange={(e) =>
                          setSettings({ ...settings, monthlyBudget: e.target.value })
                        }
                        className={inputClass()}
                      />
                    </Field>

                    <Field label="Warning Threshold (%)" hint="Notify admins when spend reaches this percentage of the monthly budget.">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={settings.warningThresholdPercent}
                        onChange={(e) =>
                          setSettings({ ...settings, warningThresholdPercent: e.target.value })
                        }
                        className={inputClass()}
                      />
                    </Field>

                    <Field label="Oversubscription Factor">
                      <input
                        type="number"
                        step="0.01"
                        value={settings.oversubscriptionFactor}
                        onChange={(e) =>
                          setSettings({ ...settings, oversubscriptionFactor: e.target.value })
                        }
                        className={inputClass()}
                      />
                    </Field>

                    <Field label="Current Spend (USD)">
                      <input
                        type="text"
                        readOnly
                        value={
                          platformBudget
                            ? `$${Number(platformBudget.currentSpend).toFixed(2)}`
                            : "$0.00"
                        }
                        className={inputClass("opacity-70 cursor-not-allowed")}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {providerMode === "customer" && (
                <div className="space-y-4">
                  {byolModelOrphaned && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
                      The saved model is no longer available in Model & Pricing. Choose a valid
                      model before saving again.
                    </div>
                  )}

                  {pricingProviders.length === 0 && !byolEntry.provider ? (
                    <div className="rounded-lg border border-[var(--border)] px-3 py-4 text-[13px] text-[var(--muted)]">
                      No models are configured yet. Add models in Model & Pricing before setting up
                      customer-managed access.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Provider">
                        <select
                          value={byolEntry.provider}
                          onChange={(e) => handleByolProviderChange(e.target.value)}
                          className={inputClass()}
                        >
                          {byolProviderOptions.map((provider) => (
                            <option key={provider} value={provider}>
                              {providerLabel(provider)}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field
                        label="Model"
                        hint="Models are sourced from Model & Pricing for accurate cost tracking."
                      >
                        <select
                          value={byolEntry.model}
                          onChange={(e) =>
                            setByolEntry({ ...byolEntry, model: e.target.value })
                          }
                          className={inputClass()}
                        >
                          {byolModelOrphaned && (
                            <option value={byolEntry.model}>
                              {byolEntry.model} (unavailable)
                            </option>
                          )}
                          {!byolEntry.model && (
                            <option value="">Select a model</option>
                          )}
                          {byolModelsForProvider.map((row) => (
                            <option key={row.id ?? modelKey(row.provider, row.model)} value={row.model}>
                              {row.model}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="API Key" hint="Stored securely. Leave blank to keep the existing key.">
                        <input
                          type="password"
                          placeholder={byolEntry.id ? "Enter new key to replace existing" : "API key"}
                          value={byolEntry.apiKey}
                          onChange={(e) => setByolEntry({ ...byolEntry, apiKey: e.target.value })}
                          className={inputClass("md:col-span-2")}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] text-[var(--muted)] hover:bg-white/5"
          >
            Close
          </button>
          {!loading && (
            <button
              onClick={handleSave}
              disabled={
                saving ||
                (providerMode === "customer" &&
                  (pricingProviders.length === 0 ||
                    byolModelOrphaned ||
                    !byolEntry.model.trim()))
              }
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[13px] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {modelPricingOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModelPricingOpen(false);
          }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden bg-[#111827] rounded-2xl border border-[var(--border)] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">Model & Pricing</h3>
                <p className="text-[12px] text-[var(--muted)] mt-0.5">
                  Choose an active model or add and edit per-model token pricing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModelPricingOpen(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-[var(--muted)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {pricingError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
                  {pricingError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                    <p className="text-[13px] font-medium text-[var(--text)]">Models</p>
                    <button
                      type="button"
                      onClick={startNewPricingEntry}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-[var(--text)] hover:bg-white/5"
                    >
                      <Plus size={14} />
                      Add model
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
                    {modelPricing.length === 0 && (
                      <p className="px-4 py-6 text-[12px] text-[var(--muted)] text-center">
                        No models yet. Add one to configure pricing.
                      </p>
                    )}
                    {modelPricing.map((row) => {
                      const isActive = selectedModelKey === modelKey(row.provider, row.model);
                      const isEditing =
                        pricingEdit.id === row.id ||
                        (!pricingEdit.id &&
                          pricingEdit.provider === row.provider &&
                          pricingEdit.model === row.model);
                      return (
                        <div
                          key={row.id ?? modelKey(row.provider, row.model)}
                          className={`px-4 py-3 transition-colors ${
                            isEditing ? "bg-[var(--primary)]/10" : "hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => selectPricingRow(row)}
                              className="min-w-0 text-left flex-1"
                            >
                              <p className="text-[13px] font-medium text-[var(--text)] truncate">
                                {providerLabel(row.provider)} — {row.model}
                              </p>
                              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                                ${Number(row.promptPricePer1m).toFixed(4)} prompt / $
                                {Number(row.completionPricePer1m).toFixed(4)} completion
                              </p>
                              {isActive && (
                                <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wide text-[var(--primary)] font-semibold">
                                  Active
                                </span>
                              )}
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => setActiveModel(row.provider, row.model)}
                                  className="px-2 py-1 rounded-lg text-[11px] text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
                                >
                                  Set active
                                </button>
                              )}
                              {row.id && (
                                <button
                                  type="button"
                                  onClick={() => deletePricingEntry(row)}
                                  disabled={pricingSaving}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                  title="Delete model"
                                >
                                  <Trash size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] p-4 space-y-4">
                  <p className="text-[13px] font-medium text-[var(--text)]">
                    {pricingEdit.id ? "Edit model pricing" : "Add model pricing"}
                  </p>

                  <Field label="Provider">
                    <select
                      value={pricingEdit.provider}
                      onChange={(e) =>
                        setPricingEdit({ ...pricingEdit, provider: e.target.value })
                      }
                      disabled={Boolean(pricingEdit.id)}
                      className={inputClass(pricingEdit.id ? "opacity-70 cursor-not-allowed" : "")}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </Field>

                  <Field label="Model">
                    <input
                      placeholder="e.g. gpt-5.4"
                      value={pricingEdit.model}
                      onChange={(e) => setPricingEdit({ ...pricingEdit, model: e.target.value })}
                      disabled={Boolean(pricingEdit.id)}
                      className={inputClass(pricingEdit.id ? "opacity-70 cursor-not-allowed" : "")}
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Prompt Price ($/1M tokens)">
                      <input
                        type="number"
                        step="0.000001"
                        value={pricingEdit.promptPricePer1m}
                        onChange={(e) =>
                          setPricingEdit({ ...pricingEdit, promptPricePer1m: e.target.value })
                        }
                        className={inputClass()}
                      />
                    </Field>

                    <Field label="Completion Price ($/1M tokens)">
                      <input
                        type="number"
                        step="0.000001"
                        value={pricingEdit.completionPricePer1m}
                        onChange={(e) =>
                          setPricingEdit({
                            ...pricingEdit,
                            completionPricePer1m: e.target.value,
                          })
                        }
                        className={inputClass()}
                      />
                    </Field>
                  </div>

                  <button
                    type="button"
                    onClick={savePricingEntry}
                    disabled={pricingSaving}
                    className="w-full px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[13px] disabled:opacity-60"
                  >
                    {pricingSaving
                      ? "Saving..."
                      : pricingEdit.id
                        ? "Save pricing"
                        : "Add model & set active"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setModelPricingOpen(false)}
                className="px-4 py-2 rounded-xl text-[13px] text-[var(--muted)] hover:bg-white/5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

