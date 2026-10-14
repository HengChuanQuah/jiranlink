import { useState } from "react";
import { BadgeCheck, Ban, Hourglass, Lock, RotateCcw, Star, Store } from "lucide-react";
import { Avatar, StarInput } from "../../components/ui";
import { zonesFor } from "../../lib/geo";
import { nameOf, useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { attempt, resetDemo, toast } from "../../lib/store";
import { addPastReview, becomeProvider, residentReliability, toggleBlock } from "../../lib/domain";

export function Profile() {
  const { s, me, myProvider } = useMe();
  const z = zonesFor(me.home);
  const [shopName, setShopName] = useState("");
  const [code, setCode] = useState("");
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const rel = residentReliability(s, me.id);

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <section className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar name={me.name} hue={205} large />
        <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
          <h1 className="page-title">{me.name}</h1>
          <div className="small muted">{[z.building?.name, z.precinct?.name, z.township?.name].filter(Boolean).join(", ") || me.homeLabel}</div>
          {me.verify === "verified" ? <span className="badge b-verified" style={{ justifySelf: "start" }}><BadgeCheck size={13} /> Verified resident</span> : <span className="badge b-offer" style={{ justifySelf: "start" }}><Hourglass size={12} /> Verification pending</span>}
        </div>
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}>Your home</h2>
        <dl className="kv">
          <dt>Unit</dt><dd style={{ display: "flex", gap: 6, alignItems: "center" }}><Lock size={14} /> {me.unit} <span className="muted small">(only the township team sees this)</span></dd>
          <dt>Phone</dt><dd className="tnum">{me.phone.replace(/(\d{3})(\d+)(\d{3})/, "$1 •••• $3")}</dd>
          <dt>Verification</dt><dd>{me.verifyNote ?? (me.verify === "verified" ? "Verified" : "Pending")}</dd>
          <dt>Your record</dt><dd>{rel.completed} completed {rel.completed === 1 ? "job" : "jobs"}, {rel.unpaid} unpaid, {rel.cancelled} cancelled</dd>
        </dl>
        <p className="hint">One account per phone number, and every account belongs to a real unit. That's what stops fake accounts and fake reviews.</p>
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}>Offer your own service</h2>
        {myProvider ? (
          <>
            <p>You're listed as <b>{myProvider.displayName}</b>.</p>
            <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={() => { attempt((st) => { st.mode = "provider"; }); navigate({ name: "p-dashboard" }, { reset: true }); }}><Store size={16} /> Open provider mode</button>
          </>
        ) : (
          <>
            <p className="small muted">Bake, tutor, fix things or walk dogs? Neighbours see you first, before businesses further away.</p>
            <div className="field" style={{ maxWidth: 360 }}>
              <label htmlFor="shop">Name customers will see</label>
              <input id="shop" className="input" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder={`${me.name.split(" ")[0]}'s Kitchen`} />
            </div>
            <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={() => {
              if (attempt((st) => { becomeProvider(st, me.id, shopName); st.mode = "provider"; }, "You're now a provider. Add your first service.")) navigate({ name: "p-services" }, { reset: true });
            }}><Store size={16} /> Start offering a service</button>
          </>
        )}
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}>Review someone you used before</h2>
        <p className="small muted">Bought from a neighbour before JiranLink? Ask them for their invite code. Past-customer reviews are labelled, count at half weight, and only neighbours in the same township can write them.</p>
        <div className="form-grid">
          <div className="field"><label htmlFor="pc">Invite code</label><input id="pc" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ANI-OLD-7Q2" /></div>
        </div>
        <StarInput value={stars} onChange={setStars} />
        <div className="field"><label htmlFor="pt">What was it like?</label><textarea id="pt" className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} /></div>
        <button className="btn btn-outline" style={{ justifySelf: "start" }} disabled={!stars || !code} onClick={() => {
          const ok = attempt((st) => addPastReview(st, code, me.id, stars, text));
          if (ok) { toast("Thanks. Your past-customer review is live."); setCode(""); setStars(0); setText(""); }
        }}><Star size={16} /> Post past-customer review</button>
        <p className="hint">Demo code for Kak Ani's Kitchen: ANI-OLD-7Q2 (works for Elmina residents).</p>
      </section>

      {me.blocked.length > 0 && (
        <section className="card stack-sm">
          <h2 className="section-title" style={{ fontSize: 17 }}>Blocked</h2>
          {me.blocked.map((id) => (
            <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>{nameOf(s, id)}</span>
              <button className="btn btn-quiet btn-sm" onClick={() => attempt((st) => toggleBlock(st, me.id, id), "Unblocked")}><Ban size={14} /> Unblock</button>
            </div>
          ))}
        </section>
      )}

      <section className="card-flat stack-sm">
        <h2 className="strong">Demo data</h2>
        <p className="small muted">Everything you do is saved in this browser only. Reset to start the demo fresh.</p>
        {!confirmReset ? (
          <button className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> Reset demo</button>
        ) : (
          <div className="btn-row">
            <button className="btn btn-danger btn-sm" onClick={() => { resetDemo(); navigate({ name: "home" }, { reset: true }); toast("Demo reset"); }}>Yes, reset everything</button>
            <button className="btn btn-quiet btn-sm" onClick={() => setConfirmReset(false)}>Keep my changes</button>
          </div>
        )}
      </section>
    </div>
  );
}
