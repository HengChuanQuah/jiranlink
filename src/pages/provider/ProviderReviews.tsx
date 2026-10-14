import { useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { Empty, RatingLine, Stars } from "../../components/ui";
import { statsFor } from "../../lib/rating";
import { nameOf, useMe } from "../../lib/hooks";
import { back } from "../../lib/router";
import { timeAgo } from "../../lib/time";

export function ProviderReviews() {
  const { s, myProvider } = useMe();
  const [filter, setFilter] = useState<"all" | "booked" | "past">("all");
  if (!myProvider) return null;
  const stats = statsFor(s, myProvider.id)!;
  const all = s.reviews.filter((r) => r.providerId === myProvider.id).sort((a, b) => b.at.localeCompare(a.at));
  const list = filter === "all" ? all : all.filter((r) => r.type === filter);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: all.filter((r) => Math.round(r.stars) === n).length }));
  const max = Math.max(1, ...dist.map((d) => d.c));
  const cfg = s.config;

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <button className="link-btn" onClick={() => back({ name: "p-settings" })} style={{ justifySelf: "start" }}><ArrowLeft size={16} /> Back</button>
      <h1 className="page-title">Your reviews</h1>

      <section className="card stack-sm">
        <RatingLine stats={stats} />
        <div className="stack-sm" style={{ gap: 6 }} aria-label="Star breakdown">
          {dist.map((d) => (
            <div key={d.n} style={{ display: "grid", gridTemplateColumns: "24px 1fr 32px", gap: 8, alignItems: "center" }} className="small">
              <span className="tnum">{d.n}★</span>
              <span style={{ height: 8, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(d.c / max) * 100}%`, background: "var(--grad)" }} /></span>
              <span className="tnum muted">{d.c}</span>
            </div>
          ))}
        </div>
        <dl className="kv">
          <dt>Search score</dt><dd className="tnum">{stats.bayes.toFixed(2)} <span className="muted small">(needs {cfg.qualityFloor.toFixed(1)} to stay listed{stats.floorExempt ? "; you're exempt until 3 reviews" : ""})</span></dd>
          <dt>From bookings</dt><dd className="tnum">{stats.bookedCount}, full weight</dd>
          <dt>Past customers</dt><dd className="tnum">{stats.pastTotal} written, {stats.pastCount} counted at {cfg.pastWeight}× weight</dd>
        </dl>
        <p className="hint">The search score starts everyone at {cfg.priorMean.toFixed(1)} stars as if they had {cfg.priorWeight} average reviews, so one bad review can't sink a newcomer and one 5-star can't make them top.</p>
      </section>

      <div className="seg" role="group" aria-label="Filter reviews" style={{ justifySelf: "start" }}>
        {(["all", "booked", "past"] as const).map((f) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "booked" ? "Booked via JiranLink" : "Past customers"}</button>)}
      </div>

      <section className="card" style={{ paddingBlock: 4 }}>
        {list.length === 0 && <Empty icon={<Star size={24} />} title="No reviews here yet" />}
        {list.map((r) => (
          <div key={r.id} className="review">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Stars value={r.stars} />
              <span className={`badge ${r.type === "booked" ? "b-verified" : "b-plain"}`}>{r.type === "booked" ? "Booked via JiranLink" : "Past customer"}</span>
              <span className="tiny muted">{nameOf(s, r.authorId).split(" ")[0]} · {timeAgo(r.at)}</span>
            </div>
            <p>{r.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
