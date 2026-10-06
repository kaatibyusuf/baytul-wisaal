import {
  COMPAT_DEFAULTS,
  CompatSettings,
  ResolvedItem,
  classify,
  evaluateCompatibility,
  validateExpectations,
  validateResponses,
} from "../src/postmatch/rules";

const S: CompatSettings = { ...COMPAT_DEFAULTS };
const item = (over: object = {}) => ({ category: "religion", statement: "I want us to pray together daily", level: "PREFERENCE", ...over });
const many = (n: number) => Array.from({ length: n }, (_, i) => item({ statement: `Expectation number ${i} about our life together` }));
const opts = (final = true, maxNonNegotiable = 3) => ({ final, maxNonNegotiable, settings: S });
const errs = (raw: unknown, final = true) => {
  const r = validateExpectations(raw, opts(final));
  return r.ok ? null : r.errors;
};

describe("expectation form", () => {
  it("accepts a complete form and trims text", () => {
    const r = validateExpectations([...many(4), item({ statement: "  I want to live separately from both families  ", compromiseNote: "  could start with one  " })], opts());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items[4].statement).toBe("I want to live separately from both families");
      expect(r.items[4].compromiseNote).toBe("could start with one");
    }
  });

  it("needs a minimum number to submit, but a draft can be shorter", () => {
    expect(errs(many(3))!.form).toMatch(/at least 5/);
    expect(errs(many(3), false)).toBeNull();
    expect(errs([], false)).toBeNull();
  });

  it("caps the total, and says exactly which expectation has a problem", () => {
    expect(errs(many(26))!.form).toMatch(/at most 25/);
    const e = errs([...many(5), item({ statement: "no" }), item({ category: "made_up" }), item({ level: "VERY" }), item({ statement: "" })])!;
    expect(e.item5).toMatch(/a little more/);
    expect(e.item6).toMatch(/category/);
    expect(e.item7).toMatch(/how firmly/);
    expect(e.item8).toMatch(/what you are seeking/);
  });

  it("limits non-negotiables", () => {
    const four = many(5).map((x, i) => (i < 4 ? { ...x, level: "NON_NEGOTIABLE" } : x));
    expect(errs(four)!.form).toMatch(/at most 3/);
    four[3] = { ...four[3], level: "PREFERENCE" };
    expect(errs(four)).toBeNull();
  });

  it("keeps physical preferences small and never non-negotiable", () => {
    const physical = item({ category: "physical", statement: "I would like us both to stay active" });
    expect(errs([...many(5), { ...physical, level: "NON_NEGOTIABLE" }])!.item5).toMatch(/cannot be non-negotiable/);
    const three = [1, 2, 3].map((n) => ({ ...physical, statement: `Physical preference number ${n} for us` }));
    expect(errs([...many(5), ...three])!.form).toMatch(/limited to 2/);
    expect(errs([...many(5), ...three.slice(0, 2)])).toBeNull();
  });

  it("rejects the same expectation written twice, however it is punctuated", () => {
    const e = errs([item(), ...many(4), item({ statement: "I want us to pray together, daily!" })])!;
    expect(e.item5).toMatch(/already written/);
  });

  it("copes with junk", () => {
    for (const junk of [null, undefined, 5, "x", {}, [null, 5, "x"], [{}]]) {
      expect(() => validateExpectations(junk, opts())).not.toThrow();
      expect(validateExpectations(junk, opts()).ok).toBe(false);
    }
  });
});

describe("responses", () => {
  const ids = ["a", "b", "c"];
  const explain = "I feel this way because of how I was raised and what I hope for";
  const check = (raw: unknown, final = true) => {
    const r = validateResponses(raw, { final, itemIds: ids, settings: S });
    return r.ok ? null : r.errors;
  };
  const full = () => ids.map((itemId) => ({ itemId, type: "AGREE", explanation: explain }));

  it("accepts a full set", () => expect(check(full())).toBeNull());

  it("requires every expectation to be answered before submitting, but a draft can be partial", () => {
    expect(check(full().slice(0, 2))!.c).toMatch(/respond to this/);
    expect(check(full().slice(0, 1), false)).toBeNull();
  });

  it("will not accept a bare yes: agreement needs an explanation too", () => {
    const e = check([{ itemId: "a", type: "AGREE", explanation: "yes" }, ...full().slice(1)])!;
    expect(e.a).toMatch(/at least 8 words/);
  });

  it("rejects stock phrases passed off as an explanation", () => {
    const e = check([{ itemId: "a", type: "DISAGREE", explanation: "It depends. Both sides are important. I would pray about it." }, ...full().slice(1)])!;
    expect(e.a).toMatch(/not just a stock phrase/);
  });

  it("does not need an explanation for not applicable", () => {
    expect(check([{ itemId: "a", type: "NOT_APPLICABLE", explanation: "" }, ...full().slice(1)])).toBeNull();
  });

  it("rejects unknown types, items from elsewhere, and oversized text", () => {
    expect(check([{ itemId: "a", type: "MAYBE", explanation: explain }, ...full().slice(1)])!.a).toMatch(/Choose/);
    expect(check([{ itemId: "zzz", type: "AGREE", explanation: explain }, ...full()])!.form).toMatch(/not for this match/);
    expect(check([{ itemId: "a", type: "AGREE", explanation: "x ".repeat(600) }, ...full().slice(1)])!.a).toMatch(/under 1000/);
  });
});

describe("classification", () => {
  it("agreeing is aligned, and so is not applicable", () => {
    expect(classify("NON_NEGOTIABLE", "AGREE")).toBe("ALIGNED");
    expect(classify("PREFERENCE", "NOT_APPLICABLE")).toBe("ALIGNED");
  });
  it("partly agreeing or being willing to talk is something to discuss, at any firmness", () => {
    for (const level of ["NON_NEGOTIABLE", "PREFERENCE", "FLEXIBLE"] as const) {
      expect(classify(level, "PARTIALLY_AGREE")).toBe("NEEDS_DISCUSSION");
      expect(classify(level, "WILLING_TO_DISCUSS")).toBe("NEEDS_DISCUSSION");
    }
  });
  it("only disagreeing with a non-negotiable is a conflict", () => {
    expect(classify("NON_NEGOTIABLE", "DISAGREE")).toBe("CONFLICT");
    expect(classify("PREFERENCE", "DISAGREE")).toBe("NEEDS_DISCUSSION");
    expect(classify("FLEXIBLE", "DISAGREE")).toBe("NEEDS_DISCUSSION");
  });
});

describe("compatibility of a pairing", () => {
  const r = (i: number, level: ResolvedItem["level"], type: ResolvedItem["type"], category = "religion", authorId = "A"): ResolvedItem => ({ itemId: `i${i}`, authorId, category, level, type });

  it("meets the requirements when everything is aligned", () => {
    const res = evaluateCompatibility([r(1, "NON_NEGOTIABLE", "AGREE"), r(2, "PREFERENCE", "AGREE", "family", "B")], S);
    expect(res.passed).toBe(true);
    expect(res.reasons).toEqual([]);
    expect(res.counts).toEqual({ aligned: 2, needsDiscussion: 0, conflict: 0, preferenceDisagreements: 0 });
  });

  it("a single conflict, from either person, means it does not", () => {
    const res = evaluateCompatibility([r(1, "PREFERENCE", "AGREE"), r(2, "NON_NEGOTIABLE", "DISAGREE", "family", "B")], S);
    expect(res.passed).toBe(false);
    expect(res.reasons).toEqual(["CONFLICT"]);
  });

  it("a few things to discuss are fine, too many are not", () => {
    const few = Array.from({ length: 10 }, (_, i) => r(i, "PREFERENCE", "WILLING_TO_DISCUSS"));
    expect(evaluateCompatibility(few, S).passed).toBe(true);
    const lots = Array.from({ length: 11 }, (_, i) => r(i, "PREFERENCE", "WILLING_TO_DISCUSS"));
    expect(evaluateCompatibility(lots, S).reasons).toEqual(["TOO_MANY_DISCUSSION_POINTS"]);
  });

  it("disagreeing with several preferences counts as a significant difference", () => {
    const three = Array.from({ length: 3 }, (_, i) => r(i, "PREFERENCE", "DISAGREE"));
    expect(evaluateCompatibility(three, S).passed).toBe(true);
    const four = Array.from({ length: 4 }, (_, i) => r(i, "PREFERENCE", "DISAGREE"));
    expect(evaluateCompatibility(four, S)).toMatchObject({ passed: false, reasons: ["TOO_MANY_PREFERENCE_DISAGREEMENTS"] });
  });

  it("rolls each area up to its worst item, in a fixed order", () => {
    const res = evaluateCompatibility(
      [r(1, "PREFERENCE", "AGREE", "family"), r(2, "PREFERENCE", "PARTIALLY_AGREE", "family"), r(3, "NON_NEGOTIABLE", "DISAGREE", "religion"), r(4, "PREFERENCE", "AGREE", "finance")],
      S,
    );
    expect(res.categories).toEqual([
      { category: "religion", classification: "CONFLICT" },
      { category: "family", classification: "NEEDS_DISCUSSION" },
      { category: "finance", classification: "ALIGNED" },
    ]);
  });

  it("follows the configured thresholds rather than fixed numbers", () => {
    const items = Array.from({ length: 3 }, (_, i) => r(i, "PREFERENCE", "WILLING_TO_DISCUSS"));
    expect(evaluateCompatibility(items, { ...S, maxNeedsDiscussion: 2 }).passed).toBe(false);
    expect(evaluateCompatibility(items, { ...S, maxNeedsDiscussion: 3 }).passed).toBe(true);
  });

  it("is the same whichever order the items arrive in", () => {
    const items = [r(1, "PREFERENCE", "AGREE", "family"), r(2, "NON_NEGOTIABLE", "DISAGREE", "religion"), r(3, "PREFERENCE", "PARTIALLY_AGREE", "finance")];
    const a = evaluateCompatibility(items, S);
    const b = evaluateCompatibility([...items].reverse(), S);
    expect(b.categories).toEqual(a.categories);
    expect(b.counts).toEqual(a.counts);
    expect(b.passed).toBe(a.passed);
  });
});
