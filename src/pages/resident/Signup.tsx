import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Home as HomeIcon, ShieldCheck } from "lucide-react";
import { KNOWN_PLACES } from "../../data/geo";
import { back, navigate } from "../../lib/router";
import { act, toast } from "../../lib/store";
import { signUp } from "../../lib/domain";

const DEMO_OTP = "123456";

export function Signup() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeIndex, setPlaceIndex] = useState(-1);
  const [unit, setUnit] = useState("");
  const [code, setCode] = useState("");
  const matches = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    return KNOWN_PLACES.map((p, i) => ({ p, i })).filter(({ p }) => !q || p.label.toLowerCase().includes(q));
  }, [placeQuery]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent || otp !== DEMO_OTP) {
      toast("Enter the 6-digit code sent to your phone.", "error");
      return;
    }
    const r = act((s) => {
      const u = signUp(s, { name, phone, placeIndex, unit, inviteCode: code });
      s.currentUserId = u.id;
      s.mode = "resident";
      return u;
    });
    if (!r.ok) return toast(r.error, "error");
    toast(r.value.verify === "verified" ? "Welcome! Your home is verified." : "Account created. The township team will check your residence.");
    navigate({ name: "home" }, { reset: true });
  };

  return (
    <form className="stack" style={{ maxWidth: 640 }} onSubmit={submit}>
      <button type="button" className="link-btn" onClick={() => back()} style={{ justifySelf: "start" }}><ArrowLeft size={16} /> Back</button>
      <div>
        <h1 className="page-title">Join your neighbourhood</h1>
        <p className="section-sub">JiranLink is only for verified residents. That's what makes it safe to let a neighbour into your home.</p>
      </div>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}>1. You</h2>
        <div className="field"><label htmlFor="nm">Full name</label><input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
        <div className="field">
          <label htmlFor="ph">Mobile number</label>
          <div className="composer">
            <input id="ph" className="input tnum" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0123456789" autoComplete="tel" />
            <button type="button" className="btn btn-outline" onClick={() => { if (!/^01\d{7,9}$/.test(phone.replace(/\D/g, ""))) return toast("Enter a Malaysian mobile number, for example 0123456789.", "error"); setOtpSent(true); toast(`Demo: your code is ${DEMO_OTP}`, "info"); }}>Send code</button>
          </div>
          <span className="hint">Each phone number can join one home only.</span>
        </div>
        {otpSent && <div className="field" style={{ maxWidth: 220 }}><label htmlFor="otp">6-digit code</label><input id="otp" className="input tnum" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} /><span className="hint">Demo code: {DEMO_OTP}</span></div>}
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}>2. Your home</h2>
        <div className="field">
          <label htmlFor="pl">Search your building or taman</label>
          <input id="pl" className="input" value={placeQuery} onChange={(e) => { setPlaceQuery(e.target.value); setPlaceIndex(-1); }} placeholder="Quarza Residence, Elmina Green, Taman Melawati…" />
          <span className="hint">The full app uses Google Places here. This demo lists the pilot areas.</span>
        </div>
        <div className="stack-sm" role="listbox" aria-label="Places">
          {matches.map(({ p, i }) => (
            <button type="button" key={p.label} className="option-card" role="option" aria-selected={placeIndex === i} aria-pressed={placeIndex === i} onClick={() => { setPlaceIndex(i); setPlaceQuery(p.label); }}>
              <span className="radio" />
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>{p.kind === "building" ? <Building2 size={16} /> : <HomeIcon size={16} />} {p.label}</span>
            </button>
          ))}
        </div>
        <div className="field"><label htmlFor="un">House or unit number</label><input id="un" className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Tower A, 12-05 or No. 22" /><span className="hint">Kept private. Neighbours only ever see your building or taman.</span></div>
      </section>

      <section className="card stack-sm">
        <h2 className="section-title" style={{ fontSize: 17 }}>3. Prove you live there</h2>
        <div className="field"><label htmlFor="ic">Invite code from your management office (optional)</label><input id="ic" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ELM-GRN-1024" /></div>
        <p className="hint">Demo codes: ELM-GRN-1024 (Elmina Green), QRZ-12A-0705 (Quarza Residence), MLW-N-0331 (Taman Melawati north). Leave blank to be checked by the township team instead.</p>
        <p className="small muted" style={{ display: "flex", gap: 6 }}><ShieldCheck size={16} style={{ flex: "none" }} /> We never ask for your IC number. The invite code proves your unit; your phone number keeps it to one account.</p>
      </section>

      <button type="submit" className="btn btn-primary" style={{ justifySelf: "start" }} disabled={!name || placeIndex < 0}>Create account</button>
    </form>
  );
}
