import { CalendarClock, CalendarDays, ChevronRight, ClipboardList, Eye, EyeOff, Sparkles, Star, Store } from "lucide-react";
import { Avatar, Empty, RatingLine, StatusPill, categoryName } from "../../components/ui";
import { statsFor } from "../../lib/rating";
import { nameOf, useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { attempt } from "../../lib/store";
import { updateProvider } from "../../lib/domain";
import { distanceM } from "../../lib/geo";
import { addDays, fmtSlot, now, rm, startOfDay } from "../../lib/time";
import { needsAction } from "../shared/Bookings";
import type { Booking } from "../../data/types";

export function Dashboard() {
  const { s, me, myProvider } = useMe();
  if (!myProvider) {
    return (
      <div className="card-flat">
        <Empty icon={<Store size={24} />} title="You don't offer any services yet">
          <button className="btn btn-primary" onClick={() => navigate({ name: "profile" })}>Start offering a service</button>
        </Empty>
      </div>
    );
  }
  const p = myProvider;
  const stats = statsFor(s, p.id)!;
  const mine = s.bookings.filter((b) => b.providerId === p.id);
  const action = mine.filter((b) => needsAction(b, me.id)).sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = mine.filter((b) => b.status === "confirmed" && new Date(b.end) > now()).sort((a, b) => a.start.localeCompare(b.start));
  const weekEnd = addDays(startOfDay(now()), 7);
  const thisWeek = upcoming.filter((b) => new Date(b.start) < weekEnd).length;
  const held = mine.filter((b) => b.payment === "held" || b.payment === "deposit_held").reduce((t, b) => t + b.amountPaid, 0);
  const earned = mine.filter((b) => b.payment === "released" || b.payment === "paid").reduce((t, b) => t + b.price, 0);
  const due = mine.filter((b) => b.payment === "due").reduce((t, b) => t + (b.price - b.amountPaid), 0);
  const services = s.services.filter((x) => x.providerId === p.id);
  const myCats = new Set(services.map((x) => x.categoryId));
  const openRequests = s.requests.filter((r) => {
    if (r.status !== "open" || r.residentId === me.id || r.responses.some((x) => x.providerId === me.id)) return false;
    const author = s.users.find((u) => u.id === r.residentId);
    return !!author && distanceM(author.home, p.exact) <= 10_000 && (!r.categoryId || myCats.has(r.categoryId));
  });

  return (
    <div className="stack">
      <section className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar name={p.displayName} hue={p.hue} large />
        <div className="stack-sm" style={{ flex: 1, minWidth: 200, gap: 4 }}>
          <span className="hero-eyebrow" style={{ color: "var(--red)" }}>Provider dashboard</span>
          <h1 className="page-title">{p.displayName}</h1>
          <RatingLine stats={stats} />
        </div>
        <div className="btn-row">
          <button className="btn btn-outline btn-sm" onClick={() => navigate({ name: "provider", id: p.id })}><Eye size={14} /> See what residents see</button>
          <button className={`btn btn-sm ${p.active ? "btn-quiet" : "btn-primary"}`} onClick={() => attempt((st) => updateProvider(st, p.id, { active: !p.active }), p.active ? "Paused. You won't appear in search." : "You're live again.")}>
            {p.active ? <><EyeOff size={14} /> Pause listing</> : <><Eye size={14} /> Go live</>}
          </button>
        </div>
      </section>

      {!p.active && <div className="notice n-warn"><EyeOff size={18} /><div className="grow"><b>Your listing is paused.</b> Residents can't find or book you until you go live again.</div></div>}
      {p.hidden && <div className="notice n-bad"><EyeOff size={18} /><div className="grow"><b>The township team has hidden your listing</b> after a report. Contact them to resolve it.</div></div>}
      {stats.isNew && (
        <div className="notice n-info"><Sparkles size={18} /><div className="grow"><b>You're new here.</b> For your first {s.config.newMaxReviews} reviews or {s.config.newMaxDays} days, you get a newcomer spot near the top of search. {p.introOffer ? `Your intro offer "${p.introOffer}" is showing.` : "Add an intro offer in your profile to stand out."}</div></div>
      )}
      {services.length === 0 && (
        <button className="notice n-warn" style={{ border: 0, textAlign: "left", cursor: "pointer" }} onClick={() => navigate({ name: "p-services" })}><Store size={18} /><div className="grow"><b>Add your first service</b> so neighbours can find you.</div><ChevronRight size={18} /></button>
      )}

      <div className="stat-row">
        <div className="stat"><div className="v">{action.length}</div><div className="k">Need your reply</div></div>
        <div className="stat"><div className="v">{thisWeek}</div><div className="k">Jobs in the next 7 days</div></div>
        <div className="stat"><div className="v">{rm(held)}</div><div className="k">Held until jobs are done</div></div>
        <div className="stat"><div className="v">{rm(earned)}</div><div className="k">Paid out to you</div></div>
        {due > 0 && <div className="stat"><div className="v">{rm(due)}</div><div className="k">Customers still owe</div></div>}
      </div>

      <div className="two-col">
        <section className="stack-sm">
          <h2 className="section-title" style={{ fontSize: 18 }}>Needs you</h2>
          {action.length === 0 && <div className="card-flat"><Empty icon={<CalendarClock size={24} />} title="You're all caught up" /></div>}
          {action.map((b) => <JobRow key={b.id} b={b} />)}

          <h2 className="section-title" style={{ fontSize: 18, marginTop: 10 }}>Coming up</h2>
          {upcoming.length === 0 && <div className="card-flat"><Empty icon={<CalendarDays size={24} />} title="No confirmed jobs yet" /></div>}
          {upcoming.slice(0, 6).map((b) => <JobRow key={b.id} b={b} />)}
        </section>

        <aside className="stack-sm">
          <h2 className="section-title" style={{ fontSize: 18 }}>Grow</h2>
          <button className="list-row" onClick={() => navigate({ name: "requests" })}>
            <span className="cat-icon"><ClipboardList size={20} /></span>
            <div className="grow"><div className="strong">{openRequests.length} open {openRequests.length === 1 ? "request" : "requests"} you could help with</div><div className="small muted">Neighbours within 10 km asking for things you offer</div></div>
            <ChevronRight size={18} />
          </button>
          <button className="list-row" onClick={() => navigate({ name: "p-availability" })}>
            <span className="cat-icon"><CalendarDays size={20} /></span>
            <div className="grow"><div className="strong">Your hours</div><div className="small muted">{p.availability.slotMins}-minute slots, {p.availability.days.length} days a week</div></div>
            <ChevronRight size={18} />
          </button>
          <button className="list-row" onClick={() => navigate({ name: "p-reviews" })}>
            <span className="cat-icon"><Star size={20} /></span>
            <div className="grow"><div className="strong">Reviews</div><div className="small muted">{stats.bookedCount} from bookings, {stats.pastTotal} from past customers</div></div>
            <ChevronRight size={18} />
          </button>
          <button className="list-row" onClick={() => navigate({ name: "p-services" })}>
            <span className="cat-icon"><Store size={20} /></span>
            <div className="grow"><div className="strong">{services.length} {services.length === 1 ? "service" : "services"}</div><div className="small muted ellipsis">{services.map((x) => categoryName(x.categoryId)).join(", ") || "None yet"}</div></div>
            <ChevronRight size={18} />
          </button>
        </aside>
      </div>
    </div>
  );
}

function JobRow({ b }: { b: Booking }) {
  const { s } = useMe();
  const svc = s.services.find((x) => x.id === b.serviceId);
  const customer = s.users.find((u) => u.id === b.residentId);
  return (
    <button className="list-row" onClick={() => navigate({ name: "booking", id: b.id })}>
      <Avatar name={nameOf(s, b.residentId)} hue={205} />
      <div className="grow">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
          <span className="strong ellipsis">{customer?.name ?? "Resident"}</span>
          <StatusPill status={b.status} forProvider />
        </div>
        <div className="small ellipsis">{svc?.title ?? "Service"}</div>
        <div className="small muted tnum">{fmtSlot(b.start, b.end)}{b.proposedStart ? " (new time proposed)" : ""}{b.price ? ` · ${rm(b.price)}` : ""}</div>
      </div>
    </button>
  );
}
