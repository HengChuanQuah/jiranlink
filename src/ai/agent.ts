// The search agent: keywords first, LLM only when keywords don't settle it, then a confidence
// decision that never interviews the resident. Detailed scoping is the provider's job.

import { CATEGORIES, GROUPS, categoryById, type CategoryGroup } from "../data/categories";
import type { Config } from "../data/types";
import { aiReady, classifyWithLlm, settingsFrom, type LlmClassification } from "./adapter";
import { extractHints, type Hints } from "./hints";
import { keywordScores, type CategoryScore } from "./keywords";

export type Decision =
  | { kind: "confident"; categoryId: string }
  | { kind: "ambiguous"; categoryIds: string[] }
  | { kind: "lost"; question: string; options: { group: CategoryGroup; label: string }[] };

export interface AgentResult {
  decision: Decision;
  scores: CategoryScore[];
  hints: Hints;
  usedLlm: boolean;
  llmError?: string;
  source: "keywords" | "keywords+ai" | "ai";
}

export interface Thresholds {
  confident: number;
  lead: number;
  lost: number;
}

export function thresholdsFrom(cfg: Config): Thresholds {
  return { confident: cfg.aiConfident, lead: cfg.aiLead, lost: cfg.aiLost };
}

const LOST_QUESTION = "Which of these is closest to what you need?";

/** Turns category scores into a decision using the three thresholds. */
export function decide(scores: CategoryScore[], th: Thresholds, agreement = false): Decision {
  const [top, second] = scores;
  if (!top || top.score < th.lost) {
    return { kind: "lost", question: LOST_QUESTION, options: GROUPS.map((g) => ({ group: g.id, label: g.label })) };
  }
  const lead = top.score - (second?.score ?? 0);
  if (agreement || (top.score >= th.confident && lead >= th.lead)) return { kind: "confident", categoryId: top.id };
  const close = scores.filter((s) => s.score >= Math.max(th.lost * 0.85, top.score - 0.25)).slice(0, 3);
  return close.length > 1 ? { kind: "ambiguous", categoryIds: close.map((c) => c.id) } : { kind: "confident", categoryId: top.id };
}

function merge(kw: CategoryScore[], llm: LlmClassification): CategoryScore[] {
  const map = new Map<string, CategoryScore>();
  for (const k of kw) map.set(k.id, { ...k, score: k.score * 0.5 });
  for (const l of llm.categories) {
    const prev = map.get(l.id);
    map.set(l.id, { id: l.id, score: (prev?.score ?? 0) + l.score * 0.5, matched: prev?.matched ?? [] });
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}

/** Synchronous, keyword-only pass (used for instant results and for the offline demo). */
export function understandFast(text: string, th: Thresholds): AgentResult {
  const scores = keywordScores(text);
  return { decision: decide(scores, th), scores, hints: extractHints(text), usedLlm: false, source: "keywords" };
}

/** Full agent: keywords, then the LLM only when keywords are not confident. */
export async function understand(text: string, cfg: Config): Promise<AgentResult> {
  const th = thresholdsFrom(cfg);
  const fast = understandFast(text, th);
  if (fast.decision.kind === "confident" || !aiReady(cfg)) return fast;
  try {
    const llm = await classifyWithLlm(text, settingsFrom(cfg));
    if (!llm || !llm.categories.length) return { ...fast, usedLlm: true };
    const agree = !!fast.scores[0] && fast.scores[0].id === llm.categories[0].id && llm.categories[0].score >= 0.6;
    const merged = fast.scores.length ? merge(fast.scores, llm) : llm.categories.map((c) => ({ ...c, matched: [] }));
    const hints = { ...fast.hints, online: fast.hints.online || llm.online };
    if (llm.timeHint && !hints.timeText) hints.timeText = llm.timeHint;
    return { decision: decide(merged, th, agree), scores: merged, hints, usedLlm: true, source: fast.scores.length ? "keywords+ai" : "ai" };
  } catch (e) {
    return { ...fast, usedLlm: true, llmError: (e as Error).message };
  }
}

export function categoriesInGroup(group: CategoryGroup): string[] {
  return CATEGORIES.filter((c) => c.group === group).map((c) => c.id);
}

/** Drafts the first message to the provider from what the resident typed. The resident edits before sending. */
export function draftMessage(opts: { text: string; categoryId: string; providerName: string; residentFirstName: string; homeLabel: string; slotLabel?: string; hints: Hints }): string {
  const cat = categoryById(opts.categoryId);
  const desc = opts.text.trim().replace(/\s+/g, " ");
  const sentence = desc ? desc[0].toUpperCase() + desc.slice(1).replace(/[.!?]*$/, ".") : `I'd like to book ${cat?.name.toLowerCase() ?? "your service"}.`;
  const lines = [`Hi ${opts.providerName.split(" ")[0]}, I'm ${opts.residentFirstName} from ${opts.homeLabel}.`, sentence];
  if (opts.hints.quantity) lines.push(`Quantity: ${opts.hints.quantity}.`);
  if (opts.slotLabel) lines.push(`I picked ${opts.slotLabel}. Let me know if that works.`);
  else if (opts.hints.timeText) lines.push(`Preferred time: ${opts.hints.timeText.toLowerCase()}.`);
  return lines.join(" ");
}
