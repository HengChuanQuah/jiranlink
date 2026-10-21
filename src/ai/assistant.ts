// "Ask JiranLink": an assistant that answers from the app's own data.
// The AI decides which tool to use; the app runs the tool on its own data and shows the results.
// Provider cards, help text and booking lists come from the app, never from the AI's wording.

import type { AppState, Booking, User } from "../data/types";
import { categoryById } from "../data/categories";
import { searchProviders, type SearchResult } from "../lib/search";
import { zonesFor } from "../lib/geo";
import { fmtSlot, rm } from "../lib/time";
import { understandFast, thresholdsFrom } from "./agent";
import { agentTurn, assistantReady, settingsFrom, type GeminiContent, type GeminiPart, type LlmSettings } from "./adapter";
import { HELP, type HelpEntry } from "./help";
import { CATEGORY_IDS, HELP_TOPICS, type HelpTopic } from "./spec";

export interface ProviderFinding {
  categoryId: string;
  need: string;
  results: SearchResult[];
  online: SearchResult[];
  reachedLabel: string;
}

export interface BookingLine {
  id: string;
  title: string;
  when: string;
  waitingFor: string;
}

export interface AssistantReply {
  text: string;
  providers?: ProviderFinding;
  help?: HelpEntry & { topic: HelpTopic };
  bookings?: BookingLine[];
  draft?: string;
  toolCalls: { name: string; args: Record<string, unknown> }[];
  mode: "ai" | "quick";
  note?: string;
  /** Why the quick answer was used (AI too slow or unavailable). For tests and the township team's AI check; residents don't see it. */
  fallbackReason?: string;
  /** Turns to keep for follow-up questions (text only). */
  history: GeminiContent[];
}

interface Ctx {
  s: AppState;
  me: User;
}

// ---------- Tools (run by the app, on the app's data) ----------

function pickCategory(need: string, categoryId: unknown, s: AppState): string | null {
  if (typeof categoryId === "string" && CATEGORY_IDS.includes(categoryId)) return categoryId;
  const r = understandFast(need, thresholdsFrom(s.config));
  if (r.decision.kind === "confident") return r.decision.categoryId;
  if (r.decision.kind === "ambiguous") return r.decision.categoryIds[0];
  return r.scores[0] && r.scores[0].score >= 0.3 ? r.scores[0].id : null;
}

function describe(r: SearchResult) {
  return {
    name: r.provider.displayName,
    service: r.service.title,
    where: r.ring < 0 ? "Online" : r.ringLabel,
    rating: r.stats.totalCount ? Number(r.stats.displayAvg.toFixed(1)) : null,
    reviews: r.stats.totalCount,
    price: r.service.priceMin === r.service.priceMax ? rm(r.service.priceMin) : `${rm(r.service.priceMin)} to ${rm(r.service.priceMax)} ${r.service.priceUnit}`,
    new_provider: r.stats.isNew,
    intro_offer: r.provider.introOffer ?? null,
  };
}

export function toolFindProviders(ctx: Ctx, args: Record<string, unknown>): { response: Record<string, unknown>; finding?: ProviderFinding } {
  const need = String(args.need ?? "").slice(0, 300);
  const cat = pickCategory(need, args.category_id, ctx.s);
  if (!cat) return { response: { providers: [], note: "Could not match this to a JiranLink service category." } };
  const out = searchProviders(ctx.s, { resident: ctx.me, categoryIds: [cat] });
  const results = [...out.results.slice(0, 3), ...(out.exception ? [out.exception] : [])];
  const online = out.online.slice(0, 2);
  const finding: ProviderFinding = { categoryId: cat, need, results, online, reachedLabel: out.reachedLabel };
  return {
    response: {
      category: categoryById(cat)?.name ?? cat,
      searched_up_to: out.reachedLabel,
      providers: results.map(describe),
      online_providers: online.map(describe),
      more_available: Math.max(0, out.results.length - 3),
      hidden_below_quality_floor: out.hiddenBelowFloor,
    },
    finding: results.length || online.length ? finding : { ...finding, results: [], online: [] },
  };
}

export function toolGetHelp(args: Record<string, unknown>): { response: Record<string, unknown>; help?: HelpEntry & { topic: HelpTopic } } {
  const topic = String(args.topic ?? "") as HelpTopic;
  if (!HELP_TOPICS.includes(topic)) return { response: { error: `Unknown topic. Use one of: ${HELP_TOPICS.join(", ")}` } };
  const h = HELP[topic];
  return { response: { title: h.title, text: h.text, buttons: h.actions.map((a) => a.label) }, help: { ...h, topic } };
}

const WAITING: Record<string, (b: Booking) => string> = {
  requested: (b) => (b.proposedStart ? "The provider proposed a new time. Accept it or cancel." : "Waiting for the provider to reply."),
  accepted: () => "Accepted. You need to confirm and choose how to pay.",
  confirmed: (b) => (b.doneByResident ? "Waiting for the provider to tap Job done." : "Confirmed. Tap Job done after the job."),
  completed: (b) => (b.payment === "due" ? `Done. ${rm(b.price - b.amountPaid)} is due before you can book again.` : "Done. You can leave a review."),
};

export function toolMyBookings(ctx: Ctx): { response: Record<string, unknown>; bookings: BookingLine[] } {
  const mine = ctx.s.bookings
    .filter((b) => b.residentId === ctx.me.id && WAITING[b.status])
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);
  const lines = mine.map((b) => {
    const p = ctx.s.providers.find((x) => x.id === b.providerId);
    const svc = ctx.s.services.find((x) => x.id === b.serviceId);
    return { id: b.id, title: `${svc?.title ?? "Service"} with ${p?.displayName ?? "provider"}`, when: fmtSlot(b.start, b.end), waitingFor: WAITING[b.status](b) };
  });
  return { response: { bookings: lines.map(({ title, when, waitingFor }) => ({ booking: title, when, status: waitingFor })) }, bookings: lines };
}

export function toolDraftRequest(args: Record<string, unknown>): { response: Record<string, unknown>; draft: string } {
  const draft = String(args.text ?? "").trim().slice(0, 400);
  return { response: { prepared: true, note: "Shown to the resident with a button to review and post it." }, draft };
}

// ---------- Guard ----------

/** If the AI names a provider the tools did not return, drop its wording and let the cards speak. */
export function guardText(text: string, ctx: Ctx, allowedIds: Set<string>): string {
  const lower = text.toLowerCase();
  const invented = ctx.s.providers.some((p) => !allowedIds.has(p.id) && p.displayName.length > 4 && lower.includes(p.displayName.toLowerCase()));
  return invented ? "Here's what I found on JiranLink:" : text;
}

// ---------- The loop ----------

class TimeoutError extends Error {
  constructor() {
    super("The AI took too long to answer.");
  }
}

function contextLine(ctx: Ctx) {
  const z = zonesFor(ctx.me.home);
  const area = [z.building?.name, z.precinct?.name, z.township?.name].filter(Boolean).join(", ");
  return `[Context] Resident first name: ${ctx.me.name.split(" ")[0]}. Home area: ${area || ctx.me.homeLabel}.`;
}

/** The whole answer, all AI calls included, must arrive within this; otherwise the quick answer is shown. */
export const ANSWER_LIMIT_MS = 15000;

export async function askAssistant(question: string, history: GeminiContent[], ctx: Ctx, settings?: LlmSettings, limitMs = ANSWER_LIMIT_MS): Promise<AssistantReply> {
  const s = settings ?? settingsFrom(ctx.s.config);
  if (!assistantReady(ctx.s.config) && !settings) return quickAnswer(question, ctx);

  const userTurn: GeminiContent = { role: "user", parts: [{ text: contextLine(ctx) }, { text: question.slice(0, 500) }] };
  const contents: GeminiContent[] = [...history.slice(-6), userTurn];
  const reply: AssistantReply = { text: "", toolCalls: [], mode: "ai", history: [] };
  const allowed = new Set<string>();
  const deadline = Date.now() + limitMs;

  try {
    for (let round = 0; round < 4; round++) {
      const left = deadline - Date.now();
      if (left < 500) throw new TimeoutError();
      const model = await agentTurn(contents, s, left).catch((e: Error) => {
        throw /too long/i.test(e.message) ? new TimeoutError() : e;
      });
      const calls = model.parts.filter((p) => p.functionCall);
      if (!calls.length) {
        reply.text = model.parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
        break;
      }
      contents.push(model); // sent back verbatim, including any thought signatures
      const responses: GeminiPart[] = [];
      for (const c of calls) {
        const name = c.functionCall!.name;
        const args = (c.functionCall!.args ?? {}) as Record<string, unknown>;
        reply.toolCalls.push({ name, args });
        let response: Record<string, unknown>;
        if (name === "find_providers") {
          const r = toolFindProviders(ctx, args);
          response = r.response;
          if (r.finding) {
            reply.providers = r.finding;
            [...r.finding.results, ...r.finding.online].forEach((x) => allowed.add(x.provider.id));
          }
        } else if (name === "get_help") {
          const r = toolGetHelp(args);
          response = r.response;
          if (r.help) reply.help = r.help;
        } else if (name === "my_bookings") {
          const r = toolMyBookings(ctx);
          response = r.response;
          reply.bookings = r.bookings;
        } else if (name === "draft_request") {
          const r = toolDraftRequest(args);
          response = r.response;
          reply.draft = r.draft;
        } else {
          response = { error: "Unknown tool." };
        }
        responses.push({ functionResponse: { name, response } });
      }
      contents.push({ role: "user", parts: responses });
    }
  } catch (e) {
    const quick = quickAnswer(question, ctx);
    quick.fallbackReason = e instanceof TimeoutError
      ? `The AI took longer than ${Math.round(limitMs / 1000)} seconds, so this is a quick keyword answer.`
      : `The AI is unavailable right now (${(e as Error).message}), so this is a quick keyword answer.`;
    return quick;
  }

  reply.text = guardText(reply.text, ctx, allowed) || fallbackText(reply);
  reply.history = [{ role: "user", parts: [{ text: question.slice(0, 500) }] }, { role: "model", parts: [{ text: reply.text }] }];
  return reply;
}

function fallbackText(r: AssistantReply) {
  if (r.providers?.results.length || r.providers?.online.length) return "Here's who can help near you:";
  if (r.providers) return "Nobody on JiranLink offers this near you yet.";
  if (r.help) return r.help.title;
  if (r.bookings) return r.bookings.length ? "Here are your current bookings:" : "You have no bookings in progress.";
  return "Sorry, I couldn't work that out. Try describing what you need in a few words.";
}

// ---------- Quick answer (no AI): keywords only ----------

const HOW_WORDS = /\b(how|what is|what's|why|can i|bagaimana|macam ?mana|cara|boleh ke|apa itu|kenapa)\b|怎么|如何|为什么|可以/i;
const BOOKING_WORDS = /\b(my bookings?|my jobs?|tempahan saya|booking saya|status)\b|我的预约/i;

export function quickAnswer(question: string, ctx: Ctx): AssistantReply {
  const q = question.toLowerCase();
  const base: AssistantReply = { text: "", toolCalls: [], mode: "quick", history: [] };

  if (BOOKING_WORDS.test(q)) {
    const r = toolMyBookings(ctx);
    return { ...base, bookings: r.bookings, toolCalls: [{ name: "my_bookings", args: {} }], text: r.bookings.length ? "Here are your current bookings:" : "You have no bookings in progress." };
  }

  const helpScore = (t: HelpTopic) => {
    // Keywords must start a word, so "ic" (IC number) doesn't match inside "services". Keywords of 4+ letters
    // also match longer forms ("cancel" in "cancelling"); short ones must be the whole word. Chinese matches anywhere.
    const has = (w: string) => {
      if (/[\u3400-\u9fff]/.test(w)) return q.includes(w);
      const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}${w.length > 3 ? "\\p{L}*" : ""}($|[^\\p{L}\\p{N}])`, "u").test(q);
    };
    const hits = HELP[t].keywords.map((k) => ({ word: k.replace(/^~/, ""), w: k.startsWith("~") ? 0.5 : 1 })).filter((k) => has(k.word));
    // "book" inside "booking" counts once.
    return hits.filter((k) => !hits.some((o) => o !== k && o.word.includes(k.word))).reduce((n, k) => n + k.w, 0);
  };
  const bestHelp = [...HELP_TOPICS].sort((a, b) => helpScore(b) - helpScore(a))[0];
  const asksHow = HOW_WORDS.test(q);
  const svc = understandFast(question, thresholdsFrom(ctx.s.config));
  const svcConfident = svc.decision.kind !== "lost";

  if (helpScore(bestHelp) > 0 && (asksHow || !svcConfident)) {
    const r = toolGetHelp({ topic: bestHelp });
    return { ...base, help: r.help, toolCalls: [{ name: "get_help", args: { topic: bestHelp } }], text: r.help!.text };
  }
  if (svcConfident) {
    const r = toolFindProviders(ctx, { need: question });
    const f = r.finding;
    const found = !!(f && (f.results.length || f.online.length));
    return {
      ...base,
      providers: f,
      draft: found ? undefined : question,
      toolCalls: [{ name: "find_providers", args: { need: question } }],
      text: found ? `These neighbours offer ${categoryById(f!.categoryId)?.name.toLowerCase()}:` : "Nobody on JiranLink offers this near you yet. You can post it on the request board.",
    };
  }
  return { ...base, draft: question, text: "I couldn't match that to a service. Try describing the problem in a few words, or post it on the request board and neighbours can reply." };
}
