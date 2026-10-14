import { useMemo, useState } from "react";
import { ArrowLeft, Ban, BadgeCheck, CalendarClock, Facebook, Flag, Globe, Instagram, MapPin, Music2, Wallet } from "lucide-react";
import { AerialCanvas, Avatar, Empty, RatingLine, Sheet, Stars, TrustBadges, categoryName } from "../../components/ui";
import { MapView } from "../../components/MapView";
import { blurPoint, distanceLabel, zonesFor } from "../../lib/geo";
import { nameOf, useMe } from "../../lib/hooks";
import { back, navigate } from "../../lib/router";
import { ratingStats } from "../../lib/rating";
import { ringFor, ringLabel } from "../../lib/search";
import { attempt, run } from "../../lib/store";
import { reportProvider, toggleBlock } from "../../lib/domain";
import { rm, timeAgo } from "../../lib/time";
import { MessageSquareWarning } from "lucide-react";

export function ProviderProfile({ id, q }: { id: string; q?: string }) {
  const { s, me } = useMe();
  const p = s.providers.find((x) => x.id === id);
  const [tab, setTab] = useState<"all" | "booked" | "past">("all");
  const [reportOpen, setReportOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [reason, setReason] = useState("");
  const stats = useMemo(() => (p ? ratingStats(p, s.reviews, s.config) : null), [p, s]);
  if (!p || !stats) return <Empty icon={<MessageSquareWarning size={24} />} title="Provider not found" />;

  const services = s.services.filter((x) => x.providerId === p.id);
  const reviews = s.reviews.filter((r) => r.providerId === p.id && (tab === "all" || r.type === tab)).sort((a, b) => b.at.localeCompare(a.at));
  const zones = zonesFor(me.home);
  const { ring, distance } = ringFor(me.home, zones, p.exact, s.config.ringsKm);
  const pz = zonesFor(p.exact);
  const where = pz.building?.name ?? pz.precinct?.name ?? pz.township?.name ?? "Nearby";
  const blocked = me.blocked.includes(p.id);
  const pay = [p.payment.before && "Pay before (held until done)", p.payment.after && "Pay after the job", p.payment.depositPct > 0 && `${p.payment.depositPct}% deposit`].filter(Boolean) as string[];

  return (
    <div className="stack">
      <button className="link-btn" onClick={() => back({ name: "search" })} style={{ justifySelf: "start" }}><ArrowLeft size={16} /> Back</button>
      <section className="profile-hero">
        <div className="bg"><AerialCanvas seed={p.hue + 3} dense={1.4} /></div>
        <div className="profile-hero-inner" style={{ background: "linear-gradient(90deg, rgba(11,17,23,0.88), rgba(11,17,23,0.55))" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <Avatar name={p.displayName} hue={p.hue} large />
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              <h1 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800 }}>{p.displayName}</h1>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
                <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><MapPin size={15} /> {p.homeBased ? `Lives in ${where}` : where}</span>
                {ring >= 0 && <span className="tnum">{ringLabel(ring, zones, s.config.ringsKm)} · {distanceLabel(distance)}</span>}
                <span style={{ background: "rgba(255,255,255,0.92)", borderRadius: 999, padding: "2px 10px", color: "#1d2630" }}><RatingLine stats={stats} /></span>
              </div>
            </div>
          </div>
          <TrustBadges provider={p} stats={stats} />
        </div>
      </section>

      {blocked && <div className="notice n-warn"><Ban size={18} /><div className="grow">You blocked this provider. They won't appear in your results.</div></div>}

      <div className="two-col">
        <div className="stack">
          {p.bio && <section className="card"><h2 className="section-title" style={{ fontSize: 17 }}>About</h2><p style={{ marginTop: 8 }}>{p.bio}</p></section>}
          <section className="card" aria-labelledby="h-svc">
            <h2 className="section-title" style={{ fontSize: 17 }} id="h-svc">Services</h2>
            <div>
              {services.map((sv) => (
                <div key={sv.id} className="svc-row">
                  <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
                    <div className="strong">{sv.title} {sv.online && <span className="badge b-plain" style={{ marginLeft: 4 }}><Globe size={11} /> Online</span>}</div>
                    <div className="small muted">{categoryName(sv.categoryId)} · {sv.description}</div>
                    <div className="price small">{rm(sv.priceMin)}{sv.priceMax > sv.priceMin ? ` to ${rm(sv.priceMax)}` : ""} <span className="muted" style={{ fontWeight: 600 }}>{sv.priceUnit}</span></div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate({ name: "book", serviceId: sv.id, q })} disabled={me.id === p.id}>
                    <CalendarClock size={15} /> Book
                  </button>
                </div>
              ))}
            </div>
            {p.introOffer && stats.isNew && <div className="notice n-warn" style={{ marginTop: 8 }}><b>New neighbour offer:</b>&nbsp;{p.introOffer}</div>}
          </section>

          <section className="card" aria-labelledby="h-rev">
            <div className="section-head">
              <h2 className="section-title" style={{ fontSize: 17 }} id="h-rev">Reviews</h2>
              <div className="seg" role="group" aria-label="Filter reviews">
                <button aria-pressed={tab === "all"} onClick={() => setTab("all")}>All</button>
                <button aria-pressed={tab === "booked"} onClick={() => setTab("booked")}>Booked ({stats.bookedCount})</button>
                <button aria-pressed={tab === "past"} onClick={() => setTab("past")}>Past customers ({stats.pastTotal})</button>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              "Booked via JiranLink" reviews come from completed jobs and count fully. "Past customer" reviews come from verified neighbours who used this provider before joining, count at half weight, and only the first {s.config.pastMax} count.
            </p>
            <div style={{ marginTop: 6 }}>
              {reviews.length === 0 && <p className="muted small" style={{ padding: "12px 0" }}>No reviews here yet.</p>}
              {reviews.slice(0, showAll ? reviews.length : 5).map((r) => {
                const author = s.users.find((u) => u.id === r.authorId);
                const az = author ? zonesFor(author.home) : null;
                return (
                  <div key={r.id} className="review">
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Stars value={r.stars} />
                      <span className={`badge ${r.type === "booked" ? "b-verified" : "b-plain"}`}>{r.type === "booked" ? <><BadgeCheck size={12} /> Booked via JiranLink</> : "Past customer"}</span>
                      <span className="tiny muted">{timeAgo(r.at)}</span>
                    </div>
                    {r.text && <p style={{ fontSize: 14.5 }}>{r.text}</p>}
                    <span className="tiny muted">{nameOf(s, r.authorId).split(" ")[0]}{az?.precinct || az?.building ? `, ${(az.building ?? az.precinct)!.name}` : ""}</span>
                  </div>
                );
              })}
              {reviews.length > 5 && <button className="link-btn" style={{ marginTop: 6 }} onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${reviews.length} reviews`}</button>}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card stack-sm">
            <h2 className="section-title" style={{ fontSize: 17 }}>Where</h2>
            <MapView className="short" center={p.homeBased ? blurPoint(p.exact) : p.exact} zoom={15} home={me.home} googleKey={s.config.mapsKey}
              pins={[{ id: p.id, point: p.homeBased ? blurPoint(p.exact) : p.exact, area: p.homeBased, label: p.displayName.slice(0, 2).toUpperCase(), hue: p.hue }]} />
            <p className="small muted">{p.homeBased ? "Home-based: only the general area is shown. The exact address is shared after you confirm a booking, if the job needs it." : "Shop or business location."} Serves up to {p.serviceRadiusKm} km away.</p>
          </section>
          <section className="card stack-sm">
            <h2 className="section-title" style={{ fontSize: 17 }}>Payment</h2>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>{pay.map((x) => <li key={x}>{x}</li>)}</ul>
            <p className="hint" style={{ display: "flex", gap: 6 }}><Wallet size={14} /> Demo payments only in this prototype.</p>
          </section>
          {(p.social.instagram || p.social.facebook || p.social.tiktok) && (
            <section className="card stack-sm">
              <h2 className="section-title" style={{ fontSize: 17 }}>Elsewhere</h2>
              <div className="chips">
                {p.social.instagram && <a className="chip" href={`https://instagram.com/${p.social.instagram}`} target="_blank" rel="noreferrer"><Instagram size={15} /> @{p.social.instagram}</a>}
                {p.social.facebook && <a className="chip" href={`https://facebook.com/${p.social.facebook}`} target="_blank" rel="noreferrer"><Facebook size={15} /> {p.social.facebook}</a>}
                {p.social.tiktok && <a className="chip" href={`https://tiktok.com/@${p.social.tiktok}`} target="_blank" rel="noreferrer"><Music2 size={15} /> @{p.social.tiktok}</a>}
              </div>
              <p className="hint">{p.socialVerified ? "Ownership confirmed: the provider placed their JiranLink code in their bio." : "Not yet confirmed as theirs."}</p>
            </section>
          )}
          <div className="btn-row">
            <button className="btn btn-outline btn-sm" onClick={() => setReportOpen(true)}><Flag size={15} /> Report</button>
            <button className="btn btn-quiet btn-sm" onClick={() => run((st) => toggleBlock(st, me.id, p.id), blocked ? "Unblocked" : "Blocked. They won't appear in your results.")}>
              <Ban size={15} /> {blocked ? "Unblock" : "Block"}
            </button>
          </div>
        </div>
      </div>

      {reportOpen && (
        <Sheet title={`Report ${p.displayName}`} onClose={() => setReportOpen(false)}>
          <div className="field">
            <label htmlFor="reason">What happened?</label>
            <textarea id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: didn't turn up, unsafe behaviour, fake listing" />
            <span className="hint">The township team reviews every report. The provider doesn't see who reported them.</span>
          </div>
          <button className="btn btn-primary" onClick={() => { if (attempt((st) => reportProvider(st, me.id, p.id, reason), "Report sent to the township team")) { setReportOpen(false); setReason(""); } }}>Send report</button>
        </Sheet>
      )}
    </div>
  );
}
