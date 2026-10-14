import type { LatLng, Township, Zone } from "./types";

// Coordinates are approximate and for demonstration only. Replace the polygons with
// surveyed outlines (or Google place boundaries) before any real pilot.

function box(center: LatLng, halfLatM: number, halfLngM: number, skew = 0): LatLng[] {
  const dLat = halfLatM / 111_320;
  const dLng = halfLngM / (111_320 * Math.cos((center[0] * Math.PI) / 180));
  const s = skew * dLng;
  return [
    [center[0] + dLat, center[1] - dLng + s],
    [center[0] + dLat, center[1] + dLng + s],
    [center[0] - dLat, center[1] + dLng - s],
    [center[0] - dLat, center[1] - dLng - s],
  ];
}

export const TOWNSHIPS: Township[] = [
  {
    id: "elmina",
    name: "City of Elmina",
    center: [3.1992, 101.5006],
    blurb: "Growing township in Shah Alam with precincts still filling up.",
    mall: "Elmina Lakeside Mall",
  },
  {
    id: "melawati",
    name: "Taman Melawati",
    center: [3.2122, 101.7498],
    blurb: "Mature landed township in north-east Kuala Lumpur.",
    mall: "Melawati Mall",
  },
  {
    id: "kleast",
    name: "KL East",
    center: [3.2072, 101.7332],
    blurb: "Integrated enclave beside Taman Melawati, with homes above KL East Mall.",
    mall: "KL East Mall",
  },
];

export const ZONES: Zone[] = [
  // City of Elmina
  { id: "elmina", name: "City of Elmina", type: "township", townshipId: "elmina", parentId: null, gated: false, polygon: box([3.1992, 101.5006], 1700, 2300) },
  { id: "elmina-green", name: "Elmina Green", type: "precinct", townshipId: "elmina", parentId: "elmina", gated: true, polygon: box([3.2045, 101.4925], 380, 420, 0.15) },
  { id: "elmina-valley", name: "Elmina Valley", type: "precinct", townshipId: "elmina", parentId: "elmina", gated: true, polygon: box([3.1948, 101.4952], 360, 420, -0.1) },
  { id: "ilham", name: "Ilham Residence", type: "precinct", townshipId: "elmina", parentId: "elmina", gated: true, polygon: box([3.1925, 101.5078], 340, 380, 0.1) },
  { id: "elmina-cc", name: "Elmina City Centre", type: "precinct", townshipId: "elmina", parentId: "elmina", gated: false, polygon: box([3.2012, 101.5052], 300, 360) },

  // Taman Melawati
  { id: "melawati", name: "Taman Melawati", type: "township", townshipId: "melawati", parentId: null, gated: false, polygon: box([3.2122, 101.7498], 1100, 1100) },
  { id: "melawati-north", name: "Melawati North", type: "precinct", townshipId: "melawati", parentId: "melawati", gated: false, polygon: box([3.2165, 101.7495], 380, 520) },
  { id: "melawati-south", name: "Melawati South", type: "precinct", townshipId: "melawati", parentId: "melawati", gated: false, polygon: box([3.2075, 101.7505], 380, 520) },

  // KL East
  { id: "kleast", name: "KL East", type: "township", townshipId: "kleast", parentId: null, gated: false, polygon: box([3.2072, 101.7332], 700, 700) },
  { id: "east57", name: "East 57", type: "precinct", townshipId: "kleast", parentId: "kleast", gated: true, polygon: box([3.2102, 101.7298], 160, 200) },
  { id: "kleast-central", name: "KL East Central", type: "precinct", townshipId: "kleast", parentId: "kleast", gated: false, polygon: box([3.2050, 101.7345], 260, 300) },
  { id: "quarza", name: "Quarza Residence", type: "building", townshipId: "kleast", parentId: "kleast-central", gated: true, polygon: box([3.2051, 101.7342], 45, 55) },
];

export const zoneById = (id: string | null | undefined) => ZONES.find((z) => z.id === id);
export const townshipById = (id: string | null | undefined) => TOWNSHIPS.find((t) => t.id === id);

// Places the onboarding search can find without Google Places.
export interface KnownPlace {
  label: string;
  point: LatLng;
  zoneId: string;
  kind: "building" | "precinct" | "street";
}

export const KNOWN_PLACES: KnownPlace[] = [
  { label: "Elmina Green, City of Elmina", point: [3.2047, 101.4921], zoneId: "elmina-green", kind: "precinct" },
  { label: "Elmina Valley, City of Elmina", point: [3.1946, 101.4955], zoneId: "elmina-valley", kind: "precinct" },
  { label: "Ilham Residence, City of Elmina", point: [3.1927, 101.5076], zoneId: "ilham", kind: "precinct" },
  { label: "Elmina City Centre", point: [3.2013, 101.5049], zoneId: "elmina-cc", kind: "precinct" },
  { label: "Taman Melawati (north)", point: [3.2168, 101.7489], zoneId: "melawati-north", kind: "street" },
  { label: "Taman Melawati (south)", point: [3.2072, 101.7509], zoneId: "melawati-south", kind: "street" },
  { label: "Quarza Residence, KL East", point: [3.2051, 101.7342], zoneId: "quarza", kind: "building" },
  { label: "East 57, KL East", point: [3.2103, 101.7296], zoneId: "east57", kind: "precinct" },
];
