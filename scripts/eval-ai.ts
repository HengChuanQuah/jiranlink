// Measures how accurately the agent picks the right category.
// Usage:  npm run eval:ai                         (keywords only, free and offline)
//         AI_PROVIDER=gemini AI_KEY=... npm run eval:ai   (keywords + LLM fallback)
// Write extra test phrases that the dictionary authors have NOT seen, for an honest number.

import { readFileSync } from "node:fs";
import { understand, understandFast } from "../src/ai/agent";
import { DEFAULT_CONFIG } from "../src/data/seed";
import type { AiProvider } from "../src/data/types";

const file = process.env.SET === "heldout" ? "./ai-heldout.json" : "./ai-testset.json";
const set: [string, string][] = JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const provider = (process.env.AI_PROVIDER as AiProvider) || "none";
const cfg = { ...DEFAULT_CONFIG, aiProvider: provider, aiKey: process.env.AI_KEY || "", aiModel: process.env.AI_MODEL || "" };

let autoRight = 0, autoWrong = 0, ambiguousHit = 0, ambiguousMiss = 0, lost = 0;
const misses: string[] = [];
const t0 = Date.now();

for (const [text, want] of set) {
  const r = provider === "none" ? understandFast(text, { confident: cfg.aiConfident, lead: cfg.aiLead, lost: cfg.aiLost }) : await understand(text, cfg);
  const d = r.decision;
  if (d.kind === "confident") {
    if (d.categoryId === want) autoRight++;
    else { autoWrong++; misses.push(`WRONG  "${text}" -> ${d.categoryId} (want ${want})`); }
  } else if (d.kind === "ambiguous") {
    if (d.categoryIds.includes(want)) ambiguousHit++;
    else { ambiguousMiss++; misses.push(`MISSED "${text}" -> [${d.categoryIds.join(", ")}] (want ${want})`); }
  } else { lost++; misses.push(`LOST   "${text}" (want ${want})`); }
}

const n = set.length;
const pct = (x: number) => `${((100 * x) / n).toFixed(1)}%`;
console.log(`Test set: ${file}`);
console.log(`Provider: ${provider}${provider !== "none" ? ` (${cfg.aiModel || "default model"})` : ""}`);
console.log(`Phrases: ${n}`);
console.log(`Picked automatically and correct: ${autoRight} (${pct(autoRight)})`);
console.log(`Picked automatically but wrong:  ${autoWrong} (${pct(autoWrong)})`);
console.log(`Shown 2-3 options, right one included: ${ambiguousHit} (${pct(ambiguousHit)})`);
console.log(`Shown options, right one missing: ${ambiguousMiss} (${pct(ambiguousMiss)})`);
console.log(`Asked one question: ${lost} (${pct(lost)})`);
console.log(`Right answer shown without a question: ${pct(autoRight + ambiguousHit)}`);
console.log(`Precision of automatic picks: ${autoRight + autoWrong ? ((100 * autoRight) / (autoRight + autoWrong)).toFixed(1) : "n/a"}%`);
console.log(`Average time per phrase: ${((Date.now() - t0) / n).toFixed(1)} ms`);
if (misses.length) console.log("\n" + misses.join("\n"));
