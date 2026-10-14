import { useMemo, useState } from "react";
import { Megaphone, MessageCircle, Send, Sparkles } from "lucide-react";
import { Avatar, Empty, categoryName } from "../../components/ui";
import { CATEGORIES } from "../../data/categories";
import { understandFast, thresholdsFrom } from "../../ai/agent";
import { distanceM, zonesFor } from "../../lib/geo";
import { nameOf, useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { attempt } from "../../lib/store";
import { postRequest, respondToRequest } from "../../lib/domain";
import { timeAgo } from "../../lib/time";
import type { RequestPost } from "../../data/types";

export function Requests() {
  const { s, me, myProvider } = useMe();
  const [text, setText] = useState("");
  const [override, setOverride] = useState<string>("");
  const ai = useMemo(() => (text.trim().length > 5 ? understandFast(text, thresholdsFrom(s.config)) : null), [text, s.config]);
  const aiCat = ai ? (ai.decision.kind === "confident" ? ai.decision.categoryId : ai.decision.kind === "ambiguous" ? ai.decision.categoryIds[0] : null) : null;
  const cat = override || aiCat || null;

  const nearby = (r: RequestPost) => {
    const author = s.users.find((u) => u.id === r.residentId);
    return author ? distanceM(author.home, me.home) <= 10_000 : false;
  };
  const mine = s.requests.filter((r) => r.residentId === me.id);
  const others = s.requests.filter((r) => r.residentId !== me.id && r.status === "open" && nearby(r));
  const myCats = new Set(s.services.filter((x) => x.providerId === me.id).map((x) => x.categoryId));
  const asProvider = s.mode === "provider" && !!myProvider;
  const relevant = asProvider ? others.filter((r) => !r.categoryId || myCats.has(r.categoryId)) : others;

  const post = () => {
    if (attempt((st) => postRequest(st, me.id, text, cat, ai?.hints.timeText ?? ""), "Posted. Providers nearby can now reply.")) {
      setText("");
      setOverride("");
    }
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Request board</h1>
        <p className="section-sub">For needs nobody lists yet. Visible to verified residents within 10 km of you.</p>
      </div>

      {!asProvider && (
        <section className="card stack-sm" aria-labelledby="h-post">
          <h2 className="section-title" style={{ fontSize: 17 }} id="h-post">Ask your neighbours</h2>
          <label htmlFor="req" className="sr-only">Describe what you need</label>
          <textarea id="req" className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: Need someone to water my plants and feed my cat for 5 days next month." />
          {ai && (
            <p className="explain"><Sparkles size={14} style={{ flex: "none", marginTop: 2 }} />
              {cat ? <>Tagged as <b>&nbsp;{categoryName(cat)}&nbsp;</b></> : "No category matched yet"}
              {ai.hints.timeText ? <>, when: <b>&nbsp;{ai.hints.timeText.toLowerCase()}</b></> : null}. Matching providers get notified.
            </p>
          )}
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ov">Category</label>
              <select id="ov" className="input" value={override} onChange={(e) => setOverride(e.target.value)}>
                <option value="">{aiCat ? `Auto: ${categoryName(aiCat)}` : "Auto-detect"}</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={post} disabled={text.trim().length < 10}><Megaphone size={16} /> Post request</button>
        </section>
      )}

      {!asProvider && mine.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title" style={{ fontSize: 18 }}>Your requests</h2>
          {mine.map((r) => <RequestCard key={r.id} r={r} own />)}
        </section>
      )}

      <section className="stack-sm">
        <h2 className="section-title" style={{ fontSize: 18 }}>{asProvider ? "Requests you can help with" : "Open requests nearby"}</h2>
        {relevant.length === 0 && <div className="card-flat"><Empty icon={<Megaphone size={24} />} title="No open requests right now" /></div>}
        {relevant.map((r) => <RequestCard key={r.id} r={r} canRespond={!!myProvider && s.mode === "provider"} />)}
      </section>
    </div>
  );
}

function RequestCard({ r, own, canRespond }: { r: RequestPost; own?: boolean; canRespond?: boolean }) {
  const { s, me } = useMe();
  const [reply, setReply] = useState("");
  const author = s.users.find((u) => u.id === r.residentId);
  const z = author ? zonesFor(author.home) : null;
  const responded = r.responses.some((x) => x.providerId === me.id);
  return (
    <div className="card-flat stack-sm">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {r.categoryId && <span className="badge b-ring">{categoryName(r.categoryId)}</span>}
        {r.timeHint && <span className="badge b-plain">{r.timeHint}</span>}
        <span className="tiny muted">{own ? "You" : `${(author?.name ?? "Neighbour").split(" ")[0]}, ${(z?.building ?? z?.precinct ?? z?.township)?.name ?? "nearby"}`} · {timeAgo(r.createdAt)}</span>
      </div>
      <p>{r.text}</p>
      {r.responses.length > 0 && (
        <div className="stack-sm" style={{ gap: 8 }}>
          {r.responses.map((x) => {
            const p = s.providers.find((pp) => pp.id === x.providerId);
            return (
              <div key={x.providerId} className="list-row" style={{ cursor: "default" }}>
                <Avatar name={nameOf(s, x.providerId)} hue={p?.hue ?? 100} />
                <div className="grow">
                  <div className="strong">{nameOf(s, x.providerId)}</div>
                  <div className="small">{x.text}</div>
                </div>
                {(own || x.providerId === me.id) && (
                  <div className="btn-row" style={{ flex: "none" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate({ name: "thread", id: `r:${r.id}:${x.providerId}` })}><MessageCircle size={14} /> Chat</button>
                    {own && <button className="btn btn-primary btn-sm" onClick={() => navigate({ name: "provider", id: x.providerId })}>View</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {canRespond && !responded && (
        <div className="composer">
          <label htmlFor={`rp-${r.id}`} className="sr-only">Reply to this request</label>
          <textarea id={`rp-${r.id}`} className="input" rows={1} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Offer to help, with a rough price" />
          <button className="round-btn" aria-label="Send reply" onClick={() => attempt((st) => respondToRequest(st, r.id, me.id, reply), "Reply sent") && setReply("")}><Send size={18} /></button>
        </div>
      )}
      {canRespond && responded && <p className="small muted">You replied to this request.</p>}
    </div>
  );
}
