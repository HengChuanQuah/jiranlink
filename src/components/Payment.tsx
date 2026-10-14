import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CreditCard, Landmark, Loader2, QrCode, ShieldCheck } from "lucide-react";
import type { Booking, PaymentMode } from "../data/types";
import { Sheet } from "./ui";
import { rm } from "../lib/time";

const BANKS = ["Maybank2u", "CIMB Clicks", "Public Bank", "RHB Now", "Hong Leong Connect", "Bank Islam", "AmBank"];
type Method = "fpx" | "duitnow" | "card";

/** Mock checkout. Always succeeds after a short delay. No money moves. */
export function Checkout({ amount, title, onPaid, onClose }: { amount: number; title: string; onPaid: (method: string) => void; onClose: () => void }) {
  const [method, setMethod] = useState<Method>("fpx");
  const [bank, setBank] = useState(BANKS[0]);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(`DEMO-DUITNOW|JiranLink|${amount.toFixed(2)}|${Date.now()}`, { margin: 1, width: 360, color: { dark: "#1d2630", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [amount]);

  const pay = () => {
    setBusy(true);
    setTimeout(() => {
      onPaid(method === "fpx" ? `FPX ${bank} (demo)` : method === "duitnow" ? "DuitNow QR (demo)" : "Card ending 4242 (demo)");
    }, 900);
  };

  return (
    <Sheet title={`Pay ${rm(amount)}`} onClose={busy ? () => {} : onClose} label="Demo checkout">
      <span className="demo-tag">Demo payment, no money is charged</span>
      <p className="small muted">{title}</p>
      <div className="pay-methods" role="group" aria-label="Payment method">
        <button className="pay-method" aria-pressed={method === "fpx"} onClick={() => setMethod("fpx")}><Landmark size={22} /> FPX</button>
        <button className="pay-method" aria-pressed={method === "duitnow"} onClick={() => setMethod("duitnow")}><QrCode size={22} /> DuitNow QR</button>
        <button className="pay-method" aria-pressed={method === "card"} onClick={() => setMethod("card")}><CreditCard size={22} /> Card</button>
      </div>
      {method === "fpx" && (
        <div className="field">
          <label htmlFor="bank">Bank</label>
          <select id="bank" className="input" value={bank} onChange={(e) => setBank(e.target.value)}>
            {BANKS.map((b) => <option key={b}>{b}</option>)}
          </select>
          <span className="hint">In the real app this hands over to your bank. Here it simply succeeds.</span>
        </div>
      )}
      {method === "duitnow" && (
        <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
          {qr ? <img className="qr" src={qr} alt="Demo DuitNow QR code" /> : <div className="qr" />}
          <span className="hint">Sample QR only. Scanning it does nothing.</span>
        </div>
      )}
      {method === "card" && (
        <div className="form-grid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="cardno">Card number</label>
            <input id="cardno" className="input tnum" defaultValue="4242 4242 4242 4242" />
          </div>
          <div className="field"><label htmlFor="exp">Expiry</label><input id="exp" className="input tnum" defaultValue="12/29" /></div>
          <div className="field"><label htmlFor="cvc">CVC</label><input id="cvc" className="input tnum" defaultValue="123" /></div>
        </div>
      )}
      <p className="small muted" style={{ display: "flex", gap: 6 }}><ShieldCheck size={16} /> Money paid before the job is held by JiranLink and released to the provider when both of you tap "Job done".</p>
      <button className="btn btn-primary btn-block" onClick={pay} disabled={busy}>
        {busy ? <><Loader2 size={16} className="spin" /> Processing</> : `Pay ${rm(amount)}`}
      </button>
    </Sheet>
  );
}

export const MODE_TEXT: Record<PaymentMode, { title: string; body: (b: Booking, pct: number) => string }> = {
  before: { title: "Pay now", body: (b) => `${rm(b.price)} now, held until the job is done.` },
  deposit: { title: "Pay a deposit", body: (b, pct) => `${rm(Math.round(b.price * pct) / 100)} now (${pct}%), the rest after the job.` },
  after: { title: "Pay after the job", body: (b) => `${rm(b.price)} once you both tap "Job done".` },
};
