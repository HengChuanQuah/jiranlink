import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, Clock3, Mic, Search as SearchIcon, ShieldAlert, Wallet } from "lucide-react";
import { AerialCanvas } from "../../components/ui";
import { ProviderCard } from "../../components/ProviderCard";
import { TOWNSHIPS } from "../../data/geo";
import { PERSONAS } from "../../data/seed";
import { zonesFor } from "../../lib/geo";
import { firstName, nameOf, useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { ringFor, ringLabel, type SearchResult } from "../../lib/search";
import { ratingStats } from "../../lib/rating";
import { getState, run } from "../../lib/store";
import { fmtSlot, rm } from "../../lib/time";
import { outstanding } from "../../lib/domain";


export function HeroSearch({ initial = "", compact }: { initial?: string; compact?: boolean }) {
  const [q, setQ] = useState(initial);
  const [listening, setListening] = useState(false);
  const SR = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const go = (text: string) => {
    if (!text.trim()) return;
    navigate({ name: "search", q: text.trim() });
  };
  const listen = () => {
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = "ms-MY";
      rec.interimResults = false;
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript as string;
        setQ(text);
        go(text);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  };
  return (
    <form className="search-pill" onSubmit={(e) => { e.preventDefault(); go(q); }} role="search" style={compact ? { boxShadow: "var(--shadow)" } : undefined}>
      <label htmlFor="q" className="sr-only">Describe what you need</label>
      <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder='Describe it your way, e.g. "aircond bocor air"' autoComplete="off" />
      {SR && (
        <button type="button" className="mic" onClick={listen} aria-label={listening ? "Listening" : "Speak your request"} style={listening ? { background: "#fde3dc", color: "#e1251b" } : undefined}>
          <Mic size={18} />
        </button>
      )}
      <button type="submit" className="round-btn" aria-label="Search"><SearchIcon size={20} /></button>
    </form>
  );
}

function nearbyProviders(): SearchResult[] {
  const s = getState();
  const me = s.users.find((u) => u.id === s.currentUserId)!;
  const zones = zonesFor(me.home);
  const out: SearchResult[] = [];
  for (const p of s.providers) {
    if (p.id === me.id || !p.active || p.hidden) continue;
    const svc = s.services.find((x) => x.providerId === p.id && !x.online) ?? s.services.find((x) => x.providerId === p.id);
    if (!svc) continue;
    const { ring, distance } = ringFor(me.home, zones, p.exact, s.config.ringsKm);
    if (ring < 0 || ring > 3) continue;
    const stats = ratingStats(p, s.reviews, s.config);
    if (!stats.acceptable) continue;
    out.push({ provider: p, service: svc, distanceM: distance, ring, ringLabel: ringLabel(ring, zones, s.config.ringsKm), stats });
  }
  return out.sort((a, b) => a.ring - b.ring || a.distanceM - b.distanceM).slice(0, 10);
}

export function Home() {
  const { s, me } = useMe();
  const zones = zonesFor(me.home);
  const township = TOWNSHIPS.find((t) => t.id === zones.township?.townshipId);
  const near = useMemo(nearbyProviders, [s.currentUserId, s.providers.length, s.reviews.length]);
  const promos = s.promotions.filter((p) => p.active && p.townshipId === township?.id);
  const promoIds = promos.map((p) => p.id).join(",");
  useEffect(() => {
    if (!promoIds) return;
    run((st) => st.promotions.forEach((p) => promoIds.split(",").includes(p.id) && (p.impressions += 1)));
  }, [promoIds]);

  const owed = outstanding(s, me.id);
  const needsConfirm = s.bookings.filter((b) => b.residentId === me.id && (b.status === "accepted" || (b.status === "requested" && b.proposedStart)));
  const toReview = s.bookings.filter((b) => b.residentId === me.id && b.status === "completed" && b.payment !== "due");
  const upcoming = s.bookings
    .filter((b) => b.residentId === me.id && b.status === "confirmed" && new Date(b.end) > new Date())
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  return (
    <>
      <section className="hero" aria-label="Search for services">
        <AerialCanvas seed={township?.id === "elmina" ? 11 : township?.id === "kleast" ? 29 : 5} />
        <div className="wrap hero-inner">
          <span className="hero-eyebrow">{zones.building?.name ?? zones.precinct?.name ?? "Your neighbourhood"} · {township?.name ?? "Sime Darby Property township"}</span>
          <h1>Help is a few doors away</h1>
          <p className="hero-sub">Selamat datang, {firstName(me.name)}. Book trusted services from verified neighbours, starting with your own {zones.building ? "building" : "taman"}. Describe the problem in any language.</p>
          <HeroSearch />
          <button className="hero-link" onClick={() => navigate({ name: "search" })}>Or browse all services <ArrowRight size={15} /></button>
        </div>
      </section>
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <span key={k}>
              <span>Verified neighbours</span><ArrowRight size={18} /><span>Your building first, then your taman</span><ArrowRight size={18} />
              <span>Book a slot in seconds</span><ArrowRight size={18} /><span>Pay safely when the job is done</span><ArrowRight size={18} />
            </span>
          ))}
        </div>
      </div>

      <main className="page">
        <div className="wrap stack">
          {(me.verify !== "verified" || owed.length > 0 || needsConfirm.length > 0 || toReview.length > 0 || upcoming) && (
            <div className="stack-sm">
              {me.verify !== "verified" && (
                <div className="notice n-warn"><ShieldAlert size={18} /><div className="grow"><b>Residency check in progress.</b> You can browse now. Booking unlocks once the township team approves your home.</div></div>
              )}
              {owed.map((b) => (
                <button key={b.id} className="notice n-bad" style={{ border: 0, textAlign: "left", cursor: "pointer" }} onClick={() => navigate({ name: "booking", id: b.id })}>
                  <Wallet size={18} /><div className="grow"><b>{rm(b.price - b.amountPaid)} due</b> to {nameOf(s, b.providerId)}. Pay now to keep booking.</div><ArrowRight size={18} />
                </button>
              ))}
              {needsConfirm.map((b) => (
                <button key={b.id} className="notice n-info" style={{ border: 0, textAlign: "left", cursor: "pointer" }} onClick={() => navigate({ name: "booking", id: b.id })}>
                  <CalendarCheck size={18} /><div className="grow"><b>{nameOf(s, b.providerId)}</b> {b.proposedStart ? "proposed another time." : `accepted at ${rm(b.price)}. Confirm to lock the slot.`}</div><ArrowRight size={18} />
                </button>
              ))}
              {toReview.map((b) => (
                <button key={b.id} className="notice n-ok" style={{ border: 0, textAlign: "left", cursor: "pointer" }} onClick={() => navigate({ name: "booking", id: b.id })}>
                  <CalendarCheck size={18} /><div className="grow"><b>How was {nameOf(s, b.providerId)}?</b> Your review helps neighbours choose.</div><ArrowRight size={18} />
                </button>
              ))}
              {upcoming && (
                <button className="notice n-info" style={{ border: 0, textAlign: "left", cursor: "pointer" }} onClick={() => navigate({ name: "booking", id: upcoming.id })}>
                  <Clock3 size={18} /><div className="grow"><b>Next:</b> {nameOf(s, upcoming.providerId)}, {fmtSlot(upcoming.start, upcoming.end)}</div><ArrowRight size={18} />
                </button>
              )}
            </div>
          )}

          <section className="stack-sm" aria-labelledby="h-near">
            <div className="section-head">
              <div>
                <h2 className="section-title" id="h-near">From your neighbours</h2>
                <p className="section-sub">Closest first: {zones.building ? "your building, then " : ""}{zones.precinct?.name ?? "your area"}, then {zones.township?.name ?? "nearby"}.</p>
              </div>
            </div>
            <div className="hscroll">
              {near.map((r) => <ProviderCard key={r.provider.id} r={r} onOpen={() => navigate({ name: "provider", id: r.provider.id })} />)}
            </div>
          </section>

          {promos.length > 0 && (
            <section className="stack-sm" aria-labelledby="h-promo">
              <div className="section-head"><h2 className="section-title" id="h-promo">Around your township</h2></div>
              <div className="grid-cards">
                {promos.map((p) => (
                  <button key={p.id} className="card" style={{ textAlign: "left", border: 0, display: "grid", gap: 8, color: "var(--ink)" }}
                    onClick={() => run((st) => { const x = st.promotions.find((y) => y.id === p.id); if (x) x.clicks++; }, "Thanks! In the real app this opens the offer.")}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="badge b-sponsored">Sponsored</span>
                      <span className="small muted strong">{p.sponsor}</span>
                    </div>
                    <div className="strong" style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{p.title}</div>
                    <p className="small muted">{p.body}</p>
                  </button>
                ))}
              </div>
              <p className="hint">Sponsored items sit in their own space and never change the order of search results.</p>
            </section>
          )}

          <section className="stack-sm" aria-labelledby="h-towns">
            <div className="section-head">
              <div>
                <h2 className="section-title" id="h-towns">Townships in this demo</h2>
                <p className="section-sub">One growing township and one mature one, to show the same ranking works at both stages.</p>
              </div>
            </div>
            <div className="township-cards">
              {TOWNSHIPS.map((t, i) => {
                const persona = t.id === "elmina" ? PERSONAS[0] : t.id === "melawati" ? PERSONAS[1] : PERSONAS[2];
                const count = s.providers.filter((p) => zonesFor(p.exact).township?.townshipId === t.id).length;
                return (
                  <div key={t.id} className="tcard">
                    <AerialCanvas seed={[11, 5, 29][i]} dense={1.3} />
                    <div className="tcard-body">
                      <h3>{t.name}</h3>
                      <p className="small" style={{ opacity: 0.9 }}>{t.blurb} {count} sample providers.</p>
                      <button className="btn btn-white btn-sm" onClick={() => {
                        run((st) => { st.currentUserId = persona.id; st.mode = "resident"; });
                        navigate({ name: "home" }, { reset: true });
                      }}>
                        View as {persona.label} <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
