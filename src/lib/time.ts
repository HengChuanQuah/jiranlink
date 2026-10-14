// Date helpers. All times use the device's local time zone (Asia/Kuala_Lumpur for the pilot).

let clockOffsetMs = 0;
/** Tests can shift the clock. */
export function setClockOffset(ms: number) {
  clockOffsetMs = ms;
}
export const now = () => new Date(Date.now() + clockOffsetMs);
export const nowIso = () => now().toISOString();

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export function addMinutes(d: Date, mins: number) {
  return new Date(d.getTime() + mins * 60_000);
}
export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function fmtTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return m === 0 ? `${h}${ap}` : `${h}:${String(m).padStart(2, "0")}${ap}`;
}

export function fmtDay(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const today = startOfDay(now());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`;
}

export function fmtSlot(startIso: string, endIso: string) {
  return `${fmtDay(startIso)}, ${fmtTime(startIso)} to ${fmtTime(endIso)}`;
}

export function timeAgo(iso: string) {
  const s = (now().getTime() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} d ago`;
  return `${Math.floor(d / 30)} mo ago`;
}

export function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - now().getTime()) / 3_600_000;
}

export const rm = (n: number) => `RM${n % 1 === 0 ? n : n.toFixed(2)}`;
