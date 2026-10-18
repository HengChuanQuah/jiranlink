import { useEffect, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng, Zone } from "../data/types";

export interface MapPin {
  id: string;
  point: LatLng;
  area: boolean; // true = home-based provider, drawn as a shaded circle, never the exact home
  label: string; // initials
  price?: string; // e.g. "RM80"
  hue: number;
}

interface Props {
  center: LatLng;
  zoom?: number;
  home?: LatLng;
  zones?: Zone[];
  pins?: MapPin[];
  rings?: number[]; // km circles around home
  selectedId?: string | null;
  hotId?: string | null;
  onSelect?: (id: string) => void;
  googleKey?: string;
  mapId?: string;
  className?: string;
  children?: ReactNode; // floating overlay, e.g. the selected provider card
}

// ---------- shared pin drawing (same look on Google and OpenStreetMap) ----------

function pinElement(p: MapPin): HTMLElement {
  const el = document.createElement("div");
  el.className = "mpin";
  el.dataset.pin = p.id;
  el.style.setProperty("--h", String(p.hue));
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${p.label}${p.price ? `, from ${p.price}` : ""}`);
  const ini = document.createElement("span");
  ini.className = "mpin-ini";
  ini.textContent = p.label;
  el.appendChild(ini);
  if (p.price) {
    const pr = document.createElement("span");
    pr.className = "mpin-price";
    pr.textContent = p.price;
    el.appendChild(pr);
  }
  return el;
}

function homeElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "map-home";
  el.title = "Your home";
  el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M3 11 12 3l9 8v10H3z"/></svg>`;
  return el;
}

function ringLabelElement(km: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "map-ring-label";
  el.textContent = `${km} km`;
  return el;
}

/** Point `km` north of p, for ring labels. */
const northOf = (p: LatLng, km: number): LatLng => [p[0] + km / 111.32, p[1]];

function applyPinState(pinEls: Map<string, HTMLElement>, selectedId?: string | null, hotId?: string | null) {
  pinEls.forEach((el, id) => {
    el.classList.toggle("sel", id === selectedId);
    el.classList.toggle("hot", id === hotId && id !== selectedId);
  });
}

const pinsKey = (pins: MapPin[]) => pins.map((p) => `${p.id}@${p.point.join(",")}:${p.price ?? ""}`).join("|");

// ---------- Google Maps loading, with a per-browser daily cap so the free tier is never exceeded ----------

const LOADS_KEY = "jiranlink-map-loads";
export const DAILY_GOOGLE_LOADS = 60;

/** Counts one Google map load for today. Returns false once this browser has used today's allowance. */
export function takeGoogleLoad(now = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem(LOADS_KEY) ?? "{}");
    const used = raw.day === day ? Number(raw.n) || 0 : 0;
    if (used >= DAILY_GOOGLE_LOADS) return false;
    localStorage.setItem(LOADS_KEY, JSON.stringify({ day, n: used + 1 }));
  } catch {
    /* storage blocked: allow, the shared map below still keeps loads low */
  }
  return true;
}

let googlePromise: Promise<any> | null = null;
let authFailed = false;
const failListeners = new Set<() => void>();

export function loadGoogle(key: string): Promise<any> {
  const w = window as any;
  if (authFailed) return Promise.reject(new Error("Google Maps rejected the key"));
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (googlePromise) return googlePromise;
  googlePromise = new Promise((resolve, reject) => {
    // Google calls this when the key is wrong or the website is not allowed.
    w.gm_authFailure = () => {
      authFailed = true;
      shared = null;
      failListeners.forEach((f) => f());
    };
    w.__jlMapsReady = () => resolve(w.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__jlMapsReady`;
    s.async = true;
    s.onerror = () => {
      googlePromise = null;
      reject(new Error("Google Maps could not be reached"));
    };
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("Google Maps took too long")), 12000);
  });
  return googlePromise;
}

// One Google map is created per visit and moved between screens, because Google counts every new map as a load.
let shared: { div: HTMLDivElement; map: any; libs: any } | null = null;

export function MapView(props: Props) {
  const [useGoogle, setUseGoogle] = useState(!!props.googleKey && !authFailed);
  useEffect(() => {
    setUseGoogle(!!props.googleKey && !authFailed);
  }, [props.googleKey]);
  return useGoogle ? <GoogleMapView {...props} onFail={() => setUseGoogle(false)} /> : <LeafletMapView {...props} />;
}

function Legend({ rings, note, leaflet }: { rings?: number[]; note: string; leaflet?: boolean }) {
  return (
    <div className={`map-legend${leaflet ? " lf" : ""}`}>
      <span><i className="lg-home" /> Your home</span>
      {rings && rings.length > 0 && <span><i className="lg-ring" /> {rings.join(" / ")} km</span>}
      <span className="lg-note">{note}</span>
    </div>
  );
}

// ---------- OpenStreetMap (Leaflet): the free fallback ----------

function LeafletMapView({ center, zoom = 15, home, zones = [], pins = [], rings = [], selectedId, hotId, onSelect, className, children }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const select = useRef(onSelect);
  select.current = onSelect;
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(center, zoom);
    let errors = 0;
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" });
    tiles.on("tileerror", () => {
      errors++;
      if (errors === 4) {
        m.removeLayer(tiles);
        setOffline(true);
      }
    });
    tiles.addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // Leaflet measures its container once; re-measure when the layout settles or changes.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Frame home and every pin; fall back to the given centre and zoom when there is nothing to frame.
  const frameKey = [center, home, ...pins.map((p) => p.point)].map((p) => (p ? p.join(",") : "")).join("|");
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const pts = [...pins.map((p) => p.point), ...(home ? [home] : [])];
    m.invalidateSize();
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts.map((p) => L.latLng(p[0], p[1]))).pad(0.25), { maxZoom: 16, animate: false });
    else m.setView(center, zoom, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, zoom]);

  const drawKey = `${pinsKey(pins)}#${zones.map((z) => z.id).join(",")}#${home?.join(",")}#${rings.join(",")}`;
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    pinEls.current.clear();
    for (const z of zones) {
      const style = z.type === "township"
        ? { color: "#e1251b", weight: 1.5, dashArray: "6 6", fillOpacity: 0.02 }
        : z.type === "precinct"
          ? { color: "#f47c20", weight: 1, fillOpacity: 0.05 }
          : { color: "#1d2630", weight: 1.5, fillOpacity: 0.12 };
      const poly = L.polygon(z.polygon, { ...style, interactive: z.type !== "township" }).addTo(g);
      // Only the township name is always visible; precinct and building names appear on hover or tap.
      poly.bindTooltip(z.name, { permanent: z.type === "township", direction: z.type === "township" ? "top" : "center", className: "zone-label", sticky: z.type !== "township" });
    }
    if (home) {
      for (const km of rings) {
        L.circle(home, { radius: km * 1000, color: "#1d2630", weight: 1, opacity: 0.35, dashArray: "3 6", fill: false, interactive: false }).addTo(g);
        L.marker(northOf(home, km), { icon: L.divIcon({ className: "", html: ringLabelElement(km).outerHTML, iconSize: [0, 0] }), interactive: false }).addTo(g);
      }
    }
    for (const p of pins) {
      if (p.area) L.circle(p.point, { radius: 220, color: `hsl(${p.hue} 62% 42%)`, weight: 1.5, fillOpacity: 0.16 }).addTo(g).on("click", () => select.current?.(p.id));
      const pe = pinElement(p);
      const wrap = document.createElement("div");
      wrap.className = "mpin-lf";
      wrap.appendChild(pe);
      L.marker(p.point, { icon: L.divIcon({ className: "", html: wrap, iconSize: [0, 0] }), title: p.label, keyboard: true, riseOnHover: true })
        .addTo(g)
        .on("click", () => select.current?.(p.id));
      pinEls.current.set(p.id, pe);
    }
    if (home) {
      const wrap = document.createElement("div");
      wrap.className = "home-lf";
      wrap.appendChild(homeElement());
      L.marker(home, { icon: L.divIcon({ className: "", html: wrap, iconSize: [0, 0] }), zIndexOffset: 1000, interactive: false }).addTo(g);
    }
    applyPinState(pinEls.current, selectedId, hotId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey]);

  useEffect(() => {
    applyPinState(pinEls.current, selectedId, hotId);
  }, [selectedId, hotId]);

  return (
    <div className={`map-box ${className ?? ""}`}>
      <div ref={el} style={{ width: "100%", height: "100%" }} />
      <Legend leaflet rings={home ? rings : undefined} note={offline ? "Map tiles unavailable, showing outlines only." : "Shaded circles: home-based, area only."} />
      {children}
    </div>
  );
}

// ---------- Google Maps ----------

function GoogleMapView({ center, zoom = 15, home, zones = [], pins = [], rings = [], selectedId, hotId, onSelect, googleKey, mapId, className, children, onFail }: Props & { onFail: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(!!shared);
  const drawn = useRef<any[]>([]);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const select = useRef(onSelect);
  select.current = onSelect;
  const fail = useRef(onFail);
  fail.current = onFail;

  useEffect(() => {
    let cancelled = false;
    const bail = () => !cancelled && fail.current();
    failListeners.add(bail);
    (async () => {
      try {
        const google = await loadGoogle(googleKey!);
        if (!shared) {
          if (!takeGoogleLoad()) throw new Error("Daily Google map allowance used");
          const [maps, marker] = await Promise.all([google.maps.importLibrary("maps"), google.maps.importLibrary("marker")]);
          const div = document.createElement("div");
          div.style.cssText = "width:100%;height:100%";
          const map = new maps.Map(div, {
            center: { lat: center[0], lng: center[1] }, zoom, mapId: mapId || "DEMO_MAP_ID",
            disableDefaultUI: true, zoomControl: true, clickableIcons: false,
          });
          shared = { div, map, libs: { ...maps, ...marker } };
        }
        if (cancelled || !holder.current) return;
        holder.current.appendChild(shared.div);
        // Phones scroll the page with one finger; desktops pan the map directly, like Google Maps.
        shared.map.setOptions({ gestureHandling: window.matchMedia("(min-width: 980px)").matches ? "greedy" : "cooperative" });
        setReady(true);
      } catch {
        bail();
      }
    })();
    return () => {
      cancelled = true;
      failListeners.delete(bail);
      drawn.current.forEach((x) => (x.map = null, x.setMap?.(null)));
      drawn.current = [];
      shared?.div.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleKey]);

  const drawKey = `${pinsKey(pins)}#${zones.map((z) => z.id).join(",")}#${home?.join(",")}#${rings.join(",")}#${center.join(",")}#${zoom}`;
  useEffect(() => {
    if (!ready || !shared) return;
    const { map: m, libs } = shared;
    const ll = (p: LatLng) => ({ lat: p[0], lng: p[1] });
    drawn.current.forEach((x) => (x.map = null, x.setMap?.(null)));
    drawn.current = [];
    pinEls.current.clear();

    for (const z of zones) {
      drawn.current.push(new libs.Polygon({ map: m, paths: z.polygon.map(ll), clickable: false, strokeColor: z.type === "township" ? "#e1251b" : "#f47c20", strokeOpacity: z.type === "township" ? 0.6 : 0.4, strokeWeight: z.type === "township" ? 1.5 : 1, fillOpacity: z.type === "building" ? 0.12 : 0.03 }));
    }
    if (home) {
      for (const km of rings) {
        drawn.current.push(new libs.Circle({ map: m, center: ll(home), radius: km * 1000, clickable: false, strokeColor: "#1d2630", strokeOpacity: 0.3, strokeWeight: 1, fillOpacity: 0 }));
        drawn.current.push(new libs.AdvancedMarkerElement({ map: m, position: ll(northOf(home, km)), content: ringLabelElement(km), zIndex: 1 }));
      }
    }
    for (const p of pins) {
      if (p.area) {
        const c = new libs.Circle({ map: m, center: ll(p.point), radius: 220, strokeColor: `hsl(${p.hue},62%,42%)`, strokeWeight: 1.5, fillColor: `hsl(${p.hue},62%,42%)`, fillOpacity: 0.16 });
        c.addListener("click", () => select.current?.(p.id));
        drawn.current.push(c);
      }
      const pe = pinElement(p);
      const mk = new libs.AdvancedMarkerElement({ map: m, position: ll(p.point), content: pe, title: p.label, gmpClickable: true, zIndex: 10 });
      mk.addListener("click", () => select.current?.(p.id));
      drawn.current.push(mk);
      pinEls.current.set(p.id, pe);
    }
    if (home) {
      const he = homeElement();
      he.classList.add("home-g");
      drawn.current.push(new libs.AdvancedMarkerElement({ map: m, position: ll(home), content: he, title: "Your home", zIndex: 5 }));
    }
    applyPinState(pinEls.current, selectedId, hotId);

    const pts = [...pins.map((p) => p.point), ...(home ? [home] : [])];
    const g = (window as any).google;
    if (pts.length > 1 && g?.maps?.LatLngBounds) {
      const b = new g.maps.LatLngBounds();
      pts.forEach((p) => b.extend(ll(p)));
      m.fitBounds(b, 56);
    } else {
      m.setCenter(ll(center));
      m.setZoom(zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, drawKey]);

  useEffect(() => {
    applyPinState(pinEls.current, selectedId, hotId);
    if (!ready || !shared || !selectedId) return;
    const p = pins.find((x) => x.id === selectedId);
    if (p) shared.map.panTo({ lat: p.point[0], lng: p.point[1] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, hotId, ready]);

  return (
    <div className={`map-box ${className ?? ""}`}>
      <div ref={holder} style={{ width: "100%", height: "100%" }} />
      {!ready && <div className="map-loading" aria-hidden />}
      <Legend rings={home ? rings : undefined} note="Shaded circles: home-based, area only." />
      {children}
    </div>
  );
}
