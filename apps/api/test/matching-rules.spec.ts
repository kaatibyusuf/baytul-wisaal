import {
  CATEGORIES,
  Filters,
  Level,
  QUESTIONS,
  QUESTION_BY_KEY,
  validateSubmission,
} from "../src/matching/questionnaire";
import {
  Candidate,
  brokenNonNegotiables,
  directionalScore,
  evaluatePair,
  pairKey,
  passesFilters,
  planRound,
} from "../src/matching/rules";

const everyAnswer = (pick: (i: number) => number = () => 0) => Object.fromEntries(QUESTIONS.map((q, i) => [q.key, q.options[pick(i) % q.options.length].value]));
const acceptAll = (level: Level = "PREFERENCE") =>
  Object.fromEntries(QUESTIONS.map((q) => [q.key, { accept: q.options.map((o) => o.value), level }]));

const openFilters: Filters = { ageMin: 18, ageMax: 100, maritalStatuses: ["NEVER_MARRIED", "DIVORCED", "WIDOWED"], locationScope: "ANYWHERE" };

let seq = 0;
const cand = (over: Partial<Candidate> & { gender: "MALE" | "FEMALE" }): Candidate => ({
  userId: `u${String(++seq).padStart(4, "0")}`,
  age: 30,
  maritalStatus: "NEVER_MARRIED",
  country: "Nigeria",
  region: "Lagos",
  self: everyAnswer(),
  seek: acceptAll(),
  filters: openFilters,
  waitingSince: new Date("2026-01-01"),
  ...over,
});
const man = (o: Partial<Candidate> = {}) => cand({ gender: "MALE", ...o });
const woman = (o: Partial<Candidate> = {}) => cand({ gender: "FEMALE", ...o });

/** A seek map where everything is open except the listed questions. */
const strict = (rules: Record<string, { accept: string[]; level: Level }>) => ({ ...acceptAll(), ...rules });

describe("questionnaire", () => {
  it("is well formed", () => {
    expect(new Set(QUESTIONS.map((q) => q.key)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(q.options.map((o) => o.value)).size).toBe(q.options.length);
      expect(CATEGORIES.some((c) => c.key === q.category)).toBe(true);
      expect(q.weight).toBeGreaterThan(0);
    }
  });

  it("keeps physical questions light: never non-negotiable, and worth less", () => {
    const personal = QUESTIONS.filter((q) => q.category === "personal");
    expect(personal.length).toBeGreaterThan(0);
    for (const q of personal) {
      expect(q.allowNonNegotiable).toBe(false);
      expect(q.weight).toBeLessThan(1);
    }
  });
});

describe("form validation", () => {
  const good = () => ({
    self: everyAnswer(),
    seek: acceptAll(),
    filters: { ageMin: 25, ageMax: 40, maritalStatuses: ["NEVER_MARRIED"], locationScope: "ANYWHERE" },
  });
  const opts: { maxNonNegotiable: number; profile: { country?: string | null; region?: string | null } } = { maxNonNegotiable: 3, profile: { country: "Nigeria", region: "Lagos" } };
  const errorsOf = (body: unknown, o = opts) => {
    const r = validateSubmission(body, o);
    return r.ok ? null : r.errors;
  };

  it("accepts a complete form", () => expect(validateSubmission(good(), opts).ok).toBe(true));

  it("reports every unanswered question at once", () => {
    const e = errorsOf({ self: {}, seek: {}, filters: good().filters })!;
    expect(Object.keys(e)).toHaveLength(QUESTIONS.length);
  });

  it("rejects an answer that is not one of the options, in either column", () => {
    const body = good();
    body.self.prayer = "made_up";
    (body.seek.quran as any).accept = ["made_up"];
    const e = errorsOf(body)!;
    expect(e.prayer).toBeDefined();
    expect(e.quran).toBeDefined();
  });

  it("requires a firmness level, and rejects an empty acceptable set", () => {
    const body: any = good();
    body.seek.prayer.level = "VERY";
    body.seek.quran.accept = [];
    const e = errorsOf(body)!;
    expect(e.prayer).toMatch(/how firmly/);
    expect(e.quran).toMatch(/at least one/);
  });

  it("refuses a non-negotiable on a personal question", () => {
    const body: any = good();
    body.seek.appearance_importance.level = "NON_NEGOTIABLE";
    expect(errorsOf(body)!.appearance_importance).toMatch(/cannot be a non-negotiable/);
  });

  it("caps how many things can be non-negotiable", () => {
    const body: any = good();
    for (const k of ["prayer", "quran", "wants_children", "living"]) body.seek[k].level = "NON_NEGOTIABLE";
    expect(errorsOf(body)!.form).toMatch(/at most 3/);
    body.seek.living.level = "PREFERENCE";
    expect(errorsOf(body)).toBeNull();
  });

  it("validates the hard filters", () => {
    const withFilters = (filters: object) => errorsOf({ ...good(), filters })?.filters;
    expect(withFilters({ ...good().filters, ageMin: 17 })).toMatch(/age range/);
    expect(withFilters({ ...good().filters, ageMin: 40, ageMax: 30 })).toMatch(/age range/);
    expect(withFilters({ ...good().filters, ageMax: 101 })).toMatch(/age range/);
    expect(withFilters({ ...good().filters, ageMin: 20.5 })).toMatch(/age range/);
    expect(withFilters({ ...good().filters, maritalStatuses: [] })).toMatch(/marital status/);
    expect(withFilters({ ...good().filters, maritalStatuses: ["MARRIED"] })).toMatch(/marital status/);
    expect(withFilters({ ...good().filters, locationScope: "MOON" })).toMatch(/where your spouse/);
  });

  it("only offers a location filter the person's own profile can support", () => {
    const f = (locationScope: string) => ({ ...good(), filters: { ...good().filters, locationScope } });
    expect(errorsOf(f("SAME_COUNTRY"), { ...opts, profile: {} })!.filters).toMatch(/country/);
    expect(errorsOf(f("SAME_REGION"), { ...opts, profile: { country: "Nigeria" } })!.filters).toMatch(/region/);
    expect(errorsOf(f("SAME_REGION"))).toBeNull();
  });

  it("copes with junk input without throwing", () => {
    for (const junk of [null, undefined, 5, "x", [], { self: "no", seek: 7, filters: [] }]) {
      expect(() => validateSubmission(junk, opts)).not.toThrow();
      expect(validateSubmission(junk, opts).ok).toBe(false);
    }
  });

  it("removes duplicates and trims notes", () => {
    const body: any = good();
    body.seek.prayer = { accept: ["five_daily", "five_daily", "most_days"], level: "PREFERENCE", note: "  hello  " };
    const r = validateSubmission(body, opts);
    expect(r.ok && r.value.seek.prayer).toEqual({ accept: ["five_daily", "most_days"], level: "PREFERENCE", note: "hello" });
  });
});

describe("hard filters", () => {
  it("age limits are inclusive", () => {
    const seeker = man({ filters: { ...openFilters, ageMin: 25, ageMax: 35 } });
    expect(passesFilters(seeker, woman({ age: 25 }))).toBeNull();
    expect(passesFilters(seeker, woman({ age: 35 }))).toBeNull();
    expect(passesFilters(seeker, woman({ age: 24 }))).toBe("FILTER_AGE");
    expect(passesFilters(seeker, woman({ age: 36 }))).toBe("FILTER_AGE");
  });

  it("marital status must be on the accepted list", () => {
    const seeker = man({ filters: { ...openFilters, maritalStatuses: ["NEVER_MARRIED"] } });
    expect(passesFilters(seeker, woman({ maritalStatus: "DIVORCED" }))).toBe("FILTER_MARITAL_STATUS");
    expect(passesFilters(seeker, woman({ maritalStatus: "NEVER_MARRIED" }))).toBeNull();
  });

  it("location filters compare country and region, ignoring case and spacing", () => {
    const country = man({ filters: { ...openFilters, locationScope: "SAME_COUNTRY" } });
    expect(passesFilters(country, woman({ country: " nigeria " }))).toBeNull();
    expect(passesFilters(country, woman({ country: "Ghana" }))).toBe("FILTER_LOCATION");
    expect(passesFilters(country, woman({ country: null }))).toBe("FILTER_LOCATION");
    expect(passesFilters(man({ country: null, filters: country.filters }), woman())).toBe("FILTER_LOCATION");

    const region = man({ filters: { ...openFilters, locationScope: "SAME_REGION" } });
    expect(passesFilters(region, woman({ region: "LAGOS" }))).toBeNull();
    expect(passesFilters(region, woman({ region: "Kano" }))).toBe("FILTER_LOCATION");
    expect(passesFilters(region, woman({ region: "Lagos", country: "Ghana" }))).toBe("FILTER_LOCATION");
    expect(passesFilters(region, woman({ region: null }))).toBe("FILTER_LOCATION");
  });
});

describe("non-negotiables", () => {
  it("only questions marked non-negotiable can rule someone out", () => {
    const seeker = man({ seek: strict({ prayer: { accept: ["five_daily"], level: "PREFERENCE" }, quran: { accept: ["regular_study"], level: "FLEXIBLE" } }) });
    const other = woman({ self: everyAnswer(() => 3) });
    expect(brokenNonNegotiables(seeker, other)).toEqual([]);
  });

  it("reports exactly the ones that are broken", () => {
    const seeker = man({ seek: strict({ prayer: { accept: ["five_daily"], level: "NON_NEGOTIABLE" }, wants_children: { accept: ["yes"], level: "NON_NEGOTIABLE" } }) });
    const other = woman({ self: { ...everyAnswer(), prayer: "rarely", wants_children: "yes" } });
    expect(brokenNonNegotiables(seeker, other)).toEqual(["prayer"]);
  });
});

describe("scoring", () => {
  it("is 1 when everything asked for is on offer, and falls with each mismatch", () => {
    const other = woman();
    expect(directionalScore(man(), other)).toBe(1);
    const picky = man({ seek: strict({ prayer: { accept: ["rarely"], level: "PREFERENCE" } }) });
    expect(directionalScore(picky, other)).toBeLessThan(1);
    expect(directionalScore(picky, other)).toBeGreaterThan(0.9);
  });

  it("counts firm preferences more than flexible ones", () => {
    const other = woman();
    const firm = man({ seek: strict({ prayer: { accept: ["rarely"], level: "PREFERENCE" } }) });
    const flexible = man({ seek: strict({ prayer: { accept: ["rarely"], level: "FLEXIBLE" } }) });
    expect(directionalScore(flexible, other)).toBeGreaterThan(directionalScore(firm, other));
  });

  it("counts a bigger question for more than a smaller one", () => {
    const other = woman();
    const kids = man({ seek: strict({ wants_children: { accept: ["no"], level: "PREFERENCE" } }) });
    const prayer = man({ seek: strict({ prayer: { accept: ["rarely"], level: "PREFERENCE" } }) });
    expect(directionalScore(kids, other)).toBeLessThan(directionalScore(prayer, other));
  });

  it("gives the same score from either side", () => {
    const a = man({ seek: strict({ prayer: { accept: ["rarely"], level: "PREFERENCE" } }) });
    const b = woman({ self: everyAnswer(() => 1), seek: strict({ quran: { accept: ["beginning"], level: "PREFERENCE" } }) });
    const ab = evaluatePair(a, b);
    const ba = evaluatePair(b, a);
    expect(ab).toEqual(ba);
  });
});

describe("a single pair", () => {
  it("never pairs two men or two women", () => {
    expect(evaluatePair(man(), man())).toEqual({ ok: false, reason: "SAME_GENDER" });
    expect(evaluatePair(woman(), woman())).toEqual({ ok: false, reason: "SAME_GENDER" });
  });

  it("applies each person's filters, not just one side's", () => {
    const a = man();
    const b = woman({ filters: { ...openFilters, ageMax: 25 } }); // she wants someone 25 or under; he is 30
    expect(evaluatePair(a, b)).toEqual({ ok: false, reason: "FILTER_AGE" });
    expect(evaluatePair(b, a)).toEqual({ ok: false, reason: "FILTER_AGE" });
  });

  it("applies each person's non-negotiables, not just one side's", () => {
    const a = man();
    const b = woman({ seek: strict({ prayer: { accept: ["rarely"], level: "NON_NEGOTIABLE" } }) });
    expect(evaluatePair(a, b)).toEqual({ ok: false, reason: "NON_NEGOTIABLE" });
  });
});

describe("planning a round", () => {
  const notExcluded = { isExcluded: () => false, minScore: 0 };

  it("pairs people who fit, and never the same person twice", () => {
    const people = [man(), man(), man(), woman(), woman()];
    const plan = planRound(people, notExcluded);
    expect(plan.pairs).toHaveLength(2);
    const ids = plan.pairs.flatMap((p) => [p.a, p.b]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.stats.unmatched).toBe(1);
  });

  it("gives the best-fitting pair priority over a worse one", () => {
    const m1 = man({ self: everyAnswer(() => 0) });
    const w1 = woman({ self: everyAnswer(() => 0), seek: strict({ prayer: { accept: ["five_daily"], level: "PREFERENCE" } }) });
    const w2 = woman({ self: everyAnswer(() => 1), seek: strict({ prayer: { accept: ["five_daily"], level: "PREFERENCE" } }) });
    const m2 = man({ self: everyAnswer(() => 1), seek: strict({ prayer: { accept: ["rarely"], level: "PREFERENCE" } }) });
    const plan = planRound([m1, w2, w1, m2], notExcluded);
    const partner = (id: string) => plan.pairs.find((p) => p.a === id || p.b === id);
    // m1 (five_daily) goes with w1 (who wants five_daily), not with w2 (who offers most_days)
    expect([partner(m1.userId)!.a, partner(m1.userId)!.b]).toContain(w1.userId);
  });

  it("never pairs people who were closed or excluded, however well they fit", () => {
    const m = man();
    const w = woman();
    const plan = planRound([m, w], { isExcluded: (a, b) => pairKey(a, b) === pairKey(m.userId, w.userId), minScore: 0 });
    expect(plan.pairs).toEqual([]);
    expect(plan.stats.excluded).toBe(1);
  });

  it("applies the minimum score", () => {
    const m = man({ seek: strict({ prayer: { accept: ["rarely"], level: "PREFERENCE" }, wants_children: { accept: ["no"], level: "PREFERENCE" }, living: { accept: ["flexible"], level: "PREFERENCE" } }) });
    const w = woman({ seek: strict({ prayer: { accept: ["rarely"], level: "PREFERENCE" }, wants_children: { accept: ["no"], level: "PREFERENCE" }, living: { accept: ["flexible"], level: "PREFERENCE" } }) });
    expect(planRound([m, w], { isExcluded: () => false, minScore: 0 }).pairs).toHaveLength(1);
    const strictPlan = planRound([m, w], { isExcluded: () => false, minScore: 0.99 });
    expect(strictPlan.pairs).toEqual([]);
    expect(strictPlan.stats.belowMinimumScore).toBe(1);
  });

  it("breaks ties in favour of whoever has waited longest", () => {
    const old = man({ waitingSince: new Date("2026-01-01") });
    const recent = man({ waitingSince: new Date("2026-06-01") });
    const w = woman({ waitingSince: new Date("2026-03-01") });
    const plan = planRound([recent, w, old], notExcluded);
    expect([plan.pairs[0].a, plan.pairs[0].b]).toContain(old.userId);
  });

  it("gives the same pairs whatever order people are listed in", () => {
    const people = Array.from({ length: 12 }, (_, i) =>
      cand({ gender: i % 2 ? "MALE" : "FEMALE", self: everyAnswer((k) => (k + i) % 3), seek: strict({ prayer: { accept: ["five_daily", "most_days"], level: "PREFERENCE" } }) }),
    );
    const forward = planRound(people, notExcluded).pairs;
    const reversed = planRound([...people].reverse(), notExcluded).pairs;
    expect(reversed).toEqual(forward);
  });

  it("counts why pairs were rejected", () => {
    const plan = planRound([man(), man(), woman({ age: 17 })], { isExcluded: () => false, minScore: 0 });
    expect(plan.stats.rejected.SAME_GENDER).toBe(1);
    expect(plan.stats.rejected.FILTER_AGE).toBe(2);
  });

  it("holds up on a large random pool: every rule respected, nobody twice, nobody left that could be paired", () => {
    let state = 12345;
    const rand = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
    const levels: Level[] = ["NON_NEGOTIABLE", "PREFERENCE", "FLEXIBLE"];

    const people: Candidate[] = Array.from({ length: 70 }, (_, i) => {
      const self = Object.fromEntries(QUESTIONS.map((q) => [q.key, pick(q.options).value]));
      const seek = Object.fromEntries(
        QUESTIONS.map((q) => {
          const accept = q.options.filter(() => rand() < 0.7).map((o) => o.value);
          const level = !q.allowNonNegotiable ? pick(["PREFERENCE", "FLEXIBLE"] as Level[]) : rand() < 0.1 ? "NON_NEGOTIABLE" : pick(levels.slice(1));
          return [q.key, { accept: accept.length ? accept : [q.options[0].value], level }];
        }),
      );
      return cand({
        gender: i % 2 ? "MALE" : "FEMALE",
        age: 21 + Math.floor(rand() * 25),
        maritalStatus: pick(["NEVER_MARRIED", "DIVORCED", "WIDOWED"]),
        country: pick(["Nigeria", "Ghana"]),
        region: pick(["Lagos", "Kano", "Accra"]),
        self,
        seek,
        filters: { ageMin: 21, ageMax: 20 + Math.floor(rand() * 30) + 6, maritalStatuses: rand() < 0.5 ? ["NEVER_MARRIED"] : ["NEVER_MARRIED", "DIVORCED", "WIDOWED"], locationScope: pick(["ANYWHERE", "SAME_COUNTRY", "SAME_REGION"] as const) },
        waitingSince: new Date(2026, 0, 1 + Math.floor(rand() * 200)),
      });
    });
    const blocked = new Set<string>();
    for (let k = 0; k < 40; k++) blocked.add(pairKey(pick(people).userId, pick(people).userId));
    const isExcluded = (a: string, b: string) => blocked.has(pairKey(a, b));
    const minScore = 0.6;

    const plan = planRound(people, { isExcluded, minScore });
    const byId = new Map(people.map((p) => [p.userId, p]));
    expect(plan.pairs.length).toBeGreaterThan(5);

    const used = new Set<string>();
    for (const p of plan.pairs) {
      expect(used.has(p.a) || used.has(p.b)).toBe(false);
      used.add(p.a);
      used.add(p.b);
      const a = byId.get(p.a)!;
      const b = byId.get(p.b)!;
      expect(a.gender).not.toBe(b.gender);
      expect(isExcluded(p.a, p.b)).toBe(false);
      expect(passesFilters(a, b)).toBeNull();
      expect(passesFilters(b, a)).toBeNull();
      expect(brokenNonNegotiables(a, b)).toEqual([]);
      expect(brokenNonNegotiables(b, a)).toEqual([]);
      expect(p.score).toBeGreaterThanOrEqual(minScore);
    }
    // Nothing left on the table: no two unpaired people who could have been paired
    const free = people.filter((p) => !used.has(p.userId));
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const r = evaluatePair(free[i], free[j]);
        const couldPair = !isExcluded(free[i].userId, free[j].userId) && r.ok && r.score >= minScore;
        expect(couldPair).toBe(false);
      }
    }
    expect(plan.stats.unmatched).toBe(free.length);
  });
});
