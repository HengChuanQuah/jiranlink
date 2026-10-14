import type { AvailabilityTemplate, Booking } from "../data/types";
import { addDays, addMinutes, atTime, now, startOfDay, ymd } from "./time";

export interface Slot {
  start: string;
  end: string;
  remaining: number; // free places in this slot
}

export interface SlotDay {
  date: string; // YYYY-MM-DD
  label: Date;
  slots: Slot[];
}

/** Bookings that occupy a slot: active requests still on hold, accepted and confirmed bookings. */
export function occupies(b: Booking, at = now()): boolean {
  if (b.status === "requested") return new Date(b.holdExpiresAt) > at;
  return b.status === "accepted" || b.status === "confirmed";
}

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

/**
 * Generates bookable slots from a provider's weekly template.
 * Slots are computed on demand, so changing the template updates the calendar immediately.
 */
export function generateSlots(
  tpl: AvailabilityTemplate,
  bookings: Booking[],
  opts: { from?: Date; excludeBookingId?: string } = {},
): SlotDay[] {
  const from = opts.from ?? now();
  const earliest = addMinutes(from, tpl.minNoticeHrs * 60);
  const active = bookings.filter((b) => b.id !== opts.excludeBookingId && occupies(b, from));
  const days: SlotDay[] = [];
  const step = Math.max(5, tpl.slotMins + tpl.bufferMins);

  for (let i = 0; i < tpl.horizonDays; i++) {
    const day = addDays(startOfDay(from), i);
    const key = ymd(day);
    if (!tpl.days.includes(day.getDay()) || tpl.daysOff.includes(key)) continue;
    const slots: Slot[] = [];
    for (const block of tpl.blocks) {
      const blockEnd = atTime(day, block.end);
      for (let t = atTime(day, block.start); addMinutes(t, tpl.slotMins) <= blockEnd; t = addMinutes(t, step)) {
        const end = addMinutes(t, tpl.slotMins);
        if (t < earliest) continue;
        const used = active.filter((b) => overlaps(t, end, new Date(b.start), new Date(b.end))).length;
        slots.push({ start: t.toISOString(), end: end.toISOString(), remaining: Math.max(0, tpl.capacity - used) });
      }
    }
    slots.sort((a, b) => a.start.localeCompare(b.start));
    if (slots.length) days.push({ date: key, label: day, slots });
  }
  return days;
}

export function slotRemaining(tpl: AvailabilityTemplate, bookings: Booking[], startIso: string, excludeBookingId?: string): number | null {
  for (const d of generateSlots(tpl, bookings, { excludeBookingId })) {
    const s = d.slots.find((x) => x.start === startIso);
    if (s) return s.remaining;
  }
  return null; // not a valid slot in the template
}

/** Validates a template and returns a list of problems in plain words. */
export function templateProblems(tpl: AvailabilityTemplate): string[] {
  const out: string[] = [];
  if (!tpl.days.length) out.push("Pick at least one working day.");
  if (!tpl.blocks.length) out.push("Add at least one time block.");
  for (const b of tpl.blocks) {
    if (b.end <= b.start) out.push(`Block ${b.start} to ${b.end} ends before it starts.`);
    else {
      const mins = (Number(b.end.slice(0, 2)) * 60 + Number(b.end.slice(3))) - (Number(b.start.slice(0, 2)) * 60 + Number(b.start.slice(3)));
      if (mins < tpl.slotMins) out.push(`Block ${b.start} to ${b.end} is shorter than one ${tpl.slotMins}-minute slot.`);
    }
  }
  if (tpl.slotMins < 15) out.push("Slots must be at least 15 minutes.");
  if (tpl.capacity < 1) out.push("Each slot needs room for at least one booking.");
  return out;
}
