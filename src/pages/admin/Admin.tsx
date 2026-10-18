import { useState } from "react";
import { BarChart3, Check, EyeOff, Flag, Megaphone, RotateCcw, Settings, ShieldCheck, X } from "lucide-react";
import { Empty } from "../../components/ui";
import { TOWNSHIPS, zoneById } from "../../data/geo";
import { nameOf, useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { attempt, resetDemo, toast } from "../../lib/store";
import { resolveReport, setProviderHidden, setVerification, updateConfig } from "../../lib/domain";
import { zonesFor } from "../../lib/geo";
import { timeAgo, rm } from "../../lib/time";
import { DEFAULT_MODELS } from "../../ai/adapter";
import { AiCheck } from "./AiCheck";
import type { AiProvider, Config } from "../../data/types";

const TABS = [
  { id: "verify", label: "Verify residents", icon: ShieldCheck },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "promotions", label: "Promotions", icon: Megaphone },
  { id: "stats", label: "Pilot numbers", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function Admin({ tab = "verify" }: { tab?: string }) {
  const { me } = useMe();
  if (!me.isAdmin) return <div className="card-flat"><Empty icon={<ShieldCheck size={24} />} title="Township team only" /></div>;
  const current = TABS.find((t) => t.id === tab)?.id ?? "verify";
  return (
    <div className="stack">
      <div>
        <span className="hero-eyebrow" style={{ color: "var(--red)" }}>Township team console</span>
        <h1 className="page-title">Elmina and KL East pilot</h1>
      </div>
      <div className="seg" role="tablist" aria-label="Admin sections" style={{ flexWrap: "wrap", justifySelf: "start", borderRadius: 18 }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={current === t.id} aria-pressed={current === t.id} onClick={() => navigate({ name: "admin", tab: t.id }, { replace: true })}><t.icon size={14} /> {t.label}</button>
        ))}
      </div>
      {current === "verify" && <VerifyTab />}
      {current === "reports" && <ReportsTab />}
      {current === "promotions" && <PromotionsTab />}
      {current === "stats" && <StatsTab />}
      {current === "settings" && <SettingsTab />}
    </div>
  );
}

function VerifyTab() {
  const { s } = useMe();
  const pending = s.users.filter((u) => u.verify === "pending");
  const recent = s.users.filter((u) => u.verify === "verified" && !u.id.startsWith("u-f-")).slice(-6).reverse();
  return (
    <div className="stack-sm">
      <p className="small muted">Residents who joined without a management-office invite code. Check their unit against your owner records, then approve. Approving lets them book and offer services.</p>
      {pending.length === 0 && <div className="card-flat"><Empty icon={<Check size={24} />} title="Nobody waiting" /></div>}
      {pending.map((u) => {
        const z = zonesFor(u.home);
        const housemates = s.users.filter((x) => x.unitKey === u.unitKey && x.id !== u.id).length;
        return (
          <div key={u.id} className="card stack-sm">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span className="strong">{u.name}</span>
                <span className="small">{u.unit}, {(z.building ?? z.precinct ?? z.township)?.name ?? u.homeLabel}</span>
                <span className="tiny muted tnum">{u.phone} · joined {timeAgo(u.createdAt)} · {housemates} other {housemates === 1 ? "member" : "members"} in this unit</span>
              </div>
              <div className="btn-row" style={{ flex: "none" }}>
                <button className="btn btn-primary btn-sm" onClick={() => attempt((st) => setVerification(st, u.id, "verified"), `${u.name.split(" ")[0]} approved`)}><Check size={14} /> Approve</button>
                <button className="btn btn-quiet btn-sm" onClick={() => attempt((st) => setVerification(st, u.id, "unverified"), "Rejected")}><X size={14} /> Reject</button>
              </div>
            </div>
            <span className="hint">{u.verifyNote}</span>
          </div>
        );
      })}
      {recent.length > 0 && (
        <>
          <h2 className="section-title" style={{ fontSize: 16, marginTop: 8 }}>Recently verified</h2>
          <div className="card table-wrap">
            <table className="tbl">
              <thead><tr><th>Resident</th><th>Home</th><th>How</th></tr></thead>
              <tbody>{recent.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.homeLabel}</td><td className="small">{u.verifyNote ?? "Verified"}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ReportsTab() {
  const { s } = useMe();
  const open = s.reports.filter((r) => r.status === "open");
  const hidden = s.providers.filter((p) => p.hidden);
  return (
    <div className="stack-sm">
      {open.length === 0 && <div className="card-flat"><Empty icon={<Flag size={24} />} title="No open reports" /></div>}
      {open.map((r) => {
        const reviews = s.reviews.filter((x) => x.providerId === r.providerId);
        const avg = reviews.length ? reviews.reduce((t, x) => t + x.stars, 0) / reviews.length : 0;
        return (
          <div key={r.id} className="card stack-sm">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span className="strong">{nameOf(s, r.providerId)}</span>
                <span className="small">"{r.reason}"</span>
                <span className="tiny muted">Reported by {nameOf(s, r.reporterId)} · {timeAgo(r.at)} · {reviews.length} reviews averaging {avg.toFixed(1)}</span>
              </div>
              <div className="btn-row" style={{ flex: "none" }}>
                <button className="btn btn-outline btn-sm" onClick={() => navigate({ name: "provider", id: r.providerId })}>View profile</button>
                <button className="btn btn-danger btn-sm" onClick={() => attempt((st) => resolveReport(st, r.id, "hide"), "Provider hidden from search")}><EyeOff size={14} /> Hide provider</button>
                <button className="btn btn-quiet btn-sm" onClick={() => attempt((st) => resolveReport(st, r.id, "dismiss"), "Report dismissed")}>Dismiss</button>
              </div>
            </div>
          </div>
        );
      })}
      {hidden.length > 0 && (
        <>
          <h2 className="section-title" style={{ fontSize: 16, marginTop: 8 }}>Hidden providers</h2>
          {hidden.map((p) => (
            <div key={p.id} className="card-flat" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>{p.displayName}</span>
              <button className="btn btn-outline btn-sm" onClick={() => attempt((st) => setProviderHidden(st, p.id, false), "Provider restored")}>Restore</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function PromotionsTab() {
  const { s } = useMe();
  return (
    <div className="stack-sm">
      <p className="small muted">Only Sime Darby Property sources: its malls, township events and launches. Promotions sit in their own "Sponsored" slot and never change search ranking.</p>
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>Promotion</th><th>Township</th><th>Seen</th><th>Taps</th><th>Rate</th><th>Live</th></tr></thead>
          <tbody>
            {s.promotions.map((p) => (
              <tr key={p.id}>
                <td><div className="strong">{p.title}</div><div className="tiny muted">{p.sponsor} · {p.source === "mall" ? "Mall" : p.source === "event" ? "Township event" : "Launch"}</div></td>
                <td className="small">{TOWNSHIPS.find((t) => t.id === p.townshipId)?.name}</td>
                <td className="tnum">{p.impressions}</td>
                <td className="tnum">{p.clicks}</td>
                <td className="tnum">{p.impressions ? `${((p.clicks / p.impressions) * 100).toFixed(1)}%` : "–"}</td>
                <td><label className="check"><input type="checkbox" aria-label={`${p.title} live`} checked={p.active} onChange={() => attempt((st) => { const x = st.promotions.find((y) => y.id === p.id); if (x) x.active = !x.active; })} /></label></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatsTab() {
  const { s } = useMe();
  const real = s.users.filter((u) => !u.isAdmin);
  const verified = real.filter((u) => u.verify === "verified").length;
  const bookings = s.bookings;
  const done = bookings.filter((b) => b.status === "completed" || b.status === "reviewed");
  const value = done.reduce((t, b) => t + b.price, 0);
  const booked = s.reviews.filter((r) => r.type === "booked").length;
  const past = s.reviews.filter((r) => r.type === "past").length;
  const passes = s.gatePasses.length;
  const byTownship = TOWNSHIPS.map((t) => ({
    t,
    providers: s.providers.filter((p) => zonesFor(p.exact).township?.townshipId === t.id).length,
    residents: real.filter((u) => zonesFor(u.home).township?.townshipId === t.id).length,
  }));
  return (
    <div className="stack-sm">
      <div className="stat-row">
        <div className="stat"><div className="v">{verified}</div><div className="k">Verified residents</div></div>
        <div className="stat"><div className="v">{s.providers.length}</div><div className="k">Providers</div></div>
        <div className="stat"><div className="v">{bookings.length}</div><div className="k">Bookings</div></div>
        <div className="stat"><div className="v">{rm(value)}</div><div className="k">Value of completed jobs</div></div>
        <div className="stat"><div className="v">{booked}/{past}</div><div className="k">Reviews: booked / past customer</div></div>
        <div className="stat"><div className="v">{passes}</div><div className="k">Gate passes issued</div></div>
      </div>
      <div className="card table-wrap">
        <table className="tbl">
          <thead><tr><th>Township</th><th>Residents</th><th>Providers</th></tr></thead>
          <tbody>{byTownship.map(({ t, providers, residents }) => <tr key={t.id}><td>{t.name}</td><td className="tnum">{residents}</td><td className="tnum">{providers}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="hint">All numbers are from sample data in this demo. Zones such as {zoneById("quarza")?.name} use approximate boundaries.</p>
    </div>
  );
}

function SettingsTab() {
  const { s } = useMe();
  const [c, setC] = useState<Config>({ ...s.config });
  const [confirmReset, setConfirmReset] = useState(false);
  const num = (k: keyof Config, label: string, step = 1, hint?: string) => (
    <div className="field">
      <label htmlFor={`cfg-${k}`}>{label}</label>
      <input id={`cfg-${k}`} className="input tnum" type="number" step={step} value={c[k] as number} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
  return (
    <div className="stack-sm" style={{ maxWidth: 860 }}>
      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 16 }}>Ranking and newcomers</h2>
        <div className="form-grid">
          {num("qualityFloor", "Quality floor (stars)", 0.1, "Providers below this are hidden from search")}
          {num("floorExemptReviews", "Exempt from floor below (reviews)")}
          {num("newMaxReviews", "Newcomer: fewer than (reviews)")}
          {num("newMaxDays", "Newcomer: within (days)")}
          {num("targetResults", "Stop widening at (results)")}
          {num("exceptionStarGap", "Exception card: better by (stars)", 0.1)}
          {num("holdHours", "Slot hold (hours)")}
        </div>
      </section>
      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 16 }}>AI helper</h2>
        <div className="form-grid">
          {num("aiConfident", "Confident at", 0.05)}
          {num("aiLead", "Lead over second", 0.05)}
          {num("aiLost", "Ask one question below", 0.05)}
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cfg-ai">Language model</label>
            <select id="cfg-ai" className="input" value={c.aiProvider} onChange={(e) => { const v = e.target.value as AiProvider; setC({ ...c, aiProvider: v, aiModel: v === "gemini" || v === "claude" ? DEFAULT_MODELS[v] : "" }); }}>
              <option value="none">Off (keywords only)</option>
              <option value="proxy">JiranLink AI server (recommended)</option>
              <option value="gemini">Gemini, key in this browser</option>
              <option value="claude">Claude, key in this browser (search only)</option>
            </select>
          </div>
          {c.aiProvider === "proxy" ? (
            <div className="field" style={{ gridColumn: "span 2" }}><label htmlFor="cfg-proxy">AI server address</label><input id="cfg-proxy" className="input" value={c.aiProxyUrl} placeholder="https://<project>.vercel.app/api" onChange={(e) => setC({ ...c, aiProxyUrl: e.target.value.trim() })} /></div>
          ) : (
            <>
              <div className="field"><label htmlFor="cfg-model">Model</label><input id="cfg-model" className="input" value={c.aiModel} disabled={c.aiProvider === "none"} onChange={(e) => setC({ ...c, aiModel: e.target.value })} /></div>
              <div className="field"><label htmlFor="cfg-key">API key</label><input id="cfg-key" className="input" type="password" autoComplete="off" value={c.aiKey} disabled={c.aiProvider === "none"} onChange={(e) => setC({ ...c, aiKey: e.target.value })} /></div>
            </>
          )}
        </div>
        <p className="hint">The AI server keeps the key on Cloudflare, so nobody using the app can see it. A key typed here stays in this browser and anyone with access to it could read it; use that only on your own laptop.</p>
      </section>
      <AiCheck />
      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 16 }}>Maps</h2>
        <div className="field"><label htmlFor="cfg-maps">Google Maps JavaScript API key</label><input id="cfg-maps" className="input" type="password" autoComplete="off" value={c.mapsKey} onChange={(e) => setC({ ...c, mapsKey: e.target.value })} /><span className="hint">Leave blank to use OpenStreetMap.</span></div>
        <div className="field"><label htmlFor="cfg-mapid">Google Map ID</label><input id="cfg-mapid" className="input" autoComplete="off" value={c.mapId} onChange={(e) => setC({ ...c, mapId: e.target.value })} /><span className="hint">Needed for the price pins. Without it the map uses plain pins.</span></div>
      </section>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => attempt((st) => updateConfig(st, c), "Settings saved")}>Save settings</button>
        <button className="btn btn-quiet" onClick={() => setC({ ...s.config })}>Undo changes</button>
      </div>
      <section className="card-flat stack-sm">
        <h2 className="strong">Demo data</h2>
        {!confirmReset ? (
          <button className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> Reset demo</button>
        ) : (
          <div className="btn-row">
            <button className="btn btn-danger btn-sm" onClick={() => { resetDemo(); navigate({ name: "home" }, { reset: true }); toast("Demo reset"); }}>Yes, reset everything</button>
            <button className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        )}
      </section>
    </div>
  );
}
