import { useMemo, useState } from "react";
import { ArrowLeft, Hourglass, Send, Sparkles } from "lucide-react";
import { Avatar, Empty, RatingLine, categoryName } from "../../components/ui";
import { SlotPicker } from "../../components/SlotPicker";
import { draftMessage } from "../../ai/agent";
import { extractHints } from "../../ai/hints";
import { zonesFor } from "../../lib/geo";
import { firstName, useMe, shortName } from "../../lib/hooks";
import { back, navigate } from "../../lib/router";
import { ratingStats } from "../../lib/rating";
import { run } from "../../lib/store";
import { requestBooking } from "../../lib/domain";
import { fmtSlot, rm } from "../../lib/time";
import { MessageSquareWarning } from "lucide-react";

export function Book({ serviceId, q }: { serviceId: string; q?: string }) {
  const { s, me } = useMe();
  const svc = s.services.find((x) => x.id === serviceId);
  const p = svc ? s.providers.find((x) => x.id === svc.providerId) : undefined;
  const hints = useMemo(() => extractHints(q ?? ""), [q]);
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [edited, setEdited] = useState(false);
  const zones = zonesFor(me.home);
  const homeLabel = zones.building?.name ?? zones.precinct?.name ?? me.homeLabel;
  const draft = (sl: { start: string; end: string } | null) =>
    svc && p ? draftMessage({ text: q ?? "", categoryId: svc.categoryId, providerName: p.displayName, residentFirstName: firstName(me.name), homeLabel, slotLabel: sl ? fmtSlot(sl.start, sl.end) : undefined, hints }) : "";
  const [msg, setMsg] = useState(() => draft(null));

  if (!svc || !p) return <Empty icon={<MessageSquareWarning size={24} />} title="Service not found" />;
  const stats = ratingStats(p, s.reviews, s.config);

  const pick = (start: string, end: string) => {
    setSlot({ start, end });
    if (!edited) setMsg(draft({ start, end }));
  };
  const send = () => {
    if (!slot) return;
    const b = run((st) => requestBooking(st, me.id, svc.id, slot.start, msg), "Request sent. The slot is held for you.");
    if (b) navigate({ name: "booking", id: b.id }, { replace: true });
  };

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <button className="link-btn" onClick={() => back()} style={{ justifySelf: "start" }}><ArrowLeft size={16} /> Back</button>
      <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar name={p.displayName} hue={p.hue} />
        <div style={{ minWidth: 0, flex: "1 1 200px" }}>
          <div className="strong" style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{svc.title}</div>
          <div className="small muted">{p.displayName} · {categoryName(svc.categoryId)} · <RatingLine stats={stats} /></div>
        </div>
        <span className="price">{rm(svc.priceMin)}{svc.priceMax > svc.priceMin ? ` to ${rm(svc.priceMax)}` : ""} <span className="small muted">{svc.priceUnit}</span></span>
      </div>

      <section className="card stack-sm" aria-labelledby="h-when">
        <h2 className="section-title" style={{ fontSize: 18 }} id="h-when">1. Pick a time</h2>
        <p className="small muted">
          {shortName(p.displayName)} works in {p.availability.slotMins}-minute slots. Book at least {p.availability.minNoticeHrs} hours ahead.
        </p>
        <SlotPicker tpl={p.availability} bookings={s.bookings.filter((b) => b.providerId === p.id)} value={slot?.start ?? null} onChange={pick} hints={hints} />
      </section>

      <section className="card stack-sm" aria-labelledby="h-msg">
        <h2 className="section-title" style={{ fontSize: 18 }} id="h-msg">2. Tell them what you need</h2>
        {q && !edited && <p className="explain"><Sparkles size={14} style={{ flex: "none", marginTop: 2 }} /> Drafted from your search. Edit anything before sending.</p>}
        <label htmlFor="msg" className="sr-only">Message to the provider</label>
        <textarea id="msg" className="input" value={msg} onChange={(e) => { setMsg(e.target.value); setEdited(true); }} rows={4} />
        <p className="hint">Keep it short. The provider will ask for details in chat and confirm a price.</p>
      </section>

      <div className="notice n-info"><Hourglass size={18} /><div className="grow">Sending holds this slot for {s.config.holdHours} hours. You only confirm and pay after {shortName(p.displayName)} accepts and agrees a price.</div></div>
      <button className="btn btn-primary" onClick={send} disabled={!slot} style={{ justifySelf: "start" }}>
        <Send size={16} /> {slot ? `Send request for ${fmtSlot(slot.start, slot.end)}` : "Pick a time to continue"}
      </button>
    </div>
  );
}
