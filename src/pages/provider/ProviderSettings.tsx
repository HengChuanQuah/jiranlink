import { useState } from "react";
import { BadgeCheck, Copy, Instagram, KeyRound, MapPin, Save, Star, Ticket, UserRound, Wallet } from "lucide-react";
import { useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { attempt, getState, toast } from "../../lib/store";
import { createPastInvite, updateProvider, verifySocial } from "../../lib/domain";
import { zonesFor } from "../../lib/geo";
import type { PaymentOptions, Provider, SocialLinks } from "../../data/types";
import { Empty } from "../../components/ui";

export function ProviderSettings() {
  const { myProvider } = useMe();
  if (!myProvider) return <div className="card-flat"><Empty icon={<UserRound size={24} />} title="You're not a provider yet"><button className="btn btn-primary" onClick={() => navigate({ name: "profile" })}>Get started</button></Empty></div>;
  return <SettingsForm key={myProvider.id} p={myProvider} />;
}

function SettingsForm({ p }: { p: Provider }) {
  const { s, me } = useMe();
  const [name, setName] = useState(p.displayName);
  const [bio, setBio] = useState(p.bio);
  const [offer, setOffer] = useState(p.introOffer ?? "");
  const [homeBased, setHomeBased] = useState(p.homeBased);
  const [radius, setRadius] = useState(p.serviceRadiusKm);
  const [pay, setPay] = useState<PaymentOptions>({ ...p.payment });
  const [social, setSocial] = useState<SocialLinks>({ ...p.social });
  const [inBio, setInBio] = useState(false);
  const z = zonesFor(p.exact);
  const invites = s.pastInvites.filter((i) => i.providerId === p.id);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast("Copied"), () => toast(`Code: ${text}`, "info"));
  };

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Your provider profile</h1>
          <p className="section-sub">Signed in as {me.name}. Your unit number is never shown to customers.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-outline btn-sm" onClick={() => navigate({ name: "p-reviews" })}><Star size={14} /> Reviews</button>
          <button className="btn btn-quiet btn-sm" onClick={() => { attempt((st) => { st.mode = "resident"; }); navigate({ name: "home" }, { reset: true }); }}><UserRound size={14} /> Switch to resident</button>
        </div>
      </div>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}>About you</h2>
        <div className="field"><label htmlFor="pn">Name customers see</label><input id="pn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="pb">Short bio</label><textarea id="pb" className="input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What you do, how long you've done it, what neighbours like about you." /></div>
        <div className="field"><label htmlFor="po">Intro offer (optional)</label><input id="po" className="input" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="10% off your first booking" /><span className="hint">Shown as a badge. Useful while you collect your first reviews.</span></div>
        <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} onClick={() => attempt((st) => updateProvider(st, p.id, { displayName: name.trim(), bio: bio.trim(), introOffer: offer.trim() }), "Profile saved")}><Save size={14} /> Save</button>
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}><MapPin size={16} /> Where you work</h2>
        <p className="small muted">Based in {[z.building?.name, z.precinct?.name, z.township?.name].filter(Boolean).join(", ")}.</p>
        <div className="stack-sm" role="radiogroup" aria-label="Location type">
          <button type="button" role="radio" className="option-card" aria-checked={homeBased} aria-pressed={homeBased} onClick={() => setHomeBased(true)}><span className="radio" /><span><b>I work from home</b><br /><span className="small muted">Map shows a blurred area of about 200 m, never your house.</span></span></button>
          <button type="button" role="radio" className="option-card" aria-checked={!homeBased} aria-pressed={!homeBased} onClick={() => setHomeBased(false)}><span className="radio" /><span><b>I have a shop or I come to you</b><br /><span className="small muted">Map shows a pin.</span></span></button>
        </div>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="rad">How far you'll travel: <b className="tnum">{radius} km</b></label>
          <input id="rad" type="range" min={0.5} max={20} step={0.5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          <span className="hint">Residents in your building and precinct always see you, whatever this is set to.</span>
        </div>
        <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} onClick={() => attempt((st) => updateProvider(st, p.id, { homeBased, serviceRadiusKm: radius }), "Saved")}><Save size={14} /> Save</button>
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}><Wallet size={16} /> How customers can pay</h2>
        <label className="check"><input type="checkbox" checked={pay.before} onChange={(e) => setPay({ ...pay, before: e.target.checked })} /> Pay before (JiranLink holds it until the job is done)</label>
        <label className="check"><input type="checkbox" checked={pay.after} onChange={(e) => setPay({ ...pay, after: e.target.checked })} /> Pay after the job</label>
        <label className="check"><input type="checkbox" checked={pay.depositPct > 0} onChange={(e) => setPay({ ...pay, depositPct: e.target.checked ? 30 : 0 })} /> Deposit first, balance after</label>
        {pay.depositPct > 0 && (
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="dep">Deposit</label>
            <select id="dep" className="input" value={pay.depositPct} onChange={(e) => setPay({ ...pay, depositPct: Number(e.target.value) })}>
              {[10, 20, 30, 40, 50].map((n) => <option key={n} value={n}>{n}%</option>)}
            </select>
          </div>
        )}
        <p className="hint">If you allow pay after, customers with an unpaid job can't book anyone until they settle it. You'll see each customer's payment record before you accept.</p>
        <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} onClick={() => attempt((st) => updateProvider(st, p.id, { payment: pay }), "Payment options saved")}><Save size={14} /> Save</button>
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}><Instagram size={16} /> Social accounts</h2>
        <p className="small muted">Link the pages where you already post your work. To prove they're yours, put this code in your bio:</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code className="badge b-plain" style={{ fontSize: 15, padding: "6px 12px" }}>{p.socialCode}</code>
          <button className="btn btn-quiet btn-sm" onClick={() => copy(p.socialCode)}><Copy size={14} /> Copy</button>
          {p.socialVerified && <span className="badge b-verified"><BadgeCheck size={13} /> Verified</span>}
        </div>
        <div className="form-grid">
          <div className="field"><label htmlFor="ig">Instagram</label><input id="ig" className="input" value={social.instagram ?? ""} onChange={(e) => setSocial({ ...social, instagram: e.target.value.replace(/^@/, "") || undefined })} placeholder="handle" /></div>
          <div className="field"><label htmlFor="fb">Facebook page</label><input id="fb" className="input" value={social.facebook ?? ""} onChange={(e) => setSocial({ ...social, facebook: e.target.value || undefined })} placeholder="page name" /></div>
          <div className="field"><label htmlFor="tt">TikTok</label><input id="tt" className="input" value={social.tiktok ?? ""} onChange={(e) => setSocial({ ...social, tiktok: e.target.value.replace(/^@/, "") || undefined })} placeholder="handle" /></div>
        </div>
        <div className="btn-row">
          <button className="btn btn-outline btn-sm" onClick={() => attempt((st) => updateProvider(st, p.id, { social }), "Links saved. Check ownership next.")}><Save size={14} /> Save links</button>
        </div>
        {!p.socialVerified && (
          <div className="card-flat stack-sm">
            <label className="check"><input type="checkbox" checked={inBio} onChange={(e) => setInBio(e.target.checked)} /> Demo: pretend {p.socialCode} is now in my bio</label>
            <button className="btn btn-primary btn-sm" style={{ justifySelf: "start" }} onClick={() => attempt((st) => verifySocial(st, p.id, inBio), "Ownership confirmed. Your links now show a verified tick.")}><KeyRound size={14} /> Check my bio</button>
            <span className="hint">The real app reads your public profile and looks for the code. You can remove it after.</span>
          </div>
        )}
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}><Ticket size={16} /> Bring your past customers</h2>
        <p className="small muted">Served neighbours before JiranLink? Give them a code so they can review you. These are labelled "Past customer", count at half weight, and at most {s.config.pastMax} count towards your rating. Only residents in your township can use them, one per home.</p>
        <button className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={() => {
          if (attempt((st) => { createPastInvite(st, p.id); })) {
            const code = getState().pastInvites.filter((i) => i.providerId === p.id).slice(-1)[0]?.code;
            if (code) toast(`New code: ${code}`, "info");
          }
        }}><Ticket size={14} /> Create invite code</button>
        {invites.length > 0 && (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Code</th><th>Used by</th><th></th></tr></thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.code}>
                    <td className="tnum strong">{i.code}</td>
                    <td>{i.usedBy.length} {i.usedBy.length === 1 ? "home" : "homes"}</td>
                    <td><button className="btn btn-quiet btn-sm" onClick={() => copy(i.code)} aria-label={`Copy ${i.code}`}><Copy size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
