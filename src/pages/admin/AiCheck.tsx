import { useRef, useState } from "react";
import { CheckCircle2, FlaskConical, PlugZap, XCircle } from "lucide-react";
import heldout from "../../../scripts/ai-heldout.json";
import { aiReady, assistantReady, classifyWithLlm, settingsFrom } from "../../ai/adapter";
import { understand, understandFast, thresholdsFrom } from "../../ai/agent";
import { askAssistant, type AssistantReply } from "../../ai/assistant";
import { ASSISTANT_CASES, type AssistantCase } from "../../ai/assistantCases";
import { useMe } from "../../lib/hooks";
import { getState } from "../../lib/store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isBusy = (msg = "") => /429|too many|rate|busy|quota/i.test(msg);

interface Tally { right: number; wrong: number; optHit: number; optMiss: number; lost: number }
const empty = (): Tally => ({ right: 0, wrong: 0, optHit: 0, optMiss: 0, lost: 0 });

/** Admin > Settings: tests the live AI from this browser, so the key never leaves Cloudflare. */
export function AiCheck() {
  const { s } = useMe();
  const [conn, setConn] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [search, setSearch] = useState<{ kw: Tally; ai: Tally; calls: number; errors: string[]; misses: string[] } | null>(null);
  const [assist, setAssist] = useState<{ c: AssistantCase; r: AssistantReply; pass: boolean; why: string }[] | null>(null);
  const stop = useRef(false);
  const cfg = s.config;
  const ready = aiReady(cfg);

  const checkConnection = async () => {
    setConn("Checking…");
    const t0 = performance.now();
    try {
      const r = await classifyWithLlm("aircond bocor air", settingsFrom(getState().config));
      setConn(r?.categories.length ? `Connected. The AI answered "${r.categories[0].id}" in ${Math.round(performance.now() - t0)} ms.` : "Connected, but the AI's answer was empty.");
    } catch (e) {
      setConn(`Not working: ${(e as Error).message}`);
    }
  };

  const runSearch = async () => {
    stop.current = false;
    const set = heldout as [string, string][];
    const kw = empty(), ai = empty();
    let calls = 0;
    const errors: string[] = [], misses: string[] = [];
    const add = (t: Tally, d: ReturnType<typeof understandFast>["decision"], want: string) => {
      if (d.kind === "confident") d.categoryId === want ? t.right++ : t.wrong++;
      else if (d.kind === "ambiguous") d.categoryIds.includes(want) ? t.optHit++ : t.optMiss++;
      else t.lost++;
    };
    for (let i = 0; i < set.length && !stop.current; i++) {
      const [text, want] = set[i];
      setProgress(`Search test: ${i + 1} of ${set.length}`);
      const c = getState().config;
      const fast = understandFast(text, thresholdsFrom(c));
      add(kw, fast.decision, want);
      let r = await understand(text, c);
      if (r.usedLlm) calls++;
      if (r.llmError && isBusy(r.llmError)) {
        setProgress(`AI is rate-limited, waiting 20 s… (${i + 1} of ${set.length})`);
        await sleep(20000);
        r = await understand(text, c);
      }
      if (r.llmError) errors.push(`"${text}": ${r.llmError}`);
      add(ai, r.decision, want);
      const d = r.decision;
      const ok = (d.kind === "confident" && d.categoryId === want) || (d.kind === "ambiguous" && d.categoryIds.includes(want));
      if (!ok) misses.push(`"${text}" → ${d.kind === "confident" ? d.categoryId : d.kind === "ambiguous" ? d.categoryIds.join(" / ") : "asked a question"} (want ${want})`);
      if (r.usedLlm) await sleep(1200);
    }
    setSearch({ kw, ai, calls, errors, misses });
    setProgress(null);
  };

  const runAssistant = async () => {
    stop.current = false;
    const out: { c: AssistantCase; r: AssistantReply; pass: boolean; why: string }[] = [];
    for (let i = 0; i < ASSISTANT_CASES.length && !stop.current; i++) {
      const c = ASSISTANT_CASES[i];
      setProgress(`Assistant test: ${i + 1} of ${ASSISTANT_CASES.length}`);
      const st = getState();
      const me = st.users.find((u) => u.id === "u-aisyah") ?? st.users[0];
      let r = await askAssistant(c.q, [], { s: st, me });
      if (r.mode === "quick" && isBusy(r.fallbackReason)) {
        setProgress(`AI is rate-limited, waiting 20 s… (${i + 1} of ${ASSISTANT_CASES.length})`);
        await sleep(20000);
        r = await askAssistant(c.q, [], { s: getState(), me });
      }
      out.push({ c, r, ...judge(c, r) });
      setAssist([...out]);
      await sleep(1500);
    }
    setProgress(null);
  };

  return (
    <section className="card stack-sm">
      <h2 className="section-title" style={{ fontSize: 16 }}><FlaskConical size={16} /> AI check</h2>
      <p className="small muted">Runs from this browser through the saved AI settings, so the key never leaves the AI server. Save settings before running. The tests use the free tier slowly to stay under its limits; the search test takes about 2 minutes.</p>
      {!ready && <div className="notice n-warn"><div className="grow">No AI is configured. Choose the JiranLink AI server above and save.</div></div>}
      <div className="btn-row">
        <button className="btn btn-outline btn-sm" disabled={!ready || !!progress} onClick={checkConnection}><PlugZap size={14} /> Check connection</button>
        <button className="btn btn-primary btn-sm" disabled={!ready || !!progress} onClick={runSearch}>Run search test (40 phrases)</button>
        <button className="btn btn-primary btn-sm" disabled={!assistantReady(cfg) || !!progress} onClick={runAssistant}>Run assistant test ({ASSISTANT_CASES.length} questions)</button>
        {progress && <button className="btn btn-quiet btn-sm" onClick={() => { stop.current = true; }}>Stop</button>}
      </div>
      {conn && <p className="small" role="status">{conn}</p>}
      {progress && <p className="small" role="status">{progress}</p>}

      {search && (
        <div className="stack-sm">
          <h3 className="strong">Search test: 40 phrases the keywords were never tuned on</h3>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Outcome</th><th>Keywords only</th><th>Keywords + AI</th></tr></thead>
              <tbody>
                {([["Right service, shown straight away", "right"], ["Wrong service, shown straight away", "wrong"], ["2 to 3 options, right one included", "optHit"], ["Options, right one missing", "optMiss"], ["Asked one question", "lost"]] as const).map(([label, k]) => (
                  <tr key={k}><td>{label}</td><td className="tnum">{search.kw[k]} ({pct(search.kw[k])})</td><td className="tnum">{search.ai[k]} ({pct(search.ai[k])})</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small">The AI was asked {search.calls} times (only when keywords weren't confident). {search.errors.length ? `${search.errors.length} AI calls failed.` : "No AI errors."}</p>
          {search.misses.length > 0 && <details><summary className="small">Misses ({search.misses.length})</summary><ul className="small">{search.misses.map((m) => <li key={m}>{m}</li>)}</ul></details>}
          {search.errors.length > 0 && <details><summary className="small">AI errors</summary><ul className="small">{search.errors.map((m) => <li key={m}>{m}</li>)}</ul></details>}
        </div>
      )}

      {assist && (
        <div className="stack-sm">
          <h3 className="strong">Assistant test: {assist.filter((x) => x.pass).length} of {assist.length} passed</h3>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Question</th><th>What it did</th><th>Result</th></tr></thead>
              <tbody>
                {assist.map(({ c, r, pass, why }) => (
                  <tr key={c.q}>
                    <td className="small">{c.q}</td>
                    <td className="small">{r.toolCalls.map((t) => `${t.name}(${Object.values(t.args).filter((v) => typeof v === "string" && v.length < 30).join(", ")})`).join(", ") || "no tool"}<br /><span className="muted">"{r.text.slice(0, 140)}"</span></td>
                    <td className="small">{pass ? <span style={{ color: "var(--ok)" }}><CheckCircle2 size={14} /> Pass</span> : <span style={{ color: "var(--bad)" }}><XCircle size={14} /> {why}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

const pct = (n: number) => `${Math.round((100 * n) / 40)}%`;

function judge(c: AssistantCase, r: AssistantReply): { pass: boolean; why: string } {
  if (r.mode === "quick") return { pass: false, why: `AI error: ${r.fallbackReason ?? "no answer"}` };
  const names = r.toolCalls.map((t) => t.name);
  const argOk = (name: string, key: string) =>
    !c.accept || r.toolCalls.some((t) => t.name === name && c.accept!.includes(String(t.args[key] ?? "")));
  switch (c.tool) {
    case "none":
      return names.length ? { pass: false, why: "Used a tool for an off-topic question" } : { pass: !!r.text, why: "" };
    case "find_or_draft":
      return names.includes("find_providers") || names.includes("draft_request") ? { pass: true, why: "" } : { pass: false, why: "Didn't search or draft a request" };
    case "find_providers":
      if (!names.includes("find_providers")) return { pass: false, why: "Didn't search" };
      return argOk("find_providers", "category_id") || (r.providers && c.accept?.includes(r.providers.categoryId)) ? { pass: true, why: "" } : { pass: false, why: `Wrong service (${r.providers?.categoryId ?? "none"})` };
    case "get_help":
      if (!names.includes("get_help")) return { pass: false, why: "Didn't use the help guide" };
      return argOk("get_help", "topic") ? { pass: true, why: "" } : { pass: false, why: `Wrong help topic (${r.help?.topic})` };
    default:
      return names.includes(c.tool) ? { pass: true, why: "" } : { pass: false, why: `Expected ${c.tool}` };
  }
}
