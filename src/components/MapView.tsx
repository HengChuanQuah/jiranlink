import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng, Zone } from "../data/types";

export interface MapPin {
  id: string;
  point: LatLng;
  area: boolean; // true = home-based provider, drawn as a blurred circle
  label: string;
  hue: number;
  selected?: boolean;
}

interface Props {
  center: LatLng;
  zoom?: number;
  home?: LatLng;
  zones?: Zone[];
  pins?: MapPin[];
  onSelect?: (id: string) => void;
  googleKey?: string;
  className?: string;
}

/** Loads the Google Maps JavaScript API once. Resolves with the global google object, or rejects. */
let googlePromise: Promise<any> | null = null;
function loadGoogle(key: string): Promise<any> {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (googlePromise) return googlePromise;
  googlePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
    s.async = true;
    s.onload = () => ((window as any).google?.maps ? resolve((window as any).google) : reject(new Error("Google Maps did not load")));
    s.onerror = () => reject(new Error("Google Maps could not be reached"));
    document.head.appendChild(s);
  });
  return googlePromise;
}
export { loadGoogle };

function pinHtml(p: MapPin) {
  return `<div class="map-pin" style="background:hsl(${p.hue} 62% ${p.selected ? 38 : 46}%);${p.selected ? "transform:rotate(-45deg) scale(1.2);" : ""}"><span>${p.label}</span></div>`;
}

export function MapView(props: Props) {
  const [useGoogle, setUseGoogle] = useState(!!props.googleKey);
  useEffect(() => setUseGoogle(!!props.googleKey), [props.googleKey]);
  return useGoogle ? <GoogleMapView {...props} onFail={() => setUseGoogle(false)} /> : <LeafletMapView {...props} />;
}

function LeafletMapView({ center, zoom = 15, home, zones = [], pins = [], onSelect, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(center, zoom);
    let errors = 0;
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    });
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
  }, [frameKey, zoom]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const z of zones) {
      const style = z.type === "township"
        ? { color: "#e1251b", weight: 2, dashArray: "6 6", fillOpacity: 0.03 }
        : z.type === "precinct"
          ? { color: "#f47c20", weight: 2, fillOpacity: 0.08 }
          : { color: "#1d2630", weight: 2, fillOpacity: 0.15 };
      const poly = L.polygon(z.polygon, style).addTo(g);
      // Only the township name is always visible; precinct and building names appear on hover or tap, so labels never pile up.
      poly.bindTooltip(z.name, { permanent: z.type === "township", direction: z.type === "township" ? "top" : "center", className: "zone-label", sticky: z.type !== "township" });
    }
    for (const p of pins) {
      if (p.area) {
        L.circle(p.point, { radius: 220, color: `hsl(${p.hue} 62% 42%)`, weight: p.selected ? 3 : 1.5, fillOpacity: p.selected ? 0.3 : 0.18 })
          .addTo(g)
          .on("click", () => onSelect?.(p.id));
      }
      L.marker(p.point, { icon: L.divIcon({ className: "", html: pinHtml(p), iconSize: [30, 30], iconAnchor: [15, 30] }), title: p.label, keyboard: true })
        .addTo(g)
        .on("click", () => onSelect?.(p.id));
    }
    if (home) {
      L.marker(home, {
        icon: L.divIcon({ className: "", html: `<div class="map-home" title="Your home"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 11 12 3l9 8v10H3z"/></svg></div>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
        zIndexOffset: 1000,
      }).addTo(g);
    }
  }, [zones, pins, home, onSelect]);

  return (
    <div className={`map-box ${className ?? ""}`}>
      <div ref={el} style={{ width: "100%", height: "100%" }} />
      <div className="map-note">
        {offline ? "Map tiles unavailable here, showing township outlines only." : "Home-based providers appear as shaded areas, never exact homes."}
      </div>
    </div>
  );
}

function GoogleMapView({ center, zoom = 15, home, zones = [], pins = [], onSelect, googleKey, className, onFail }: Props & { onFail: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const drawn = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadGoogle(googleKey!)
      .then((google) => {
        if (cancelled || !el.current) return;
        map.current = new google.maps.Map(el.current, { center: { lat: center[0], lng: center[1] }, zoom, mapTypeControl: false, streetViewControl: false, gestureHandling: "cooperative" });
      })
      .catch(onFail);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleKey]);

  useEffect(() => {
    const google = (window as any).google;
    const m = map.current;
    if (!google || !m) return;
    const pts = [...pins.map((p) => p.point), ...(home ? [home] : [])];
    if (pts.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend({ lat: p[0], lng: p[1] }));
      m.fitBounds(bounds, 48);
    } else m.setCenter({ lat: center[0], lng: center[1] });
    drawn.current.forEach((x) => x.setMap(null));
    drawn.current = [];
    const ll = (p: LatLng) => ({ lat: p[0], lng: p[1] });
    for (const z of zones) {
      drawn.current.push(new google.maps.Polygon({ map: m, paths: z.polygon.map(ll), strokeColor: z.type === "township" ? "#e1251b" : "#f47c20", strokeWeight: 2, fillOpacity: z.type === "building" ? 0.15 : 0.05 }));
    }
    for (const p of pins) {
      if (p.area) drawn.current.push(new google.maps.Circle({ map: m, center: ll(p.point), radius: 220, strokeColor: `hsl(${p.hue},62%,42%)`, fillColor: `hsl(${p.hue},62%,42%)`, fillOpacity: 0.2, strokeWeight: 1.5 }));
      const mk = new google.maps.Marker({ map: m, position: ll(p.point), label: { text: p.label, color: "#fff", fontWeight: "700" }, title: p.label });
      mk.addListener("click", () => onSelect?.(p.id));
      drawn.current.push(mk);
    }
    if (home) drawn.current.push(new google.maps.Marker({ map: m, position: ll(home), title: "Your home" }));
  });

  return (
    <div className={`map-box ${className ?? ""}`}>
      <div ref={el} style={{ width: "100%", height: "100%" }} />
      <div className="map-note">Google Maps. Home-based providers appear as shaded areas.</div>
    </div>
  );
}
