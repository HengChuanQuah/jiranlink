import type { AppState, Config, Provider, Review } from "../data/types";
import { now } from "./time";

export interface RatingStats {
  bookedCount: number;
  pastCount: number; // past-customer reviews that count (capped)
  pastTotal: number; // all past-customer reviews
  totalCount: number; // bookedCount + pastCount
  displayAvg: number; // simple average of every review, for display
  bayes: number; // weighted Bayesian average used for ranking
  isNew: boolean;
  floorExempt: boolean;
  acceptable: boolean;
  daysSinceJoin: number;
}

/**
 * Bayesian average: every provider starts from a neutral prior (priorMean, counted as priorWeight reviews).
 * Booked reviews count fully; past-customer reviews count at pastWeight, and only the first pastMax of them.
 */
export function ratingStats(provider: Provider, reviews: Review[], cfg: Config): RatingStats {
  const mine = reviews.filter((r) => r.providerId === provider.id);
  const booked = mine.filter((r) => r.type === "booked");
  const past = mine
    .filter((r) => r.type === "past")
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, cfg.pastMax);

  const bookedSum = booked.reduce((s, r) => s + r.stars, 0);
  const pastSum = past.reduce((s, r) => s + r.stars, 0);
  const weight = cfg.priorWeight + booked.length + cfg.pastWeight * past.length;
  const bayes = (cfg.priorMean * cfg.priorWeight + bookedSum + cfg.pastWeight * pastSum) / weight;

  const all = mine;
  const displayAvg = all.length ? all.reduce((s, r) => s + r.stars, 0) / all.length : 0;
  const totalCount = booked.length + past.length;
  const daysSinceJoin = (now().getTime() - new Date(provider.joinedAt).getTime()) / 86_400_000;

  const floorExempt = totalCount < cfg.floorExemptReviews;
  const acceptable = floorExempt || bayes >= cfg.qualityFloor;
  const isNew =
    totalCount < cfg.newMaxReviews &&
    daysSinceJoin <= cfg.newMaxDays &&
    (totalCount < cfg.floorExemptReviews || bayes >= cfg.qualityFloor);

  return {
    bookedCount: booked.length,
    pastCount: past.length,
    pastTotal: mine.filter((r) => r.type === "past").length,
    totalCount,
    displayAvg,
    bayes,
    isNew,
    floorExempt,
    acceptable,
    daysSinceJoin,
  };
}

export function statsFor(state: AppState, providerId: string): RatingStats | null {
  const p = state.providers.find((x) => x.id === providerId);
  return p ? ratingStats(p, state.reviews, state.config) : null;
}
