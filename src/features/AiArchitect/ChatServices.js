/**
 * chatService.js — API layer for AI chat.
 *
 * MOCK MODE (now): simulates AI responses locally.
 * PRODUCTION MODE: Django devs replace ONLY the function bodies below.
 * The shape of request/response never changes — frontend stays untouched.
 *
 * Django endpoint contract:
 *   POST /api/chat/message/
 *   Body: { message: string, sessionId: string, ruleContext?: object }
 *   Response: {
 *     reply: string,          // markdown text for chat bubble
 *     type: string,           // "rule_result" | "info" | "welcome"
 *     module?: string,        // "FI" | "MM" | "SD" | "CO" | "HR" | "PP"
 *     riskScore?: number,     // 0-100
 *     cdsCode?: string,       // full CDS view code string
 *     threshold?: number,     // amount threshold
 *     timeDiff?: number,      // days
 *   }
 *
 *   GET /api/chat/sessions/:sessionId/messages/
 *   Response: [ { id, role, text, type, module, riskScore, cdsCode, timestamp } ]
 *
 *   POST /api/chat/sessions/
 *   Body: { userId?: string }
 *   Response: { sessionId: string }
 *
 * HOW DJANGO DEV CONNECTS OpenAI GPT:
 *   In chat/views.py:
 *     from openai import OpenAI
 *     client = OpenAI()  # reads OPENAI_API_KEY from env
 *
 *     system_prompt = """You are an SAP anomaly detection rule architect.
 *     Parse user input and respond ONLY with valid JSON matching this shape:
 *     {
 *       "reply": "conversational markdown response",
 *       "type": "rule_result",
 *       "module": "FI",
 *       "riskScore": 75,
 *       "cdsCode": "define view ...",
 *       "threshold": 50000,
 *       "timeDiff": 7
 *     }
 *     If user asks what you can do, set type to "info" and omit rule fields.
 *     """
 *
 *     response = client.chat.completions.create(
 *       model="gpt-4o",
 *       messages=[{"role":"system","content":system_prompt}, ...history, {"role":"user","content":message}],
 *       response_format={"type":"json_object"}
 *     )
 *     return JsonResponse(json.loads(response.choices[0].message.content))
 */

// ─── Session management ───────────────────────────────────────────────────────

const SESSION_KEY = "sap_chat_session_id";

export function getOrCreateSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// ─── Chat history (mock: sessionStorage; prod: backend DB) ───────────────────

const HISTORY_KEY = "sap_chat_history";

export function loadChatHistory() {
  // PROD: replace with → GET /api/chat/sessions/${getOrCreateSessionId()}/messages/
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveChatHistory(messages) {
  // PROD: no-op here — backend saves on each sendMessage call
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  } catch {}
}

export function clearChatHistory() {
  sessionStorage.removeItem(HISTORY_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Send message ─────────────────────────────────────────────────────────────

/**
 * sendMessage — send user text to AI, get structured response back.
 *
 * PROD replacement (Django devs change ONLY this function body):
 *
 *   export async function sendMessage({ message, sessionId, ruleContext }) {
 *     const res = await fetch("/api/chat/message/", {
 *       method: "POST",
 *       headers: {
 *         "Content-Type": "application/json",
 *         "X-CSRFToken": getCookie("csrftoken"),
 *       },
 *       body: JSON.stringify({ message, sessionId, ruleContext }),
 *     });
 *     if (!res.ok) throw new Error("Chat API error");
 *     return res.json();
 *     // returns: { reply, type, module, riskScore, cdsCode, threshold, timeDiff }
 *   }
 */
export async function sendMessage({ message, sessionId, ruleContext }) {
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

  try {
    const res = await fetch("http://localhost:8000/sap/rule-agent/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
         sessionId: sessionId,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Backend error");
    }

    // 🧠 Convert backend → UI format
    const aiText = data.reply || "I've processed your request.";

    const isRuleReady = data.type === "rule_result";

    return {
      type: isRuleReady ? "rule_result" : "info",

      // reply: removeCodeBlocks(aiText),
      reply: aiText,

      module: data.module || detectModule(data.intent),

      riskScore: data.riskScore ?? estimateRisk(data),

      cdsCode: data.cdsCode || "",

      cdsCodeFilename: data.cdsCodeFilename || "",

      cdsBaseinfo: data.cdsBaseinfo || "",

      cdsBaseinfoFilename: data.cdsBaseinfoFilename || "",

      cdsSrvd: data.cdsSrvd || "",

      cdsSrvdFilename: data.cdsSrvdFilename || "",

      cdsSrvdSrvdsrv: data.cdsSrvdSrvdsrv || "",

      cdsSrvdSrvdsrvFilename: data.cdsSrvdSrvdsrvFilename || "",

      cdsSrvb: data.cdsSrvb || "",

      cdsSrvbFilename: data.cdsSrvbFilename || "",

      cdsSrvbXml: data.cdsSrvbXml || "",

      cdsG4ba: data.cdsG4ba || "",

      cdsG4baFilename: data.cdsG4baFilename || "",

      cdsXml: data.cdsXml || "",

      cdsXmlFilename: data.cdsXmlFilename || "",

      dynamicParameters: normalizeDynamicParameters(
        data.dynamicParameters || data.parameters || data.PARAMETERS || {}
      ),

      threshold: data.threshold ?? extractAmount(message),

      timeDiff: data.timeDiff ?? extractDays(message),
    };

  } catch (err) {
    console.error("❌ Chat API Error:", err);
    return {
      type: "info",
      reply: "⚠️ Unable to connect to AI service. Please try again.",
    };
  }
}

function detectModule(intent = "") {
  const t = intent.toLowerCase();

  if (t.includes("invoice") || t.includes("fi")) return "FI";
  if (t.includes("vendor") || t.includes("mm")) return "MM";
  if (t.includes("sales") || t.includes("sd")) return "SD";
  if (t.includes("cost") || t.includes("co")) return "CO";
  if (t.includes("employee") || t.includes("hr")) return "HR";

  return "FI";
}

function extractAmount(text = "") {
  const match = text.match(/\$?([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, "")) : 50000;
}

function extractDays(text = "") {
  const match = text.match(/(\d+)\s*days?/i);
  return match ? parseInt(match[1]) : 7;
}

function estimateRisk(data) {
  // If backend later sends risk → use it
  if (data.risk_score) return data.risk_score;

  // fallback logic
  return data.approved ? 75 : 50;
}

// function removeCodeBlocks(text = "") {
//   return text.replace(/```[\s\S]*?```/g, "").trim();
// }