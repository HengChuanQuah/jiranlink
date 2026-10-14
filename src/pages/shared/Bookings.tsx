import { useState } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Avatar, Empty, StatusPill } from "../../components/ui";
import { nameOf, useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { fmtSlot, rm } from "../../lib/time";
import type { Booking } from "../../data/types";

export function needsAction(b: Booking, userId: string) {
  if (b.providerId === userId) return b.status === "requested" && !b.proposedStart || (b.status === "confirmed" && !b.doneByProvider && new Date(b.start) < new Date());
  return b.status === "accepted" || (b.status === "requested" && !!b.proposedStart) || b.payment === "due" || b.status === "completed" || (b.status === "confirmed" && !b.doneByResident && new Date(b.start) < new Date());
}

export function Bookings({ tab: initial }: { tab?: string }) {
  const { s, me } = useMe();
  const asProvider = s.mode === "provider";
  const mine = s.bookings.filter((b) => (asProvider ? b.providerId === me.id : b.residentId === me.id));
  const [tab, setTab] = useState(initial ?? "action");
  const now = new Date();
  const groups: Record<string, Booking[]> = {
    action: mine.filter((b) => needsAction(b, me.id)),
    upcoming: mine.filter((b) => ["requested", "accepted", "confirmed"].includes(b.status) && new Date(b.end) >= now),
    past: mine.filter((b) => ["completed", "reviewed", "declined", "cancelled", "expired"].includes(b.status) || (b.status === "confirmed" && new Date(b.end) < now)),
  };
  const list = [...(groups[tab] ?? [])].sort((a, b) => (tab === "past" ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
  return (
    <div className="stack">
      <h1 className="page-title">{asProvider ? "Jobs" : "My bookings"}</h1>
      <div className="seg" role="group" aria-label="Filter">
        <button aria-pressed={tab === "action"} onClick={() => setTab("action")}>Needs you ({groups.action.length})</button>
        <button aria-pressed={tab === "upcoming"} onClick={() => setTab("upcoming")}>Upcoming ({groups.upcoming.length})</button>
        <button aria-pressed={tab === "past"} onClick={() => setTab("past")}>Past</button>
      </div>
      <div className="stack-sm">
        {list.length === 0 && <div className="card-flat"><Empty icon={<CalendarDays size={24} />} title="Nothing here yet" /></div>}
        {list.slice(0, 40).map((b) => {
          const peer = asProvider ? b.residentId : b.providerId;
          const prov = s.providers.find((p) => p.id === peer);
          const svc = s.services.find((x) => x.id === b.serviceId);
          return (
            <button key={b.id} className="list-row" onClick={() => navigate({ name: "booking", id: b.id })}>
              <Avatar name={nameOf(s, peer)} hue={prov?.hue ?? 200} />
              <div className="grow">
                <div className="strong ellipsis">{svc?.title}</div>
                <div className="small muted ellipsis">{nameOf(s, peer)} · {fmtSlot(b.start, b.end)}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <StatusPill status={b.status} forProvider={asProvider} />
                  {b.payment === "due" && <span className="status st-requested">Payment due</span>}
                  {b.proposedStart && b.status === "requested" && <span className="status st-accepted">New time proposed</span>}
                </div>
              </div>
              {b.price > 0 && <span className="price small">{rm(b.price)}</span>}
              <ChevronRight size={18} className="muted" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
