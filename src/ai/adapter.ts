// The one doorway for all LLM calls. The rest of the app never knows which company's model is used.
// Switch provider in Admin > Settings (or VITE_AI_PROVIDER). In production, move these calls to a
// server function so the API key is never exposed to the browser.

import { CATEGORIES } from "../data/categories";
import type { AiProvider } from "../data/types";

export interface LlmClassification {
  categories: { id: string; score: number }[];
  timeHint: string | null;
  online: boolean;
}

export interface LlmSettings {
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export const DEFAULT_MODELS: Record<Exclude<AiProvider, "none">, string> = {
  // Model names change often. Check the provider's model list and update these if a call fails.
  gemini: "gemini-2.5-flash",
  claude: "claude-haiku-5-5",
};

const CATEGORY_LIST = CATEGORIES.map((c) => `${c.id}: ${c.name}`).join("\n");

const SYSTEM_PROMPT = `You classify short service requests from residents of Malaysian housing townships.
Requests may be in English, Bahasa Malaysia, Chinese, or Manglish, and may describe a problem instead of naming a service.
Pick up to 3 categories from this list only, with a confidence score from 0 to 1 for each:
${CATEGORY_LIST}
Also extract any time preference as short English text (e.g. "Saturday morning"), or null.
Set online to true only if the person asks for an online or remote service.
Never invent categories. Reply with JSON only, in this shape:
{"categories":[{"id":"plumbing","score":0.9}],"timeHint":null,"online":false}`;

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

async function callGemini(text: string, s: LlmSettings): Promise<LlmClassification> {
  const model = s.model || DEFAULT_MODELS.gemini;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(s.apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini returned ${res.status}. Check the API key and model name.`);
  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return parseJson(out);
}

async function callClaude(text: string, s: LlmSettings): Promise<LlmClassification> {
  const model = s.model || DEFAULT_MODELS.claude;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": s.apiKey,
      "anthropic-version": "2023-06-01",
      // Needed for direct browser calls in a demo. Use a server route in production.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: 300, temperature: 0, system: SYSTEM_PROMPT, messages: [{ role: "user", content: text }] }),
  });
  if (!res.ok) throw new Error(`Claude returned ${res.status}. Check the API key and model name.`);
  const data = await res.json();
  const out = (data?.content ?? []).map((b: { text?: string }) => b.text ?? "").join("");
  return parseJson(out);
}

/** Classify with the configured LLM. Returns null when no provider is configured. */
export async function classifyWithLlm(text: string, s: LlmSettings): Promise<LlmClassification | null> {
  if (s.provider === "none" || !s.apiKey) return null;
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("The AI took too long to answer.")), 8000));
  const call = s.provider === "gemini" ? callGemini(text, s) : callClaude(text, s);
  return Promise.race([call, timeout]);
}

export { parseJson as _parseJsonForTests };
