/**
 * The matching rules (PRD section 19), kept pure: no database, no clock, no randomness.
 * The same inputs always give the same pairs, so every decision can be explained and tested.
 *
 * Stage order, mirroring the PRD:
 *   1. opposite sexes only
 *   2. hard filters, both ways          (age, marital status, location)
 *   3. non-negotiables, both ways       (their answer must be one you accept)
 *   4. not previously closed / excluded
 *   5. a score for how well preferences line up, and a minimum score
 *   6. each person is paired at most once per round, best scores first
 */
import { Filters, Level, QUESTIONS } from "./questionnaire";

export interface Candidate {
  userId: string;
  gender: "MALE" | "FEMALE";
  age: number;
  maritalStatus: string;
  country?: string | null;
  region?: string | null;
  self: Record<string, string>;
  seek: Record<string, { accept: string[]; level: Level }>;
  filters: Filters;
  /** When they became matchable. Earlier is served first on equal scores. */
  waitingSince: Date;
}

/** Flexible answers count a little: a mismatch there is something to talk about, not a reason to refuse. */
export const LEVEL_WEIGHT: Record<Level, number> = { NON_NEGOTIABLE: 1, PREFERENCE: 1, FLEXIBLE: 0.25 };

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

export type Rejection =
  | "SAME_GENDER"
  | "FILTER_AGE"
  | "FILTER_MARITAL_STATUS"
  | "FILTER_LOCATION"
  | "NON_NEGOTIABLE";

/** Do `other`'s facts satisfy what `seeker` asked for in hard filters? */
export function passesFilters(seeker: Candidate, other: Candidate): Rejection | null {
  const f = seeker.filters;
  if (other.age < f.ageMin || other.age > f.ageMax) return "FILTER_AGE";
  if (!f.maritalStatuses.includes(other.maritalStatus)) return "FILTER_MARITAL_STATUS";
  if (f.locationScope === "SAME_COUNTRY") {
    if (!norm(seeker.country) || norm(seeker.country) !== norm(other.country)) return "FILTER_LOCATION";
  }
  if (f.locationScope === "SAME_REGION") {
    const sameCountry = norm(seeker.country) !== "" && norm(seeker.country) === norm(other.country);
    const sameRegion = norm(seeker.region) !== "" && norm(seeker.region) === norm(other.region);
    if (!sameCountry || !sameRegion) return "FILTER_LOCATION";
  }
  return null;
}

/** Questions where `seeker` said non-negotiable and `other`'s own answer is not acceptable. */
export function brokenNonNegotiables(seeker: Candidate, other: Candidate): string[] {
  const broken: string[] = [];
  for (const q of QUESTIONS) {
    const s = seeker.seek[q.key];
    if (s?.level === "NON_NEGOTIABLE" && !s.accept.includes(other.self[q.key])) broken.push(q.key);
  }
  return broken;
}

/** 0 to 1: how much of what `seeker` asked for (weighted by firmness) `other` offers. */
export function directionalScore(seeker: Candidate, other: Candidate): number {
  let earned = 0;
  let possible = 0;
  for (const q of QUESTIONS) {
    const s = seeker.seek[q.key];
    if (!s) continue;
    const w = q.weight * LEVEL_WEIGHT[s.level];
    possible += w;
    if (s.accept.includes(other.self[q.key])) earned += w;
  }
  return possible === 0 ? 1 : earned / possible;
}

export type PairResult = { ok: true; score: number } | { ok: false; reason: Rejection };

export function evaluatePair(a: Candidate, b: Candidate): PairResult {
  if (a.gender === b.gender) return { ok: false, reason: "SAME_GENDER" };
  const f = passesFilters(a, b) ?? passesFilters(b, a);
  if (f) return { ok: false, reason: f };
  if (brokenNonNegotiables(a, b).length || brokenNonNegotiables(b, a).length) return { ok: false, reason: "NON_NEGOTIABLE" };
  // The average of both directions, rounded so ties are real ties rather than float noise
  const score = Math.round(((directionalScore(a, b) + directionalScore(b, a)) / 2) * 10000) / 10000;
  return { ok: true, score };
}

export const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

export interface RoundPlan {
  pairs: { a: string; b: string; score: number }[];
  stats: {
    candidates: number;
    pairsConsidered: number;
    excluded: number;
    belowMinimumScore: number;
    rejected: Partial<Record<Rejection, number>>;
    eligiblePairs: number;
    unmatched: number;
  };
}

/**
 * Builds one round. Candidates must already be limited to people who are eligible and free
 * (finished the programme, completed the form, available, no current match).
 */
export function planRound(
  candidates: Candidate[],
  opts: { isExcluded: (a: string, b: string) => boolean; minScore: number },
): RoundPlan {
  const stats: RoundPlan["stats"] = {
    candidates: candidates.length,
    pairsConsidered: 0,
    excluded: 0,
    belowMinimumScore: 0,
    rejected: {},
    eligiblePairs: 0,
    unmatched: 0,
  };

  const scored: { a: Candidate; b: Candidate; score: number }[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      stats.pairsConsidered++;
      if (opts.isExcluded(a.userId, b.userId)) {
        stats.excluded++;
        continue;
      }
      const r = evaluatePair(a, b);
      if (!r.ok) {
        stats.rejected[r.reason] = (stats.rejected[r.reason] ?? 0) + 1;
        continue;
      }
      if (r.score < opts.minScore) {
        stats.belowMinimumScore++;
        continue;
      }
      stats.eligiblePairs++;
      scored.push({ a, b, score: r.score });
    }
  }

  // Best score first. On a tie, whoever has waited longest goes first, then ids for a stable order.
  const waited = (p: { a: Candidate; b: Candidate }) => Math.min(p.a.waitingSince.getTime(), p.b.waitingSince.getTime());
  scored.sort(
    (x, y) =>
      y.score - x.score ||
      waited(x) - waited(y) ||
      pairKey(x.a.userId, x.b.userId).localeCompare(pairKey(y.a.userId, y.b.userId)),
  );

  const taken = new Set<string>();
  const pairs: RoundPlan["pairs"] = [];
  for (const p of scored) {
    if (taken.has(p.a.userId) || taken.has(p.b.userId)) continue;
    taken.add(p.a.userId);
    taken.add(p.b.userId);
    const [a, b] = p.a.userId < p.b.userId ? [p.a.userId, p.b.userId] : [p.b.userId, p.a.userId];
    pairs.push({ a, b, score: p.score });
  }
  stats.unmatched = candidates.length - taken.size;
  return { pairs, stats };
}

export const ageOn = (dob: Date, on: Date): number => {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const had = on.getUTCMonth() > dob.getUTCMonth() || (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() >= dob.getUTCDate());
  if (!had) age -= 1;
  return age;
};
