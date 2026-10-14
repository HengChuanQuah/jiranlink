import type { AppState } from "../data/types";
import { useApp } from "./store";

export function useMe() {
  const s = useApp();
  const me = s.users.find((u) => u.id === s.currentUserId) ?? s.users[0];
  const myProvider = s.providers.find((p) => p.id === me.id);
  return { s, me, myProvider };
}

export function firstName(name: string) {
  return name.split(" ")[0];
}

export function unreadForUser(s: AppState, userId: string) {
  // Bookings that need this user's action: a simple, honest "attention" count.
  return s.bookings.filter(
    (b) =>
      (b.providerId === userId && b.status === "requested" && !b.proposedStart) ||
      (b.residentId === userId && (b.status === "accepted" || (b.status === "requested" && !!b.proposedStart) || b.payment === "due" || (b.status === "completed"))),
  ).length;
}

export function threadsFor(s: AppState, userId: string) {
  const ids = new Set<string>();
  for (const b of s.bookings) if ((b.residentId === userId || b.providerId === userId) && s.messages.some((m) => m.threadId === `b:${b.id}`)) ids.add(`b:${b.id}`);
  for (const r of s.requests) {
    for (const resp of r.responses) {
      if (r.residentId === userId || resp.providerId === userId) ids.add(`r:${r.id}:${resp.providerId}`);
    }
  }
  return [...ids]
    .map((id) => {
      const msgs = s.messages.filter((m) => m.threadId === id);
      return { id, last: msgs[msgs.length - 1] };
    })
    .filter((t) => t.last)
    .sort((a, b) => b.last.at.localeCompare(a.last.at));
}

/** Who is on the other side of a thread, from this user's point of view. */
export function threadPeer(s: AppState, threadId: string, userId: string): { peerId: string; title: string; bookingId?: string } {
  if (threadId.startsWith("b:")) {
    const b = s.bookings.find((x) => `b:${x.id}` === threadId);
    if (!b) return { peerId: "", title: "Conversation" };
    const peerId = b.residentId === userId ? b.providerId : b.residentId;
    return { peerId, title: s.services.find((x) => x.id === b.serviceId)?.title ?? "Booking", bookingId: b.id };
  }
  const [, reqId, providerId] = threadId.split(":");
  const r = s.requests.find((x) => x.id === reqId);
  const peerId = userId === providerId ? r?.residentId ?? "" : providerId;
  return { peerId, title: `Request: ${r?.text.slice(0, 40) ?? ""}` };
}

export function nameOf(s: AppState, id: string) {
  const p = s.providers.find((x) => x.id === id);
  if (p) return p.displayName;
  const u = s.users.find((x) => x.id === id);
  return u?.name ?? "Neighbour";
}

/** Short friendly name for a provider: "Kak Ani's Kitchen" -> "Kak Ani", "Faizal Aircond Melawati" -> "Faizal". */
export function shortName(name: string) {
  return name.includes("'s ") ? name.replace(/'s .*$/, "") : name.split(" ")[0];
}
