import { createPortal } from "react-dom";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Baby, BadgeCheck, BookOpen, Bug, Cake, Camera, Car, Code, Cookie, Dog, Droplet, Dumbbell, Globe, HeartHandshake, KeyRound, Languages,
  Leaf, Moon, Music, PawPrint, PenTool, Plug, Ruler, Scissors, Shirt, ShoppingBag, Smartphone, Snowflake, Soup, Sparkle, Sparkles, Star,
  Truck, Wrench, X, Zap, Paintbrush, Gift, Clock,
} from "lucide-react";
import type { BookingStatus, Provider } from "../data/types";
import { categoryById } from "../data/categories";
import type { RatingStats } from "../lib/rating";
import { useToasts } from "../lib/store";

const CAT_ICONS: Record<string, typeof Star> = {
  aircond: Snowflake, plumbing: Droplet, electrical: Zap, handyman: Wrench, painting: Paintbrush, appliance: Plug, pest: Bug, locksmith: KeyRound,
  cleaning: Sparkles, laundry: Shirt, gardening: Leaf, carwash: Car, cakes: Cake, kuih: Cookie, meals: Soup, tuition: BookOpen, language: Languages,
  music: Music, quran: Moon, coding: Code, fitness: Dumbbell, childcare: Baby, eldercare: HeartHandshake, petcare: PawPrint, petgrooming: Dog,
  haircut: Scissors, beauty: Sparkle, tailoring: Ruler, photo: Camera, errands: ShoppingBag, moving: Truck, devicerepair: Smartphone, design: PenTool,
};

export function CatIcon({ id, size = 22 }: { id: string; size?: number }) {
  const I = CAT_ICONS[id] ?? Star;
  return <I size={size} strokeWidth={2} aria-hidden />;
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="jl-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e1251b" />
          <stop offset="1" stopColor="#f47c20" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#jl-g)" />
      <path d="M8 22 L14 16.5 L20 22 V30 H8 Z" fill="#fff" />
      <path d="M20 22 L26 16.5 L32 22 V30 H20 Z" fill="#fff" opacity="0.82" />
      <path d="M14 13 C18 8.5 22 8.5 26 13" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <rect x="12.4" y="24.5" width="3.2" height="5.5" rx="1" fill="#e1251b" />
      <rect x="24.4" y="24.5" width="3.2" height="5.5" rx="1" fill="#ea4a1c" />
    </svg>
  );
}

export function Avatar({ name, hue, large }: { name: string; hue: number; large?: boolean }) {
  const initials = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <div className={`avatar${large ? " avatar-lg" : ""}`} style={{ background: `linear-gradient(135deg, hsl(${hue} 62% 46%), hsl(${(hue + 28) % 360} 70% 54%))` }} aria-hidden>
      {initials}
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={value >= i - 0.25 ? "currentColor" : "none"} strokeWidth={2} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" className={value >= i ? "on" : ""} role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => onChange(i)}>
          <Star size={30} fill="currentColor" />
        </button>
      ))}
    </div>
  );
}

export function RatingLine({ stats }: { stats: RatingStats }) {
  if (stats.totalCount === 0 && stats.pastTotal === 0) return <span className="muted">No reviews yet</span>;
  return (
    <span className="rating tnum">
      <Star size={14} fill="#f2a516" color="#f2a516" />
      {stats.displayAvg.toFixed(1)} <span className="muted" style={{ fontWeight: 600 }}>({stats.bookedCount + stats.pastTotal})</span>
    </span>
  );
}

/** Verified mark: solid green circle with a white tick, drawn in code so it stays sharp at any size. */
export function VerifiedTick({ size = 16 }: { size?: number }) {
  return (
    <svg className="verified-tick" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Verified resident">
      <title>Verified resident</title>
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <path d="M6.2 12.4l3.9 3.9 7.7-7.9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

export function TrustBadges({ provider, stats, compact }: { provider: Provider; stats: RatingStats; compact?: boolean }) {
  return (
    <div className="badges">
      {!compact && <span className="badge b-verified"><BadgeCheck size={13} /> Verified resident</span>}
      {stats.isNew && <span className="badge b-new"><Sparkles size={12} /> New neighbour</span>}
      {provider.introOffer && stats.isNew && <span className="badge b-offer"><Gift size={12} /> {provider.introOffer}</span>}
      {!compact && provider.socialVerified && <span className="badge b-plain">Socials linked</span>}
      {!compact && <span className="badge b-plain"><Clock size={12} /> Replies in ~{provider.responseMins < 60 ? `${provider.responseMins} min` : `${Math.round(provider.responseMins / 60)} h`}</span>}
    </div>
  );
}

const STATUS_TEXT: Record<BookingStatus, string> = {
  requested: "Waiting for provider", accepted: "Waiting for you to confirm", confirmed: "Confirmed", completed: "Completed",
  reviewed: "Reviewed", declined: "Declined", cancelled: "Cancelled", expired: "Expired",
};
const STATUS_TEXT_PROVIDER: Partial<Record<BookingStatus, string>> = { requested: "New request", accepted: "Waiting for customer" };

export function StatusPill({ status, forProvider }: { status: BookingStatus; forProvider?: boolean }) {
  return <span className={`status st-${status}`}>{(forProvider && STATUS_TEXT_PROVIDER[status]) || STATUS_TEXT[status]}</span>;
}

export function Sheet({ title, onClose, children, label }: { title: string; onClose: () => void; children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label ?? title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="x-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Toasts() {
  const list = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>
      ))}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <div className="strong" style={{ color: "var(--ink)" }}>{title}</div>
      {children}
    </div>
  );
}

export function categoryName(id: string | null | undefined) {
  return categoryById(id)?.name ?? "Service";
}

export function OnlineBadge() {
  return <span className="badge b-plain"><Globe size={12} /> Online</span>;
}

/**
 * Aerial township illustration drawn on canvas: rows of roofs, streets and trees,
 * echoing the drone photography on the developer's own site. Deterministic per seed.
 */
export function AerialCanvas({ seed = 7, dense = 1 }: { seed?: number; dense?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth || 800;
      const h = c.clientHeight || 400;
      c.width = w * dpr;
      c.height = h * dpr;
      const g = c.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      let s = seed;
      const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#1f3a3b");
      sky.addColorStop(1, "#2c4a36");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      g.save();
      g.translate(w * 0.5, h * 0.55);
      g.rotate(-0.32);
      g.translate(-w * 0.9, -h * 0.9);
      const roofs = ["#3c4a57", "#5a6672", "#7b3f35", "#8d4a3a", "#e8e4dc", "#c9c3b8", "#4b5966"];
      const rowH = 34 / dense;
      for (let y = 0; y < h * 1.9; y += rowH * 2.2) {
        g.fillStyle = "#38463f";
        g.fillRect(0, y - 6, w * 1.9, 10);
        g.fillStyle = "rgba(240,236,228,0.18)";
        g.fillRect(0, y - 2, w * 1.9, 1.5);
        let x = r() * 20;
        while (x < w * 1.9) {
          const bw = (16 + r() * 8) / dense;
          if (r() < 0.12) {
            for (let t = 0; t < 3; t++) {
              g.fillStyle = `hsl(${105 + r() * 30} ${35 + r() * 20}% ${22 + r() * 14}%)`;
              g.beginPath();
              g.arc(x + r() * bw * 2, y + 14 + r() * 20, (6 + r() * 7) / dense, 0, Math.PI * 2);
              g.fill();
            }
            x += bw * 2.2;
            continue;
          }
          const col = roofs[Math.floor(r() * roofs.length)];
          g.fillStyle = col;
          g.fillRect(x, y + 8, bw, rowH * 1.25);
          g.fillStyle = "rgba(0,0,0,0.22)";
          g.fillRect(x + bw / 2, y + 8, bw / 2, rowH * 1.25);
          g.fillStyle = "rgba(255,255,255,0.07)";
          g.fillRect(x, y + 8, bw, 3);
          x += bw + 2.5;
        }
      }
      g.restore();
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [seed, dense]);
  return <canvas ref={ref} aria-hidden />;
}
