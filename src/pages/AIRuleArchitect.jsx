/**
 * AIRuleArchitect.jsx — AI-powered conversational rule creation.
 * Route: /architect
 *
 * FIXES:
 * 1. All AI logic moved to src/api/chatService.js — zero hardcoded functions here
 * 2. Chat history uses chatService (sessionStorage now, DB later — swap one file)
 * 3. Modify mode: reads ruleId from BOTH location.state AND ?ruleId= query param
 * 4. Modify mode: auto-injects AI message showing current rule params on load
 * 5. Create mode: navigates correctly and resets chat
 * 6. addGeneratedRule / updateGeneratedRule dispatched correctly to rulesSlice
 * 7. DONT TOUCH UI — layout, colors, bubbles, avatars all unchanged
 */

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import Sidebar from "../components/layout/Sidebar";
import Topbar  from "../components/layout/Topbar";
import {
  sendMessage as apiSendMessage,
  loadChatHistory,
  saveChatHistory,
  getOrCreateSessionId,
} from "../features/AiArchitect/ChatServices";
import {
  PaperPlaneTilt, Robot, User, Sparkle, Code,
  CaretDown, CaretUp, CircleNotch, Plus,
  Lightning, CheckCircle, ArrowRight,
} from "@phosphor-icons/react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SAP_MODULE_NAMES = {
  FI: "Financial Accounting (FI)",
  MM: "Materials Management (MM)",
  SD: "Sales & Distribution (SD)",
  CO: "Controlling (CO)",
  HR: "Human Resources (HR)",
  PP: "Production Planning (PP)",
};

const QUICK_REPLIES = {
  "Example: Invoice timing":
    "Flag all invoices over $50,000 where posting date is more than 7 days after document date",
  "Example: Duplicate detection":
    "Detect duplicate vendor invoices with the same amount within 30 days in MM module",
  "What can you do?":
    "What kind of SAP anomaly detection rules can you create?",
};

const INITIAL_MSG = {
  id: "init",
  role: "ai",
  type: "welcome",
  text: "Hello! I'm your AI Rule Architect assistant. I'll help you create custom anomaly detection rules for your SAP system using natural language. Just describe what kind of pattern or anomaly you want to detect, and I'll guide you through the process. What rule would you like to create?",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

const normalizeDynamicParameters = (raw) => {
  if (!raw) return {};
  let parsed = raw;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return {}; }
  }
  if (typeof parsed !== "object") return {};
  if (Array.isArray(parsed)) return { LIST: parsed };
  if (parsed.PARAMETERS && typeof parsed.PARAMETERS === "object") return parsed.PARAMETERS;
  return parsed;
};

// ─── Markdown renderer ────────────────────────────────────────────────────────
function Markdown({ text }) {
  return (
    <div className="space-y-0.5">
      {text.split("\n").map((line, i) => {
        const parts    = line.split(/\*\*(.+?)\*\*/g);
        const rendered = parts.map((p, j) =>
          j % 2 === 1
            ? <strong key={j} className="text-white font-semibold">{p}</strong>
            : <span key={j}>{p}</span>
        );
        if (line.startsWith("- ") || line.startsWith("• ")) {
          const cleanLine = line.replace(/^[-•]\s*/, "");

          const bulletParts = cleanLine.split(/\*\*(.+?)\*\*/g);

          const bulletRendered = bulletParts.map((p, j) =>
            j % 2 === 1
              ? <strong key={j} className="text-white font-semibold">{p}</strong>
              : <span key={j}>{p}</span>
          );

          return (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="text-blue-400 mt-1 flex-shrink-0 text-[10px]">●</span>
              <span>{bulletRendered}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return <div key={i} className="py-0.5">{rendered}</div>;
      })}
    </div>
  );
}

// ─── CDS toggle block ─────────────────────────────────────────────────────────
function CDSBlock({ code }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border border-[var(--border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#0f1520] hover:bg-[#131c2e] transition-colors text-left"
      >
        <Code size={13} className="text-blue-400" />
        <span className="text-[12px] font-semibold text-blue-400">
          {open ? "Hide" : "View"} Generated CDS Code
        </span>
        {open
          ? <CaretUp size={12} className="text-blue-400 ml-auto" />
          : <CaretDown size={12} className="text-blue-400 ml-auto" />}
      </button>
      {open && (
        <div className="overflow-x-auto bg-[#060b12]">
          <pre className="text-[11px] text-emerald-300 font-mono p-4 leading-relaxed whitespace-pre">{code}</pre>
        </div>
      )}
    </div>
  );
}

// ─── Message components ───────────────────────────────────────────────────────
function AiMessage({ msg }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-600/25 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Robot size={15} weight="fill" className="text-blue-400" />
      </div>
      <div className="flex-1 max-w-[760px]">
        <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl rounded-tl-sm px-5 py-4">
          <div className="text-[13px] text-[#a0aec0] leading-relaxed">
            <Markdown text={msg.text} />
          </div>
          {msg.type === "rule_result" && msg.cds && (
            <>
              <div className="mt-3 flex items-center gap-6 px-4 py-2.5 rounded-lg bg-[#0f1520] border border-[#1e2d40]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Module:</span>
                  <span className="text-[12px] font-bold text-blue-300">{msg.module}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-[#4a5568] uppercase tracking-widest">Risk:</span>
                  <span className={`text-[12px] font-bold ${msg.riskScore >= 75 ? "text-red-400" : msg.riskScore >= 50 ? "text-amber-400" : "text-green-400"}`}>
                    {msg.riskScore}
                  </span>
                </div>
              </div>
              <CDSBlock code={msg.cds} />
            </>
          )}
        </div>
        <p className="text-[10px] text-[#4a5568] mt-1.5 pl-1">{msg.timestamp}</p>
      </div>
    </div>
  );
}

function UserMessage({ msg }) {
  return (
    <div className="flex items-start gap-3 flex-row-reverse">
      <div className="w-8 h-8 rounded-full bg-[#2d3748] border border-[#3d4a5c] flex items-center justify-center flex-shrink-0 mt-0.5">
        <User size={14} className="text-[#718096]" />
      </div>
      <div className="flex-1 max-w-[680px] flex flex-col items-end">
        <div className="bg-[#174dc0] rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-lg shadow-blue-900/30">
          <p className="text-[13px] text-white leading-relaxed">{msg.text}</p>
        </div>
        <p className="text-[10px] text-[#4a5568] mt-1.5 pr-1">{msg.timestamp}</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-blue-600/25 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Robot size={15} weight="fill" className="text-blue-400" />
      </div>
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl rounded-tl-sm px-5 py-4">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AIRuleArchitect() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const dispatch      = useDispatch();
  const rulesAll      = useSelector(s => s.rules.list);
  const [searchParams] = useSearchParams();

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages,   setMessages]   = useState(() => loadChatHistory() || [INITIAL_MSG]);
  const [input,      setInput]      = useState("");
  const [typing,     setTyping]     = useState(false);
  const [lastRule,   setLastRule]   = useState(null);
  const [savedToLib, setSavedToLib] = useState(false);
  const [modifyMode, setModifyMode] = useState(null); // { ruleId, ruleName, rule }
  const [sessionId]                 = useState(getOrCreateSessionId);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Persist chat to sessionStorage (chatService handles it)
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  // Auto-scroll
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // ── Handle navigation state (from Rule Library "Create" or "Modify") ───────
  useEffect(() => {
    const state      = location.state;
    // Also support ?ruleId= query param (from ActionBar Modify button)
    const qRuleId    = searchParams.get("ruleId");

    // ── MODIFY via query param (ActionBar: navigate(`/architect?ruleId=${id}`)) ──
    if (qRuleId && !state?.mode) {
      const rule = rulesAll.find(r => r.id === qRuleId);
      if (!rule) return;

      setModifyMode({ ruleId: rule.id, ruleName: rule.name, rule });
      setSavedToLib(false);

      const threshold = rule.thresholds?.amountThreshold || 50000;
      const timeDiff  = rule.thresholds?.timeWindow       || 7;
      const riskScore = rule.thresholds?.riskScore
        || (rule.risk === "HIGH" ? 75 : rule.risk === "MEDIUM" ? 55 : 40);

      const editMsg = {
        id:        `edit-init-${Date.now()}`,
        role:      "ai",
        type:      "rule_result",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `I've loaded the rule **"${rule.name}"** for editing. Here are its current parameters:\n\n📊 **SAP Module**: ${rule.module}\n💰 **Amount Threshold**: $${threshold.toLocaleString()}\n📅 **Days Difference**: ${timeDiff} days\n⚠️ **Risk Score**: ${riskScore}/100\n\nYou can modify any of these parameters by describing what you'd like to change. For example:\n- "Change the amount threshold to $100,000"\n- "Set the risk score to 85"\n- "Make it check for 14 days instead"\n\nWhat would you like to modify?`,
        module:    rule.module,
        riskScore: riskScore,
        cds:       rule.cdsCode || "",
      };

      setMessages([INITIAL_MSG, editMsg]);
      // Pre-set lastRule so "Update Rule Library" button works immediately
      setLastRule({
        module:     rule.module,
        moduleName: SAP_MODULE_NAMES[rule.module] || rule.module,
        threshold,
        timeDiff,
        riskScore,
        cds:        rule.cdsCode || "",
      });

      setInput(`I want to modify the "${rule.name}" rule — `);
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    // ── MODIFY via location.state (legacy path) ───────────────────────────────
    if (state?.mode === "modify" && state.ruleName) {
      const rule = rulesAll.find(r => r.id === state.ruleId) || {};
      setModifyMode({ ruleId: state.ruleId, ruleName: state.ruleName, rule });
      setSavedToLib(false);

      const threshold = state.threshold || rule.thresholds?.amountThreshold || 50000;
      const timeDiff  = rule.thresholds?.timeWindow || 7;
      const riskScore = rule.thresholds?.riskScore
        || (rule.risk === "HIGH" ? 75 : rule.risk === "MEDIUM" ? 55 : 40);

      const editMsg = {
        id:        `edit-init-${Date.now()}`,
        role:      "ai",
        type:      "rule_result",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `I've loaded the rule **"${state.ruleName}"** for editing. Here are its current parameters:\n\n📊 **SAP Module**: ${state.module || rule.module || "FI"}\n💰 **Amount Threshold**: $${threshold.toLocaleString()}\n📅 **Days Difference**: ${timeDiff} days\n⚠️ **Risk Score**: ${riskScore}/100\n\nYou can modify any of these parameters by describing what you'd like to change. For example:\n- "Change the amount threshold to $100,000"\n- "Set the risk score to 85"\n- "Make it check for 14 days instead"\n\nWhat would you like to modify?`,
        module:    state.module || rule.module || "FI",
        riskScore: riskScore,
        cds:       rule.cdsCode || "",
      };

      setMessages([INITIAL_MSG, editMsg]);
      setLastRule({
        module:     state.module || rule.module || "FI",
        moduleName: SAP_MODULE_NAMES[state.module || rule.module] || "Financial Accounting (FI)",
        threshold,
        timeDiff,
        riskScore,
        cds:        rule.cdsCode || "",
      });

      setInput(`I want to modify the "${state.ruleName}" rule — `);
      setTimeout(() => inputRef.current?.focus(), 100);
      window.history.replaceState({}, "");
      return;
    }

    // ── CREATE mode ───────────────────────────────────────────────────────────
    if (state?.mode === "create") {
      setModifyMode(null);
      setSavedToLib(false);
      setMessages([INITIAL_MSG]);
      setLastRule(null);
      const prefill = state.template
        ? `Create a new ${state.template} detection rule for ${state.module || "SAP"} module`
        : "I want to create a new SAP anomaly detection rule";
      setInput(prefill);
      setTimeout(() => inputRef.current?.focus(), 100);
      window.history.replaceState({}, "");
    }
  }, [location.state, searchParams, rulesAll]);

  // ── addMessage helper ───────────────────────────────────────────────────────
  const addMessage = useCallback(msg => {
    const m = {
      id:        `msg-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ...msg,
    };
    setMessages(p => [...p, m]);
    return m;
  }, []);

  // ── Send message → chatService (mock now, real API later) ──────────────────
  const sendMessage = useCallback(async text => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setInput("");
    addMessage({ role: "user", text: trimmed, type: "user" });
    setTyping(true);

    try {
      const resp = await apiSendMessage({
        message:     trimmed,
        sessionId,
        ruleContext: modifyMode?.rule
          ? {
              module:    modifyMode.rule.module,
              threshold: modifyMode.rule.thresholds?.amountThreshold,
              timeDiff:  modifyMode.rule.thresholds?.timeWindow,
            }
          : null,
      });

      setTyping(false);

      // Remove CDS block from reply text if cdsCode exists
        let cleanReply = resp.reply || "";

        if (resp.cdsCode) {
          cleanReply = cleanReply
            .replace(/```abap[\s\S]*?```/gi, "")
            .trim();
        }

        const added = addMessage({
          role: "ai",
          type: resp.type || "info",
          text: cleanReply,
          module: resp.module,
          riskScore: resp.riskScore,
          cds: resp.cdsCode,
          cdsBaseinfo: resp.cdsBaseinfo,
          cdsXml: resp.cdsXml,
          cdsSrvd: resp.cdsSrvd,
          cdsSrvb: resp.cdsSrvb,
          dynamicParameters: resp.dynamicParameters || {},
        });

      if (resp.type === "rule_result") {
        console.log("API Response:", resp); // Debug log
        setLastRule({
          module:     resp.module,
          moduleName: SAP_MODULE_NAMES[resp.module] || resp.module,
          threshold:  resp.threshold,
          timeDiff:   resp.timeDiff,
          riskScore:  resp.riskScore,
          cds:        resp.cdsCode,
          cdsBaseinfo:   resp.cdsBaseinfo,
          cdsXml:        resp.cdsXml,
          cdsSrvd:       resp.cdsSrvd,
          cdsSrvb:       resp.cdsSrvb,
          dynamicParameters: resp.dynamicParameters || {},
          msgId:      added.id,
        });
        setSavedToLib(false);
      }
    } catch {
      setTyping(false);
      addMessage({
        role: "ai",
        type: "info",
        text: "Sorry, I encountered an error. Please try again.",
      });
    }
  }, [typing, addMessage, sessionId, modifyMode]);

  const handleKey = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

 const handleSaveToLibrary = useCallback(async () => {
  const currentRule = lastRule || (() => {
    const message = [...messages].reverse().find(m => m.type === "rule_result");
    console.log("Deriving current rule from message:", message); // Debug log
    if (!message) return null;
    return {
      module: message.module || "FI",
      moduleName: SAP_MODULE_NAMES[message.module] || message.module || "Financial Accounting (FI)",
      threshold: message.threshold ?? message.amountThreshold ?? 50000,
      timeDiff: message.timeDiff ?? 7,
      riskScore: message.riskScore ?? 0,
      cds: message.cds || message.cdsCode || "",
      cdsBaseinfo: message.cdsBaseinfo || "",
      cdsXml: message.cdsXml || "",
      cdsSrvd: message.cdsSrvd || "",
      cdsSrvb: message.cdsSrvb || "",
      dynamicParameters: normalizeDynamicParameters(
        message.dynamicParameters || message.parameters || message.PARAMETERS || {}
      ),
    };
  })();

  const latestRuleMessage = [...messages].reverse().find(m => m.type === "rule_result");
  const resolvedDynamicParameters = normalizeDynamicParameters(
    currentRule?.dynamicParameters ||
    // latestRuleMessage?.dynamicParameters ||
    // latestRuleMessage?.parameters ||
    // latestRuleMessage?.PARAMETERS ||
    {}
  );

  console.log("Current Rule for saving:", currentRule); // Debug log

  if (!currentRule) {
    addMessage({
      role: "ai",
      type: "info",
      text: "I could not determine the generated rule. Please try generating the rule again before saving.",
    });
    return;
  }

  const newRule = {
      id: `RULE-AI-${Date.now()}`,

      name: `AI: ${currentRule.moduleName} Anomaly Rule`,

      description:
        `AI-generated rule: flags transactions in ${currentRule.moduleName} ` +
        `over $${currentRule.threshold?.toLocaleString()} ` +
        `with ${currentRule.timeDiff}+ day posting delay`,

      module: currentRule.module,

      status: "DRAFT",
      lifecycle: "DRAFT",

      risk:
        currentRule.riskScore >= 75
          ? "HIGH"
          : currentRule.riskScore >= 50
          ? "MEDIUM"
          : "LOW",

      version: "1.0.0",

      origin: "AI Architect",
      createdBy: "AI Architect",

      thresholds: {
        amountThreshold: currentRule.threshold || 0,
        frequencyLimit: 0,
        timeWindow: currentRule.timeDiff || 0,
        varianceThreshold: 0,
      },
      simulationHistory: [],
      deployedEnv: null,
      activatedAt: null,

      cdsCode: currentRule.cds || currentRule.cdsCode || "",
      cdsBaseinfo: currentRule.cdsBaseinfo || "",
      cdsXml: currentRule.cdsXml || "",
      cdsSrvd: currentRule.cdsSrvd || "",
      cdsSrvb: currentRule.cdsSrvb || "",
      dynamicParameters: resolvedDynamicParameters,
      parameters: resolvedDynamicParameters,

  };

  try {
    setSavedToLib(true);

    console.log("New Rule payload:", newRule); // Debug log

    // ── SAVE TO DJANGO ─────────────────────────────────────────────────────────
    let savedRule = null;
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${API_BASE_URL}/sap/rules/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRule),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== "success") throw new Error(data.message || "Failed to save rule");

    savedRule = {
      ...newRule,
      ...(data.data || {}),
      dynamicParameters:
        normalizeDynamicParameters(data?.data?.dynamicParameters || data?.data?.parameters || {}) ||
        newRule.dynamicParameters,
      parameters:
        normalizeDynamicParameters(data?.data?.parameters || data?.data?.dynamicParameters || {}) ||
        newRule.parameters,
    };

    // ── OPTIONAL: keep redux synced ───────────────
    dispatch({
      type: "rules/addGeneratedRule",
      payload: savedRule,
    });

    addMessage({
      role: "ai",
      type: "info",
      text:
        `✅ Rule added to your Rule Library as a **DRAFT**.\n\n` +
        `Rule ID: **${savedRule.id}**\n` +
        `Module: **${savedRule.module}**\n` +
        `Risk: **${savedRule.risk}**\n\n` +
        `You can now run simulation and deploy the rule.`,
    });

    setTimeout(() => {
      navigate("/rules", {
        state: {
          highlightRuleId: savedRule.id,
        },
      });
    }, 1500);

  } catch (err) {
    console.error("Save Rule Error:", err);
    setSavedToLib(false);

    addMessage({
      role: "ai",
      type: "info",
      text: "⚠️ Failed to save rule to Rule Library.",
    });
  }

}, [lastRule, dispatch, addMessage, navigate]);

  // ── UPDATE RULE LIBRARY ────────────────────────────────────────────────────
  const handleUpdateLibrary = useCallback(() => {
    const currentRule = lastRule || (() => {
      const message = [...messages].reverse().find(m => m.type === "rule_result");
      if (!message) return null;
      return {
        threshold: message.threshold ?? message.amountThreshold ?? 0,
        timeDiff: message.timeDiff ?? 0,
        riskScore: message.riskScore ?? 0,
        cds: message.cds || message.cdsCode || "",
        dynamicParameters: message.dynamicParameters || {},
      };
    })();

    if (!currentRule || !modifyMode) return;
    setSavedToLib(true);

    dispatch({
      type: "rules/updateGeneratedRule",
      payload: {
        id: modifyMode.ruleId,
        changes: {
          thresholds: {
            amountThreshold:   currentRule.threshold  || 0,
            frequencyLimit:    0,
            timeWindow:        currentRule.timeDiff   || 0,
            varianceThreshold: 0,
          },
          risk:    currentRule.riskScore >= 75 ? "HIGH" : currentRule.riskScore >= 50 ? "MEDIUM" : "LOW",
          cdsCode: currentRule.cds || "",
          dynamicParameters: currentRule.dynamicParameters || {},
        },
      },
    });

    addMessage({
      role: "ai",
      type: "info",
      text: `✅ Rule **${modifyMode.ruleName}** has been updated in your Rule Library.\n\nNew threshold: **$${lastRule.threshold?.toLocaleString()}**\nNew time diff: **${lastRule.timeDiff} days**\nRisk level: **${lastRule.riskScore >= 75 ? "HIGH" : lastRule.riskScore >= 50 ? "MEDIUM" : "LOW"}**`,
    });

    setTimeout(() => { navigate("/rules"); }, 1500);
  }, [lastRule, messages, modifyMode, dispatch, addMessage, navigate]);

  const hasRuleResult = messages.some(m => m.type === "rule_result");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar />

        {/* Page header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Robot size={16} weight="fill" className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-[var(--text)]">
                AI Rule Architect{modifyMode ? " — Edit Mode" : ""}
              </h1>
              <p className="text-[11px] text-[var(--muted)]">Conversational rule creation powered by AI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasRuleResult && !savedToLib && (
              modifyMode ? (
                <button
                  onClick={handleUpdateLibrary}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold transition-colors shadow-sm"
                >
                  <ArrowRight size={13} weight="bold" />Update to Rule Library
                </button>
              ) : (
                <button
                  onClick={handleSaveToLibrary}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold transition-colors shadow-sm"
                >
                  <Plus size={13} weight="bold" />Add to Rule Library
                </button>
              )
            )}
            {savedToLib && (
              <span className="flex items-center gap-1.5 text-[12px] text-emerald-400 font-semibold">
                <CheckCircle size={13} weight="fill" />
                {modifyMode ? "Rule updated!" : "Added to Library"}
              </span>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10">
              <Sparkle size={12} weight="fill" className="text-blue-400" />
              <span className="text-[11px] font-semibold text-blue-300">AI-Powered</span>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none", overscrollBehavior: "contain" }}>
          <style>{`.no-bar::-webkit-scrollbar{display:none}`}</style>
          <div className="no-bar">
            <div className="max-w-[900px] mx-auto px-6 py-6 space-y-5">
              {messages.map(m =>
                m.role === "ai"
                  ? <AiMessage key={m.id} msg={m} />
                  : <UserMessage key={m.id} msg={m} />
              )}
              {typing && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg)]">
          <div className="max-w-[900px] mx-auto px-6 py-4">
            <div className="flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-3 focus-within:border-[var(--primary)]/60 transition-colors shadow-sm">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Describe your rule... (e.g., 'Flag all invoices over $50,000 where posting date is more than 7 days after document date')"
                rows={1}
                disabled={typing}
                className="flex-1 bg-transparent text-[13px] text-[var(--text)] placeholder-[var(--muted)] resize-none focus:outline-none leading-relaxed"
                style={{ maxHeight: "120px", overflowY: "auto", scrollbarWidth: "none" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || typing}
                className="w-9 h-9 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0 shadow-md shadow-blue-900/30"
              >
                {typing
                  ? <CircleNotch size={15} className="animate-spin text-white" />
                  : <PaperPlaneTilt size={15} weight="fill" className="text-white" />}
              </button>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {Object.keys(QUICK_REPLIES).map(chip => (
                <button
                  key={chip}
                  onClick={() => sendMessage(QUICK_REPLIES[chip])}
                  disabled={typing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[11px] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--primary)]/40 hover:bg-white/[0.03] transition-all disabled:opacity-50"
                >
                  <Lightning size={11} weight="fill" className="text-blue-400" />
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
