import { CATEGORIES, type Category } from "../data/categories";

// Step 1 of the agent: instant, free keyword matching in English, Malay, Chinese and Manglish.

export interface CategoryScore {
  id: string;
  score: number; // 0..1
  matched: string[];
}

const CJK = /[㐀-鿿]/;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/air[\s-]?cond(itioner)?s?/g, "aircond")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const prev = new Array(n + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[n];
}

interface Kw {
  term: string;
  weight: number;
  multi: boolean;
  cjk: boolean;
}

function parseKeywords(c: Category): Kw[] {
  return c.keywords.map((raw) => {
    let weight = 1;
    let term = raw;
    if (raw.startsWith("!")) {
      weight = 1.6;
      term = raw.slice(1);
    } else if (raw.startsWith("~")) {
      weight = 0.45;
      term = raw.slice(1);
    }
    const cjk = CJK.test(term);
    term = cjk ? term : normalize(term);
    return { term, weight, multi: term.includes(" ") || term.includes("-"), cjk };
  });
}

const INDEX = CATEGORIES.map((c) => ({ id: c.id, kws: parseKeywords(c) }));

const STOP = new Set(["saya", "nak", "need", "someone", "anyone", "help", "the", "my", "a", "to", "for", "and", "dan", "yang", "untuk", "ada", "tak", "x", "please", "tolong", "can", "boleh", "is", "in", "of", "at", "di", "ke", "rumah", "house", "home"]);

function wordMatch(token: string, term: string): number {
  if (token === term) return 1;
  // Simple stemming for Malay suffixes and English plurals.
  for (const suf of ["nya", "kan", "lah", "an", "s", "es", "ing", "ed"]) {
    if (token.length > suf.length + 2 && token.endsWith(suf) && token.slice(0, -suf.length) === term) return 0.9;
  }
  if (term.length >= 5 && token.length >= 4) {
    const d = levenshtein(token, term);
    if (d === 1) return 0.7;
    if (d === 2 && term.length >= 8) return 0.5;
  }
  return 0;
}

/** Scores every category for a free-text description. Higher raw weight means more and stronger matches. */
export function keywordScores(text: string): CategoryScore[] {
  const norm = normalize(text);
  const padded = ` ${norm} `;
  const tokens = norm.split(" ").filter((t) => t && !STOP.has(t));
  const out: CategoryScore[] = [];
  for (const { id, kws } of INDEX) {
    let raw = 0;
    const matched: string[] = [];
    // Phrases and Chinese terms: each match adds its weight.
    for (const kw of kws) {
      if (kw.cjk ? text.includes(kw.term) : kw.multi && padded.includes(` ${kw.term} `)) {
        raw += kw.weight * (kw.cjk ? 1 : 1.15);
        matched.push(kw.term);
      }
    }
    // Single words: each token counts once, using its best-matching keyword.
    for (const t of tokens) {
      let best = 0;
      let bestTerm = "";
      for (const kw of kws) {
        if (kw.multi || kw.cjk) continue;
        const v = kw.weight * wordMatch(t, kw.term);
        if (v > best) {
          best = v;
          bestTerm = kw.term;
        }
      }
      if (best > 0) {
        raw += best;
        matched.push(bestTerm);
      }
    }
    if (raw > 0) out.push({ id, score: 1 - Math.exp(-raw / 1.3), matched });
  }
  return out.sort((a, b) => b.score - a.score);
}
