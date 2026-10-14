import type { AppState, LatLng, Provider, Service, User } from "../data/types";
import { distanceM, zonesFor, type ZoneMembership } from "./geo";
import { ratingStats, type RatingStats } from "./rating";
import { now } from "./time";

export type SortMode = "nearest" | "top";

export interface SearchResult {
  provider: Provider;
  service: Service;
  distanceM: number;
  ring: number; // 0 building, 1 precinct, 2 township, 3.. km rings, -1 online
  ringLabel: string;
  stats: RatingStats;
  newcomerSlot?: boolean;
}

export interface SearchOutput {
  results: SearchResult[];
  online: SearchResult[];
  exception?: SearchResult;
  reachedRing: number;
  reachedLabel: string;
  hiddenBelowFloor: number;
  widened: boolean;
}

export interface SearchInput {
  resident: Pick<User, "id" | "home" | "blocked">;
  categoryIds: string[];
  sort?: SortMode;
  onlineOnly?: boolean;
  rotationSeed?: number;
}

const RING_NAMES = ["building", "precinct", "township"];

export function ringFor(
  home: LatLng,
  homeZones: ZoneMembership,
  providerPoint: LatLng,
  ringsKm: number[],
): { ring: number; distance: number } {
  const distance = distanceM(home, providerPoint);
  const pz = zonesFor(providerPoint);
  if (homeZones.building && pz.building?.id === homeZones.building.id) return { ring: 0, distance };
  if (homeZones.precinct && pz.precinct?.id === homeZones.precinct.id) return { ring: 1, distance };
  if (homeZones.township && pz.township?.id === homeZones.township.id) return { ring: 2, distance };
  for (let i = 0; i < ringsKm.length; i++) if (distance <= ringsKm[i] * 1000) return { ring: 3 + i, distance };
  return { ring: -1, distance };
}

export function ringLabel(ring: number, homeZones: ZoneMembership, ringsKm: number[]): string {
  if (ring === 0) return "In your building";
  if (ring === 1) return `In ${homeZones.precinct?.name ?? "your neighbourhood"}`;
  if (ring === 2) return `In ${homeZones.township?.name ?? "your township"}`;
  if (ring >= 3) return `Within ${ringsKm[ring - 3]} km`;
  return "Online";
}

export function reachedLabel(ring: number, homeZones: ZoneMembership, ringsKm: number[]): string {
  if (ring < 0) return "nothing nearby";
  if (ring <= 2) return `your ${RING_NAMES[ring]}${ring === 1 && homeZones.precinct ? ` (${homeZones.precinct.name})` : ring === 2 && homeZones.township ? ` (${homeZones.township.name})` : ""}`;
  return `${ringsKm[ring - 3]} km of home`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Proximity-first search with a quality floor.
 * 1. Build rings: building, precinct, township, then 2 / 5 / 10 km.
 * 2. Widen ring by ring until there are `targetResults` acceptable providers (or rings run out).
 * 3. Sort by ring, then distance, then rating ("nearest"), or by rating ("top").
 * 4. Guarantee one newcomer in the top results, rotating fairly among new providers.
 * 5. Offer one "highly rated, a bit further" card when someone outside the reached ring is clearly better.
 * Online services skip proximity and are listed separately.
 */
export function searchProviders(state: AppState, input: SearchInput): SearchOutput {
  const cfg = state.config;
  const cats = new Set(input.categoryIds);
  const homeZones = zonesFor(input.resident.home);
  const sort = input.sort ?? "nearest";

  const eligible = (p: Provider) => p.active && !p.hidden && p.id !== input.resident.id && !input.resident.blocked.includes(p.id);

  // Best matching service per provider, preferring the order of categoryIds.
  const byProvider = new Map<string, Service[]>();
  for (const s of state.services) {
    if (!cats.has(s.categoryId)) continue;
    const list = byProvider.get(s.providerId) ?? [];
    list.push(s);
    byProvider.set(s.providerId, list);
  }
  const catRank = (id: string) => input.categoryIds.indexOf(id);

  const local: SearchResult[] = [];
  const onlineCandidates: SearchResult[] = [];
  const lowRatedRings: number[] = [];

  for (const [pid, svcs] of byProvider) {
    const provider = state.providers.find((p) => p.id === pid);
    if (!provider || !eligible(provider)) continue;
    const stats = ratingStats(provider, state.reviews, cfg);
    svcs.sort((a, b) => catRank(a.categoryId) - catRank(b.categoryId));

    const inPerson = svcs.filter((s) => !s.online);
    const online = svcs.filter((s) => s.online);

    const { ring, distance } = ringFor(input.resident.home, homeZones, provider.exact, cfg.ringsKm);
    const covers = distance <= provider.serviceRadiusKm * 1000 || ring === 0 || ring === 1;

    let placedLocally = false;
    if (!input.onlineOnly && ring >= 0 && covers) {
      const service = inPerson[0] ?? online[0];
      if (service) {
        if (!stats.acceptable) lowRatedRings.push(ring);
        else {
          local.push({ provider, service, distanceM: distance, ring, ringLabel: ringLabel(ring, homeZones, cfg.ringsKm), stats });
          placedLocally = true;
        }
      }
    }
    if (!placedLocally && online.length && stats.acceptable) {
      onlineCandidates.push({ provider, service: online[0], distanceM: distance, ring: -1, ringLabel: "Online", stats });
    }
  }

  // Widen ring by ring.
  const maxRing = 2 + cfg.ringsKm.length;
  let reached = -1;
  let count = 0;
  for (let r = 0; r <= maxRing; r++) {
    count += local.filter((x) => x.ring === r).length;
    reached = r;
    if (count >= cfg.targetResults) break;
  }
  const firstNonEmpty = local.length ? Math.min(...local.map((x) => x.ring)) : -1;

  let results = local.filter((x) => x.ring <= reached);
  const beyond = local.filter((x) => x.ring > reached);

  const byNearest = (a: SearchResult, b: SearchResult) => a.ring - b.ring || a.distanceM - b.distanceM || b.stats.bayes - a.stats.bayes;
  const byTop = (a: SearchResult, b: SearchResult) => b.stats.bayes - a.stats.bayes || a.distanceM - b.distanceM;
  results.sort(sort === "top" ? byTop : byNearest);

  // Newcomer slot.
  const top = Math.min(cfg.targetResults, results.length);
  const hasNewInTop = results.slice(0, top).some((x) => x.stats.isNew);
  const newOutside = results.slice(top).filter((x) => x.stats.isNew);
  if (!hasNewInTop && newOutside.length) {
    const seed = input.rotationSeed ?? Math.floor(now().getTime() / 86_400_000) + hashString(input.categoryIds.join(","));
    const pick = newOutside[seed % newOutside.length];
    results = results.filter((x) => x !== pick);
    const pos = Math.min(1, results.length);
    results.splice(pos, 0, { ...pick, newcomerSlot: true });
  } else if (hasNewInTop) {
    results = results.map((x, i) => (i < top && x.stats.isNew ? { ...x, newcomerSlot: false } : x));
  }

  // Exception card.
  let exception: SearchResult | undefined;
  const best = results.reduce((m, x) => Math.max(m, x.stats.bayes), 0);
  const better = beyond
    .filter((x) => x.stats.totalCount >= cfg.exceptionMinReviews && x.stats.bayes >= best + cfg.exceptionStarGap)
    .sort((a, b) => b.stats.bayes - a.stats.bayes);
  if (better.length && results.length) exception = better[0];

  onlineCandidates.sort((a, b) => b.stats.bayes - a.stats.bayes);

  return {
    results,
    online: onlineCandidates,
    exception,
    reachedRing: local.length ? reached : -1,
    reachedLabel: reachedLabel(local.length ? reached : -1, homeZones, cfg.ringsKm),
    hiddenBelowFloor: lowRatedRings.filter((r) => r <= reached).length,
    widened: firstNonEmpty > 1 || (firstNonEmpty >= 0 && reached > firstNonEmpty),
  };
}
