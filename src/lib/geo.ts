import type { LatLng, Zone } from "../data/types";
import { ZONES } from "../data/geo";

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ray-casting point-in-polygon test (lat/lng treated as planar; fine at township scale). */
export function inPolygon(p: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const intersect = yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface ZoneMembership {
  building?: Zone;
  precinct?: Zone;
  township?: Zone;
}

export function zonesFor(p: LatLng, zones: Zone[] = ZONES): ZoneMembership {
  const m: ZoneMembership = {};
  for (const z of zones) {
    if (!inPolygon(p, z.polygon)) continue;
    if (z.type === "building") m.building = z;
    else if (z.type === "precinct") m.precinct = z;
    else m.township = z;
  }
  return m;
}

/** Public location for home-based providers: snapped to a ~170 m grid so the exact home is never revealed. */
export function blurPoint(p: LatLng): LatLng {
  const step = 0.0015;
  return [Math.round(p[0] / step) * step, Math.round(p[1] / step) * step];
}

/** Distance label rounded so it cannot be used to triangulate a home. */
export function distanceLabel(m: number): string {
  if (m < 150) return "Under 150 m";
  if (m < 1000) return `About ${Math.round(m / 100) * 100} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
