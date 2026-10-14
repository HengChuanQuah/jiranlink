import { useMemo, useState } from "react";
import type { AvailabilityTemplate, Booking } from "../data/types";
import { generateSlots } from "../lib/slots";
import { DAY_NAMES, fmtTime } from "../lib/time";
import { slotMatches, type Hints } from "../ai/hints";
import { Empty } from "./ui";
import { CalendarX } from "lucide-react";

export function SlotPicker({
  tpl, bookings, value, onChange, hints, excludeBookingId,
}: { tpl: AvailabilityTemplate; bookings: Booking[]; value: string | null; onChange: (start: string, end: string) => void; hints?: Hints; excludeBookingId?: string }) {
  const days = useMemo(() => generateSlots(tpl, bookings, { excludeBookingId }), [tpl, bookings, excludeBookingId]);
  const firstMatch = hints ? days.findIndex((d) => d.slots.some((s) => s.remaining > 0 && slotMatches(hints, s.start))) : -1;
  const firstFree = days.findIndex((d) => d.slots.some((s) => s.remaining > 0));
  const [dayIdx, setDayIdx] = useState(firstMatch >= 0 ? firstMatch : Math.max(0, firstFree));

  if (!days.length) {
    return (
      <Empty icon={<CalendarX size={24} />} title="No open slots in the next two weeks">
        <span className="small">Send a message instead, or post a request on the board.</span>
      </Empty>
    );
  }
  const day = days[Math.min(dayIdx, days.length - 1)];
  return (
    <div className="stack-sm">
      <div className="day-strip" role="group" aria-label="Choose a day">
        {days.map((d, i) => {
          const free = d.slots.some((s) => s.remaining > 0);
          const match = hints && d.slots.some((s) => s.remaining > 0 && slotMatches(hints, s.start));
          return (
            <button key={d.date} className="day-btn" aria-pressed={i === dayIdx} onClick={() => setDayIdx(i)} disabled={!free} style={!free ? { opacity: 0.45 } : undefined}>
              <span>{DAY_NAMES[d.label.getDay()]}</span>
              <span className="num tnum">{d.label.getDate()}</span>
              <span className="tiny">{d.label.toLocaleString("en-GB", { month: "short" })}</span>
              {match ? <span className="match" title="Matches your preferred time" /> : <span style={{ height: 8 }} />}
            </button>
          );
        })}
      </div>
      <div className="slot-grid" role="group" aria-label="Choose a time">
        {day.slots.map((s) => {
          const match = hints ? slotMatches(hints, s.start) : false;
          return (
            <button key={s.start} className={`slot-btn${match ? " match" : ""}`} aria-pressed={value === s.start} disabled={s.remaining <= 0} onClick={() => onChange(s.start, s.end)}>
              <span className="t">{fmtTime(s.start)} to {fmtTime(s.end)}</span>
              <span className="r">{s.remaining <= 0 ? "Taken" : tpl.capacity > 1 ? `${s.remaining} of ${tpl.capacity} places left` : match ? "Matches your time" : "Available"}</span>
            </button>
          );
        })}
      </div>
      {hints?.timeText && <p className="hint">Slots that match "{hints.timeText.toLowerCase()}" are outlined in orange.</p>}
    </div>
  );
}
