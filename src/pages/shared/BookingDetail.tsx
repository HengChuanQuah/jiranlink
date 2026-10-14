import { useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Clock, QrCode, Send, ShieldCheck, Wallet, XCircle } from "lucide-react";
import { Avatar, Empty, Sheet, StarInput, Stars, StatusPill } from "../../components/ui";
import { SlotPicker } from "../../components/SlotPicker";
import { Checkout, MODE_TEXT } from "../../components/Payment";
import { GatePassSheet } from "../../components/GatePass";
import { ChatThread } from "./Messages";
import { nameOf, useMe, shortName } from "../../lib/hooks";
import { back } from "../../lib/router";
import { attempt } from "../../lib/store";
import * as d from "../../lib/domain";
import { fmtSlot, hoursUntil, rm, timeAgo } from "../../lib/time";
import type { Booking, PaymentMode } from "../../data/types";
import { MessageSquareWarning } from "lucide-react";

const STEP_NAMES = ["Requested", "Accepted", "Confirmed", "Done", "Reviewed"];
function stepIndex(b: Booking) {
  return { requested: 0, accepted: 1, confirmed: 2, completed: 3, reviewed: 4, declined: 0, cancelled: 0, expired: 0 }[b.status];
}

const PAY_TEXT: Record<Booking["payment"], string> = {
  unpaid: "Not paid yet", held: "Paid, held by JiranLink", deposit_held: "Deposit paid, held", due: "Payment due", paid: "Paid", released: "Paid and released to provider", refunded: "Refunded",
};

export function BookingDetail({ id }: { id: string }) {
  const { s, me } = useMe();
  const b = s.bookings.find((x) => x.id === id);
  const [checkout, setCheckout] = useState<null | { amount: number; title: string; then: (method: string) => void }>(null);
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [propose, setPropose] = useState(false);
  const [proposed, setProposed] = useState<string | null>(null);
  const [decline, setDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [stars, setStars] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [pass, setPass] = useState(false);

  if (!b) return <Empty icon={<MessageSquareWarning size={24} />} title="Booking not found" />;
  const isProvider = me.id === b.providerId;
  const isResident = me.id === b.residentId;
  const svc = s.services.find((x) => x.id === b.serviceId)!;
  const prov = s.providers.find((x) => x.id === b.providerId)!;
  const peerId = isProvider ? b.residentId : b.providerId;
  const gate = s.gatePasses.find((g) => g.id === b.gatePassId);
  const modes = d.paymentModesFor(s, b);
  const chosen = mode ?? modes[0];
  const step = stepIndex(b);
  const ended = ["declined", "cancelled", "expired"].includes(b.status);
  const started = new Date(b.start) <= new Date();
  const rel = d.residentReliability(s, b.residentId);
  const review = s.reviews.find((r) => r.bookingId === b.id);

  const confirm = () => {
    const amount = d.amountNow(s, b, chosen);
    if (chosen === "after") {
      attempt((st) => d.confirmBooking(st, b.id, me.id, "after", ""), "Confirmed. You'll pay after the job.");
      return;
    }
    setCheckout({ amount, title: `${svc.title} with ${prov.displayName}`, then: (method) => attempt((st) => d.confirmBooking(st, b.id, me.id, chosen, method), "Paid and confirmed. The money is held until the job is done.") });
  };

  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <button className="link-btn" onClick={() => back({ name: "bookings" })} style={{ justifySelf: "start" }}><ArrowLeft size={16} /> Back</button>

      <section className="card stack-sm">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={nameOf(s, peerId)} hue={isProvider ? 205 : prov.hue} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="strong" style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{svc.title}</div>
            <div className="small muted">{isProvider ? "Customer" : "Provider"}: {nameOf(s, peerId)}</div>
            <div className="small strong tnum" style={{ marginTop: 2 }}>{fmtSlot(b.start, b.end)}</div>
          </div>
          <StatusPill status={b.status} forProvider={isProvider} />
        </div>
        {!ended && (
          <div className="steps" aria-label={`Progress: ${STEP_NAMES[step]}`}>
            {STEP_NAMES.map((n, i) => (
              <div key={n} className={`step${i <= step ? " done" : ""}${i === step ? " now" : ""}`}><div className="bar" />{n}</div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Action panel ---------- */}
      <section className="card stack-sm" aria-label="What happens next">
        {b.status === "requested" && b.proposedStart && isResident && (
          <>
            <div className="notice n-info"><Clock size={18} /><div className="grow"><b>{nameOf(s, b.providerId)} proposed another time:</b> {fmtSlot(b.proposedStart, new Date(new Date(b.proposedStart).getTime() + prov.availability.slotMins * 60000).toISOString())}</div></div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={() => attempt((st) => d.acceptProposal(st, b.id, me.id), "New time accepted")}>Use this time</button>
              <button className="btn btn-outline" onClick={() => attempt((st) => d.cancelBooking(st, b.id, me.id), "Request cancelled")}>Cancel request</button>
            </div>
          </>
        )}
        {b.status === "requested" && !b.proposedStart && isResident && (
          <>
            <p><b>Waiting for {shortName(nameOf(s, b.providerId))}.</b> They usually reply in about {prov.responseMins < 60 ? `${prov.responseMins} minutes` : `${Math.round(prov.responseMins / 60)} hours`}.</p>
            <p className="small muted tnum">Slot held for another {Math.max(0, Math.floor(hoursUntil(b.holdExpiresAt)))} h. If there's no reply, it's released automatically.</p>
            <button className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={() => attempt((st) => d.cancelBooking(st, b.id, me.id), "Request cancelled")}>Cancel request</button>
          </>
        )}
        {b.status === "requested" && isProvider && !b.proposedStart && (
          <>
            <h2 className="section-title" style={{ fontSize: 17 }}>New request</h2>
            <p className="small muted">Agree the scope in chat, then accept with the details and price. The customer confirms and chooses how to pay.</p>
            <div className="field">
              <label htmlFor="det">What you'll do</label>
              <textarea id="det" className="input" rows={2} value={details ?? svc.title} onChange={(e) => setDetails(e.target.value)} />
            </div>
            <div className="field" style={{ maxWidth: 220 }}>
              <label htmlFor="price">Agreed price (RM)</label>
              <input id="price" className="input tnum" inputMode="decimal" value={price ?? String(svc.priceMin)} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <p className="small muted">Customer record: {rel.completed} completed {rel.completed === 1 ? "job" : "jobs"}{rel.unpaid ? `, ${rel.unpaid} unpaid` : ", no unpaid jobs"}{rel.cancelled ? `, ${rel.cancelled} cancelled` : ""}.</p>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={() => attempt((st) => d.acceptBooking(st, b.id, me.id, details ?? svc.title, Number(price ?? svc.priceMin)), "Accepted. Waiting for the customer to confirm.")}><CheckCircle2 size={16} /> Accept</button>
              <button className="btn btn-outline" onClick={() => setPropose(true)}><Clock size={16} /> Propose another time</button>
              <button className="btn btn-quiet" onClick={() => setDecline(true)}><XCircle size={16} /> Decline</button>
            </div>
          </>
        )}
        {b.status === "requested" && isProvider && b.proposedStart && <p>You proposed {fmtSlot(b.proposedStart, b.end)}. Waiting for the customer.</p>}
        {b.status === "accepted" && isProvider && <p><b>Accepted at {rm(b.price)}.</b> Waiting for the customer to confirm and choose how to pay.</p>}
        {b.status === "accepted" && isResident && (
          <>
            <h2 className="section-title" style={{ fontSize: 17 }}>Confirm and choose how to pay</h2>
            <div className="notice n-ok"><CheckCircle2 size={18} /><div className="grow"><b>{shortName(nameOf(s, b.providerId))} accepted:</b> {b.agreedDetails}. <b className="tnum">{rm(b.price)}</b></div></div>
            <div className="stack-sm" role="radiogroup" aria-label="When to pay">
              {modes.map((m) => (
                <button key={m} className="option-card" role="radio" aria-checked={chosen === m} aria-pressed={chosen === m} onClick={() => setMode(m)}>
                  <span className="radio" />
                  <span><span className="strong">{MODE_TEXT[m].title}</span><br /><span className="small muted">{MODE_TEXT[m].body(b, prov.payment.depositPct)}</span></span>
                </button>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={confirm}>
                {chosen === "after" ? "Confirm booking" : `Confirm and pay ${rm(d.amountNow(s, b, chosen))}`}
              </button>
              <button className="btn btn-outline" onClick={() => attempt((st) => d.cancelBooking(st, b.id, me.id), "Booking cancelled")}>Cancel</button>
            </div>
          </>
        )}
        {b.status === "confirmed" && (
          <>
            <p>
              <b>Confirmed.</b> {isResident ? `${shortName(nameOf(s, b.providerId))} will come at the agreed time.` : "See you there."} After the job, both of you tap "Job done".
              {b.paymentMode === "after" && " Payment happens after that."}
            </p>
            <div className="small muted">
              {b.doneByProvider ? "Provider marked done. " : ""}{b.doneByResident ? "Customer marked done." : ""}
            </div>
            <div className="btn-row">
              {gate && <button className="btn btn-outline" onClick={() => setPass(true)}><QrCode size={16} /> {isProvider ? "My visitor pass" : "Visitor pass sent"}</button>}
              {((isProvider && !b.doneByProvider) || (isResident && !b.doneByResident)) && (
                <button className="btn btn-primary" onClick={() => attempt((st) => d.markDone(st, b.id, me.id), "Marked as done")}><CheckCircle2 size={16} /> Job done</button>
              )}
              {!started && <button className="btn btn-quiet" onClick={() => attempt((st) => d.cancelBooking(st, b.id, me.id), "Booking cancelled")}><Ban size={16} /> Cancel</button>}
            </div>
            {!started && <p className="hint">You can tap "Job done" early in this demo. In a real pilot it unlocks at the start time.</p>}
          </>
        )}
        {b.status === "completed" && isResident && b.payment === "due" && (
          <>
            <div className="notice n-bad"><Wallet size={18} /><div className="grow"><b>{rm(b.price - b.amountPaid)} due.</b> New bookings are paused until this is paid.</div></div>
            <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={() => setCheckout({ amount: b.price - b.amountPaid, title: `Balance for ${svc.title}`, then: (method) => attempt((st) => d.payBalance(st, b.id, me.id, method), "Paid. Thank you!") })}>
              Pay {rm(b.price - b.amountPaid)}
            </button>
          </>
        )}
        {b.status === "completed" && isResident && b.payment !== "due" && (
          <>
            <h2 className="section-title" style={{ fontSize: 17 }}>How did it go?</h2>
            <StarInput value={stars} onChange={setStars} />
            <div className="field">
              <label htmlFor="rt">Your review (optional)</label>
              <textarea id="rt" className="input" rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="What should neighbours know?" />
            </div>
            <p className="hint">Shown with a "Booked via JiranLink" label, because it comes from a completed job.</p>
            <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={!stars} onClick={() => attempt((st) => d.addReview(st, b.id, me.id, stars, reviewText), "Thanks! Your review is live.")}><Send size={16} /> Post review</button>
          </>
        )}
        {b.status === "completed" && isProvider && <p><b>Completed.</b> {b.payment === "due" ? `Waiting for the customer to pay ${rm(b.price - b.amountPaid)}.` : "Payment received."}</p>}
        {b.status === "reviewed" && review && (
          <div className="stack-sm">
            <p className="strong">Reviewed</p>
            <Stars value={review.stars} />
            {review.text && <p>{review.text}</p>}
          </div>
        )}
        {ended && <p className="muted">This booking was {b.status}. {b.payment === "refunded" ? "Any payment was refunded (demo)." : ""}</p>}
      </section>

      <section className="card stack-sm" aria-label="Details">
        <dl className="kv">
          <dt>Request</dt><dd>{b.message}</dd>
          {b.agreedDetails && <><dt>Agreed</dt><dd>{b.agreedDetails}</dd></>}
          {b.price > 0 && <><dt>Price</dt><dd className="tnum">{rm(b.price)}</dd></>}
          {b.paymentMode && <><dt>Payment</dt><dd>{MODE_TEXT[b.paymentMode].title} · {PAY_TEXT[b.payment]}{b.amountPaid ? ` (${rm(b.amountPaid)} paid)` : ""}</dd></>}
          {b.paymentMethod && <><dt>Method</dt><dd>{b.paymentMethod}</dd></>}
        </dl>
        <p className="hint" style={{ display: "flex", gap: 6 }}><ShieldCheck size={14} /> Payments in this prototype are simulated.</p>
      </section>

      <section className="card stack-sm" aria-label="Messages">
        <h2 className="section-title" style={{ fontSize: 17 }}>Chat</h2>
        <ChatThread threadId={`b:${b.id}`} />
      </section>

      <details className="card-flat">
        <summary className="strong" style={{ cursor: "pointer" }}>Activity</summary>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "grid", gap: 4 }} className="small">
          {b.events.map((e, i) => <li key={i}>{e.text} <span className="muted">· {e.by === "system" ? "JiranLink" : nameOf(s, e.by)} · {timeAgo(e.at)}</span></li>)}
        </ul>
      </details>

      {propose && (
        <Sheet title="Propose another time" onClose={() => setPropose(false)}>
          <SlotPicker tpl={prov.availability} bookings={s.bookings.filter((x) => x.providerId === prov.id)} value={proposed} onChange={(st) => setProposed(st)} excludeBookingId={b.id} />
          <button className="btn btn-primary" disabled={!proposed} onClick={() => { if (attempt((st) => d.proposeTime(st, b.id, me.id, proposed!), "New time sent to the customer")) setPropose(false); }}>Send proposal</button>
        </Sheet>
      )}
      {decline && (
        <Sheet title="Decline this request" onClose={() => setDecline(false)}>
          <div className="field">
            <label htmlFor="dr">Reason (optional, shown to the customer)</label>
            <input id="dr" className="input" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="For example: fully booked that week" />
          </div>
          <button className="btn btn-danger" onClick={() => { if (attempt((st) => d.declineBooking(st, b.id, me.id, declineReason), "Request declined")) setDecline(false); }}>Decline</button>
        </Sheet>
      )}
      {checkout && <Checkout amount={checkout.amount} title={checkout.title} onClose={() => setCheckout(null)} onPaid={(m) => { checkout.then(m); setCheckout(null); }} />}
      {pass && gate && <GatePassSheet pass={gate} onClose={() => setPass(false)} />}
    </div>
  );
}
