// The one doorway for all LLM calls. The rest of the app never knows which company's model is used.
// Recommended: "proxy" = the JiranLink AI server (worker/worker.js on Cloudflare), which holds the key.
// "gemini" / "claude" call the provider straight from the browser: only for a demo on your own laptop,
// because anyone using the app could read the key.

import { CATEGORIES } from "../data/categories";
import type { AiProvider, Config } from "../data/types";
import { AGENT_PROMPT, AGENT_TOOLS, CLASSIFY_PROMPT, DEFAULT_GEMINI_MODEL } from "./spec";

export interface LlmClassification {
  categories: { id: string; score: number }[];
  timeHint: string | null;
  online: boolean;
}

export interface LlmSettings {
  provider: AiProvider;
  model: string;
  apiKey: string;
  proxyUrl?: string;
}

export const DEFAULT_MODELS: Record<Exclude<AiProvider, "none" | "proxy">, string> = {
  // Model names change often. Check the provider's model list and update these if a call fails.
  gemini: DEFAULT_GEMINI_MODEL,
  claude: "claude-haiku-5-5",
};

export const settingsFrom = (cfg: Config): LlmSettings => ({ provider: cfg.aiProvider, model: cfg.aiModel, apiKey: cfg.aiKey, proxyUrl: cfg.aiProxyUrl });

/** True when an AI is configured and reachable in principle. */
export function aiReady(cfg: Config | LlmSettings): boolean {
  const s = "aiProvider" in cfg ? settingsFrom(cfg) : cfg;
  if (s.provider === "proxy") return !!s.proxyUrl;
  if (s.provider === "gemini" || s.provider === "claude") return !!s.apiKey;
  return false;
}

/** True when the configured AI can run the assistant (tool calling is wired for the AI server and Gemini). */
export const assistantReady = (cfg: Config) => aiReady(cfg) && cfg.aiProvider !== "claude";

function parseJson(text: string): LlmClassification {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("The AI reply was not JSON.");
  const raw = JSON.parse(text.slice(start, end + 1));
  const valid = new Set(CATEGORIES.map((c) => c.id));
  const categories = (Array.isArray(raw.categories) ? raw.categories : [])
    .filter((c: { id?: unknown; score?: unknown }) => typeof c?.id === "string" && valid.has(c.id as string))
    .map((c: { id: string; score?: number }) => ({ id: c.id, score: Math.max(0, Math.min(1, Number(c.score) || 0)) }))
    .slice(0, 3);
  return { categories, timeHint: typeof raw.timeHint === "string" ? raw.timeHint : null, online: !!raw.online };
}

const textOf = (content: GeminiContent | undefined) => (content?.parts ?? []).map((p) => p.text ?? "").join("");

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || `The AI server returned ${res.status}.`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("The AI took too long to answer.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const proxyBase = (s: LlmSettings) => (s.proxyUrl ?? "").replace(/\/+$/, "");
const geminiUrl = (s: LlmSettings) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model || DEFAULT_GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(s.apiKey)}`;

async function callClaude(text: string, s: LlmSettings): Promise<LlmClassification> {
  const model = s.model || DEFAULT_MODELS.claude;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": s.apiKey,
      "anthropic-version": "2023-06-01",
      // Needed for direct browser calls in a demo. Use the AI server in production.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: 300, temperature: 0, system: CLASSIFY_PROMPT, messages: [{ role: "user", content: text }] }),
  });
  if (!res.ok) throw new Error(`Claude returned ${res.status}. Check the API key and model name.`);
  const data = await res.json();
  return parseJson((data?.content ?? []).map((b: { text?: string }) => b.text ?? "").join(""));
}

/** Classify a search with the configured LLM. Returns null when no AI is configured. */
export async function classifyWithLlm(text: string, s: LlmSettings): Promise<LlmClassification | null> {
  if (!aiReady(s)) return null;
  if (s.provider === "proxy") {
    const data = await postJson(`${proxyBase(s)}/classify`, { text }, 15000);
    return parseJson(textOf(data.content));
  }
  if (s.provider === "gemini") {
    const data = await postJson(geminiUrl(s), {
      systemInstruction: { parts: [{ text: CLASSIFY_PROMPT }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { responseMimeType: "application/json" },
    }, 15000);
    return parseJson(textOf(data?.candidates?.[0]?.content));
  }
  return callClaude(text, s);
}

// ---------- Assistant (tool calling) ----------

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thoughtSignature?: string;
  thought?: boolean;
}
export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/** One model turn of the assistant. The caller runs any tools the model asks for and calls again. */
export async function agentTurn(contents: GeminiContent[], s: LlmSettings, timeoutMs = 25000): Promise<GeminiContent> {
  if (s.provider === "proxy") {
    const data = await postJson(`${proxyBase(s)}/agent`, { contents }, timeoutMs);
    if (!data?.content) throw new Error("The AI server sent an empty answer.");
    return data.content as GeminiContent;
  }
  if (s.provider === "gemini") {
    const data = await postJson(geminiUrl(s), {
      systemInstruction: { parts: [{ text: AGENT_PROMPT }] },
      tools: [{ functionDeclarations: AGENT_TOOLS }],
      contents,
    }, timeoutMs);
    const content = data?.candidates?.[0]?.content;
    if (!content) throw new Error("The AI sent an empty answer.");
    return { role: "model", parts: content.parts ?? [] };
  }
  throw new Error("The assistant needs the JiranLink AI server or a Gemini key.");
}

export { parseJson as _parseJsonForTests };
