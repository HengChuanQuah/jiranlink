import { BadgeCheck, MapPin, Star } from "lucide-react";
import type { SearchResult } from "../lib/search";
import { distanceLabel } from "../lib/geo";
import { rm } from "../lib/time";
import { Avatar, OnlineBadge, RatingLine, TrustBadges } from "./ui";

export function ProviderCard({ r, onOpen, exception, selected, onHover, index }: {
  r: SearchResult; onOpen: () => void; exception?: boolean; selected?: boolean; onHover?: (on: boolean) => void; index?: number;
}) {
  const s = r.service;
  return (
    <button className={`pcard${selected ? " sel" : ""}`} onClick={onOpen} aria-label={`${r.provider.displayName}, ${s.title}`} data-pcard={r.provider.id}
      onMouseEnter={onHover && (() => onHover(true))} onMouseLeave={onHover && (() => onHover(false))} onFocus={onHover && (() => onHover(true))} onBlur={onHover && (() => onHover(false))}
      style={index !== undefined ? ({ "--i": index } as React.CSSProperties) : undefined}>
      {/* Quality badge: how good. Kept apart from the distance badge below, which says how far. */}
      {exception && <span className="badge b-top slot-flag"><Star size={12} fill="currentColor" /> Top rated</span>}
      <div className="pcard-top">
        <Avatar name={r.provider.displayName} hue={r.provider.hue} />
        <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
          <div className="pcard-name">{r.provider.displayName} <BadgeCheck size={15} className="name-tick" aria-label="Verified resident" /></div>
          <div className="pcard-svc">{s.title}</div>
        </div>
      </div>
      <div className="pcard-meta">
        {r.ring >= 0 ? (
          <span className="badge b-dist"><MapPin size={12} /> {r.ringLabel}</span>
        ) : (
          <OnlineBadge />
        )}
        <RatingLine stats={r.stats} />
        {r.ring >= 0 && <span className="tnum">{distanceLabel(r.distanceM)}</span>}
      </div>
      {exception && <p className="tiny muted" style={{ margin: 0 }}>Highest rating near you, just outside your usual search area.</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <TrustBadges provider={r.provider} stats={r.stats} compact />
        <span className="price">
          {rm(s.priceMin)}
          {s.priceMax > s.priceMin ? ` to ${rm(s.priceMax)}` : ""} <span className="muted small" style={{ fontWeight: 600 }}>{s.priceUnit}</span>
        </span>
      </div>
    </button>
  );
}
