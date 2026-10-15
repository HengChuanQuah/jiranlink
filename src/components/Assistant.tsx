import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Globe, MapPin, Megaphone, Send, Sparkles, X } from "lucide-react";
import { Avatar, RatingLine, categoryName } from "./ui";
import { askAssistant, type AssistantReply } from "../ai/assistant";
import { assistantReady, type GeminiContent } from "../ai/adapter";
import { useMe } from "../lib/hooks";
import { navigate, useRoute, type Route } from "../lib/router";
import { distanceLabel } from "../lib/geo";
import { rm } from "../lib/time";
import type { SearchResult } from "../lib/search";

const STARTERS = [
  "I need someone to fix a leaking pipe",
  "How do I ask for a skill that isn't listed?",
  "How does paying after the job work?",
  "What's happening with my bookings?",
];

// Screens where a floating button would cover important actions.
const HIDDEN_ON: Route["name"][] = ["book", "booking", "thread", "signup"];

type Item = { id: number; who: "me"; text: string } | { id: number; who: "ai"; reply: AssistantReply } | { id: number; who: "error"; text: string };

export function Assistant() {
  const { s, me } = useMe();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<GeminiContent[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [items.length, busy]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (s.mode !== "resident" || HIDDEN_ON.includes(route.name)) return null;
  const live = assistantReady(s.config);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setText("");
    setItems((x) => [...x, { id: Date.now(), who: "me", text: question }]);
    setBusy(true);
    try {
      const reply = await askAssistant(question, history, { s, me });
      setItems((x) => [...x, { id: Date.now() + 1, who: "ai", reply }]);
      if (reply.history.length) setHistory((h) => [...h, ...reply.history].slice(-8));
    } catch (e) {
      setItems((x) => [...x, { id: Date.now() + 1, who: "error", text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  const go = (r: Route) => {
    navigate(r);
    if (window.matchMedia("(max-width: 699px)").matches) setOpen(false);
  };

  return (
    <>
      {!open && (
        <button className="assist-launch" onClick={() => setOpen(true)} aria-label="Ask JiranLink">
          <Sparkles size={18} /> <span>Ask JiranLink</span>
        </button>
      )}
      {open && (
        <section className="assist-panel" role="dialog" aria-label="Ask JiranLink">
          <header className="assist-head">
            <span className="agent-mark" aria-hidden><Sparkles size={16} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="strong">Ask JiranLink <span className="badge b-plain" style={{ marginLeft: 4 }}>Beta</span></div>
              <div className="tiny muted">{live ? "Answers from JiranLink's own listings and help" : "Quick answers (AI not connected)"}</div>
            </div>
            <button className="x-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
          </header>

          <div className="assist-body" aria-live="polite">
            {items.length === 0 && (
              <div className="stack-sm">
                <p className="small">Hi {me.name.split(" ")[0]}. Tell me what you need in your own words, or ask how something works.</p>
                <div className="stack-sm" style={{ gap: 6 }}>
                  {STARTERS.map((q) => <button key={q} className="assist-starter" onClick={() => ask(q)}>{q}</button>)}
                </div>
              </div>
            )}
            {items.map((it) =>
              it.who === "me" ? <div key={it.id} className="bubble me">{it.text}</div>
                : it.who === "error" ? <div key={it.id} className="bubble sys">{it.text}</div>
                  : <ReplyView key={it.id} r={it.reply} go={go} />,
            )}
            {busy && <div className="bubble them assist-typing" aria-label="Thinking"><span /><span /><span /></div>}
            <div ref={end} />
          </div>

          <form className="assist-foot" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <label htmlFor="assist-q" className="sr-only">Ask JiranLink</label>
            <textarea id="assist-q" ref={input} className="input" rows={1} maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="e.g. paip bawah sinki bocor" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
            <button className="round-btn" type="submit" aria-label="Send" disabled={busy || !text.trim()}><Send size={18} /></button>
          </form>
          <p className="assist-disclaimer">Providers shown come from JiranLink's search. The AI can still make mistakes.</p>
        </section>
      )}
    </>
  );
}

function ReplyView({ r, go }: { r: AssistantReply; go: (route: Route) => void }) {
  const f = r.providers;
  const showHelpText = r.help && r.text.trim() !== r.help.text.trim();
  return (
    <div className="assist-reply">
      {r.text && <div className="bubble them">{r.text}</div>}
      {f && (f.results.length > 0 || f.online.length > 0) && (
        <div className="stack-sm" style={{ gap: 6 }}>
          {f.results.map((x) => <MiniCard key={x.provider.id} r={x} onOpen={() => go({ name: "provider", id: x.provider.id, q: f.need })} />)}
          {f.online.length > 0 && <div className="tiny muted" style={{ marginTop: 2 }}><Globe size={11} /> Online</div>}
          {f.online.map((x) => <MiniCard key={x.provider.id} r={x} onOpen={() => go({ name: "provider", id: x.provider.id, q: f.need })} />)}
          <button className="link-btn" onClick={() => go({ name: "search", categoryIds: [f.categoryId] })}>See all {categoryName(f.categoryId).toLowerCase()} <ArrowRight size={14} /></button>
        </div>
      )}
      {r.help && (
        <div className="assist-card stack-sm">
          <div className="strong small">{r.help.title}</div>
          {showHelpText && <p className="small">{r.help.text}</p>}
          {r.help.actions.length > 0 && (
            <div className="btn-row">{r.help.actions.map((a) => <button key={a.label} className="btn btn-outline btn-sm" onClick={() => go(a.route)}>{a.label}</button>)}</div>
          )}
        </div>
      )}
      {r.bookings && r.bookings.length > 0 && (
        <div className="stack-sm" style={{ gap: 6 }}>
          {r.bookings.map((b) => (
            <button key={b.id} className="assist-card assist-row" onClick={() => go({ name: "booking", id: b.id })}>
              <CalendarDays size={16} style={{ flex: "none", marginTop: 2 }} />
              <span style={{ minWidth: 0 }}><span className="strong small">{b.title}</span><br /><span className="tiny muted">{b.when}</span><br /><span className="small">{b.waitingFor}</span></span>
            </button>
          ))}
        </div>
      )}
      {r.draft && (
        <div className="assist-card stack-sm">
          <div className="tiny muted">Draft for the request board</div>
          <p className="small">"{r.draft}"</p>
          <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} onClick={() => go({ name: "requests", draft: r.draft })}><Megaphone size={14} /> Review and post</button>
        </div>
      )}
      {r.note && <p className="tiny muted">{r.note}</p>}
    </div>
  );
}

function MiniCard({ r, onOpen }: { r: SearchResult; onOpen: () => void }) {
  const s = r.service;
  return (
    <button className="assist-card assist-row" onClick={onOpen} aria-label={`${r.provider.displayName}, ${s.title}`}>
      <Avatar name={r.provider.displayName} hue={r.provider.hue} />
      <span style={{ minWidth: 0, flex: 1, display: "grid", gap: 2 }}>
        <span className="strong small ellipsis">{r.provider.displayName}</span>
        <span className="tiny muted ellipsis">{s.title}</span>
        <span className="tiny" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {r.ring >= 0 ? <><MapPin size={11} /> {r.ringLabel} · {distanceLabel(r.distanceM)}</> : <><Globe size={11} /> Online</>}
        </span>
        <span className="tiny" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <RatingLine stats={r.stats} />
          <b className="tnum">{rm(s.priceMin)}{s.priceMax > s.priceMin ? `–${rm(s.priceMax)}` : ""}</b>
        </span>
      </span>
    </button>
  );
}
