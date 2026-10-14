import { MapPin, Sparkles, TrendingUp } from "lucide-react";
import type { SearchResult } from "../lib/search";
import { distanceLabel } from "../lib/geo";
import { rm } from "../lib/time";
import { Avatar, OnlineBadge, RatingLine, TrustBadges } from "./ui";

export function ProviderCard({ r, onOpen, exception, selected }: { r: SearchResult; onOpen: () => void; exception?: boolean; selected?: boolean }) {
  const s = r.service;
  return (
    <button className="pcard" onClick={onOpen} style={selected ? { borderColor: "var(--red)" } : undefined} aria-label={`${r.provider.displayName}, ${s.title}`}>
      {r.newcomerSlot && <span className="badge b-new slot-flag"><Sparkles size={12} /> Newcomer spotlight</span>}
      {exception && <span className="badge b-offer slot-flag"><TrendingUp size={12} /> Highly rated, a bit further</span>}
      <div className="pcard-top">
        <Avatar name={r.provider.displayName} hue={r.provider.hue} />
        <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
          <div className="pcard-name">{r.provider.displayName}</div>
          <div className="pcard-svc">{s.title}</div>
        </div>
      </div>
      <div className="pcard-meta">
        {r.ring >= 0 ? (
          <span className="badge b-ring"><MapPin size={12} /> {r.ringLabel}</span>
        ) : (
          <OnlineBadge />
        )}
        <RatingLine stats={r.stats} />
        {r.ring >= 0 && <span className="tnum">{distanceLabel(r.distanceM)}</span>}
      </div>
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
