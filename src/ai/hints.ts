// Extracts time preferences and intent hints from a request, in English, Malay and Chinese.

import { DAY_NAMES_LONG } from "../lib/time";

export interface Hints {
  timeText: string; // human-readable, e.g. "Saturday morning"
  day?: number; // 0 = Sunday
  relativeDay?: number; // 0 today, 1 tomorrow
  partOfDay?: "morning" | "afternoon" | "evening";
  weekend?: boolean;
  urgent: boolean;
  online: boolean;
  quantity?: string;
}

const DAYS: [RegExp, number][] = [
  [/\b(sunday|sun|ahad)\b|星期日|星期天|周日|礼拜天/, 0],
  [/\b(monday|mon|isnin)\b|星期一|周一|礼拜一/, 1],
  [/\b(tuesday|tue|tues|selasa)\b|星期二|周二|礼拜二/, 2],
  [/\b(wednesday|wed|rabu)\b|星期三|周三|礼拜三/, 3],
  [/\b(thursday|thu|thurs|khamis)\b|星期四|周四|礼拜四/, 4],
  [/\b(friday|fri|jumaat)\b|星期五|周五|礼拜五/, 5],
  [/\b(saturday|sat|sabtu)\b|星期六|周六|礼拜六/, 6],
];

export function extractHints(text: string): Hints {
  const t = text.toLowerCase();
  const h: Hints = { timeText: "", urgent: false, online: false };

  if (/\b(today|hari ini|harini|tonight|malam ini)\b|今天|今晚/.test(t)) h.relativeDay = 0;
  else if (/\b(tomorrow|esok|besok|tmr|tmrw)\b|明天/.test(t)) h.relativeDay = 1;
  for (const [re, d] of DAYS) if (re.test(t)) h.day = d;
  if (/\b(weekend|hujung minggu)\b|周末/.test(t)) h.weekend = true;

  if (/\b(morning|pagi)\b|早上|上午/.test(t)) h.partOfDay = "morning";
  else if (/\b(afternoon|tengah hari|tengahari|petang|lunch)\b|下午|中午/.test(t)) h.partOfDay = "afternoon";
  else if (/\b(evening|night|malam)\b|晚上|傍晚/.test(t)) h.partOfDay = "evening";

  h.urgent = /\b(urgent|asap|emergency|segera|cepat|kecemasan|now)\b|急|马上/.test(t);
  h.online = /\b(online|dalam talian|zoom|google meet|video call|virtual)\b|网上|线上/.test(t);

  const qty = t.match(/\b(\d+)\s*(units?|unit|biji|pieces|pcs|ketul|orang|people|kg|kilo|rooms?|bilik|hours?|jam)\b/);
  if (qty) h.quantity = `${qty[1]} ${qty[2]}`;

  const parts: string[] = [];
  if (h.relativeDay === 0) parts.push("today");
  else if (h.relativeDay === 1) parts.push("tomorrow");
  if (h.day !== undefined) parts.push(DAY_NAMES_LONG[h.day]);
  if (h.weekend) parts.push("weekend");
  if (h.partOfDay) parts.push(h.partOfDay);
  if (h.urgent) parts.push("urgent");
  h.timeText = parts.join(" ");
  if (h.timeText) h.timeText = h.timeText[0].toUpperCase() + h.timeText.slice(1);
  return h;
}

/** Does a slot match the time preference? Used to highlight matching slots. */
export function slotMatches(h: Hints, startIso: string): boolean {
  const d = new Date(startIso);
  const hour = d.getHours();
  const today = new Date();
  if (h.relativeDay !== undefined) {
    const target = new Date(today);
    target.setDate(today.getDate() + h.relativeDay);
    if (d.toDateString() !== target.toDateString()) return false;
  }
  if (h.day !== undefined && d.getDay() !== h.day) return false;
  if (h.weekend && d.getDay() !== 0 && d.getDay() !== 6) return false;
  if (h.partOfDay === "morning" && hour >= 12) return false;
  if (h.partOfDay === "afternoon" && (hour < 12 || hour >= 18)) return false;
  if (h.partOfDay === "evening" && hour < 17) return false;
  return h.relativeDay !== undefined || h.day !== undefined || !!h.weekend || !!h.partOfDay;
}
