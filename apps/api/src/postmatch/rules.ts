/**
 * Post-match rules (PRD sections 21 to 24), kept pure so every decision can be tested and explained.
 *
 *   expectations   each person writes what they are seeking, with how firmly
 *   responses      each person answers every one of the other's expectations, and explains
 *   compatibility  every expectation becomes Aligned, Needs discussion or Conflict,
 *                  and the pairing either meets the configured requirements or does not
 */
import { isVague, wordsIn } from "../assessment/rules";

export const EXPECTATION_CATEGORIES: { key: string; title: string; hint: string; example: string }[] = [
  { key: "religion", title: "Religion", hint: "Practice, learning and the faith of the home.", example: "I want us to pray together and study regularly." },
  { key: "family", title: "Family and in-laws", hint: "Where you live and how involved the family is.", example: "I want to live separately from both families." },
  { key: "finance", title: "Money", hint: "Earning, saving, spending and debt.", example: "I expect us to agree a shared budget before big purchases." },
  { key: "parenting", title: "Children and parenting", hint: "Whether, when and how you raise children.", example: "I want children within the first three years." },
  { key: "career", title: "Work and study", hint: "Careers, ambition and further study.", example: "I want to keep working after we have children." },
  { key: "household", title: "Home life", hint: "Household responsibilities and daily routines.", example: "I expect chores to be shared according to who is free." },
  { key: "personality", title: "Character and communication", hint: "How you treat each other and handle disagreement.", example: "I need us to talk about problems the same day." },
  { key: "lifestyle", title: "Lifestyle", hint: "Social life, travel, health and leisure.", example: "I would like to travel once a year." },
  { key: "physical", title: "Physical", hint: "Kept deliberately small. Never non-negotiable.", example: "I would like us both to stay active." },
];

export const CATEGORY_KEYS = EXPECTATION_CATEGORIES.map((c) => c.key);
export const PHYSICAL = "physical";

export const LEVELS = ["NON_NEGOTIABLE", "PREFERENCE", "FLEXIBLE"] as const;
export type Level = (typeof LEVELS)[number];

export const RESPONSE_TYPES = ["AGREE", "PARTIALLY_AGREE", "WILLING_TO_DISCUSS", "DISAGREE", "NOT_APPLICABLE"] as const;
export type ResponseType = (typeof RESPONSE_TYPES)[number];

export interface CompatSettings {
  minItems: number;
  maxItems: number;
  maxPhysicalItems: number;
  minExplanationWords: number;
  /** More discussion points than this and the pairing does not meet the requirements. */
  maxNeedsDiscussion: number;
  /** Disagreeing with more preferences than this is treated as a significant difference. */
  maxPreferenceDisagreements: number;
  /** 1 = a person looks at any result that did not pass before a pairing is closed. */
  requireReviewOnFail: number;
}

export const COMPAT_DEFAULTS: CompatSettings = {
  minItems: 5,
  maxItems: 25,
  maxPhysicalItems: 2,
  minExplanationWords: 8,
  maxNeedsDiscussion: 10,
  maxPreferenceDisagreements: 3,
  requireReviewOnFail: 1,
};

export const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// ───────────────────────── Expectations ─────────────────────────

export interface ExpectationItemInput {
  category: string;
  statement: string;
  level: Level;
  compromiseNote?: string | null;
}

export const MAX_STATEMENT = 500;
export const MIN_STATEMENT_WORDS = 3;
export const MAX_NOTE = 300;

/**
 * `final` is true when the person presses Submit: then the whole form must be complete.
 * A draft only has to be well formed, so it can be saved part-way.
 */
export function validateExpectations(
  raw: unknown,
  opts: { final: boolean; maxNonNegotiable: number; settings: CompatSettings },
): { ok: true; items: ExpectationItemInput[] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const list = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw)) errors.form = "Send a list of expectations.";

  const items: ExpectationItemInput[] = [];
  const seen = new Set<string>();
  let nonNegotiable = 0;
  let physical = 0;

  list.slice(0, opts.settings.maxItems + 1).forEach((r, i) => {
    const key = `item${i}`;
    const it = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const category = typeof it.category === "string" ? it.category : "";
    const statement = typeof it.statement === "string" ? it.statement.trim() : "";
    const level = it.level as Level;
    const note = typeof it.compromiseNote === "string" ? it.compromiseNote.trim() : "";

    if (!CATEGORY_KEYS.includes(category)) return void (errors[key] = "Choose a category.");
    if (!statement) return void (errors[key] = "Write what you are seeking.");
    if (statement.length > MAX_STATEMENT) return void (errors[key] = `Keep this under ${MAX_STATEMENT} characters.`);
    if (wordsIn(statement) < MIN_STATEMENT_WORDS) return void (errors[key] = "Say a little more, so the other person can respond to it properly.");
    if (!LEVELS.includes(level)) return void (errors[key] = "Say how firmly you feel about this.");
    if (note.length > MAX_NOTE) return void (errors[key] = `Keep the note under ${MAX_NOTE} characters.`);
    if (category === PHYSICAL && level === "NON_NEGOTIABLE") {
      return void (errors[key] = "A physical preference can only be a preference or flexible. It cannot be non-negotiable.");
    }
    const dup = norm(statement);
    if (seen.has(dup)) return void (errors[key] = "You have already written this.");
    seen.add(dup);

    if (level === "NON_NEGOTIABLE") nonNegotiable++;
    if (category === PHYSICAL) physical++;
    items.push({ category, statement, level, compromiseNote: note || null });
  });

  if (list.length > opts.settings.maxItems) errors.form = `You can write at most ${opts.settings.maxItems} expectations. Keep to what matters most.`;
  if (nonNegotiable > opts.maxNonNegotiable) {
    errors.form = `You can mark at most ${opts.maxNonNegotiable} as non-negotiable, and you marked ${nonNegotiable}. Keep these for what you truly cannot live without.`;
  }
  if (physical > opts.settings.maxPhysicalItems) {
    errors.form = `Physical preferences are limited to ${opts.settings.maxPhysicalItems}. We want you to think beyond physique.`;
  }
  if (opts.final && items.length < opts.settings.minItems && !errors.form) {
    errors.form = `Please write at least ${opts.settings.minItems} expectations before you submit. You have written ${items.length}.`;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, items };
}

// ───────────────────────── Responses ─────────────────────────

export interface ResponseInput {
  itemId: string;
  type: ResponseType;
  explanation: string;
}

/** Everything except "not applicable" needs a real explanation, so a quick "yes" can never count as agreement. */
export function validateResponses(
  raw: unknown,
  opts: { final: boolean; itemIds: string[]; settings: CompatSettings },
): { ok: true; responses: ResponseInput[] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const list = Array.isArray(raw) ? raw : [];
  if (!Array.isArray(raw)) errors.form = "Send a list of responses.";

  const known = new Set(opts.itemIds);
  const out = new Map<string, ResponseInput>();
  for (const r of list) {
    const it = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const id = typeof it.itemId === "string" ? it.itemId : "";
    if (!known.has(id)) {
      errors.form = "One of the responses is not for this match.";
      continue;
    }
    const type = it.type as ResponseType;
    const text = typeof it.explanation === "string" ? it.explanation.trim() : "";
    if (!RESPONSE_TYPES.includes(type)) errors[id] = "Choose how you respond.";
    else if (text.length > 1000) errors[id] = "Keep this under 1000 characters.";
    else if (type !== "NOT_APPLICABLE" && opts.final && wordsIn(text) < opts.settings.minExplanationWords) {
      errors[id] = `Please explain your position in at least ${opts.settings.minExplanationWords} words.`;
    } else if (type !== "NOT_APPLICABLE" && opts.final && isVague(text)) {
      errors[id] = "Please explain what you actually mean, not just a stock phrase.";
    } else out.set(id, { itemId: id, type, explanation: text });
  }

  if (opts.final) {
    for (const id of opts.itemIds) if (!out.has(id) && !errors[id]) errors[id] = "Please respond to this.";
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, responses: [...out.values()] };
}

// ───────────────────────── Compatibility ─────────────────────────

export type Classification = "ALIGNED" | "NEEDS_DISCUSSION" | "CONFLICT";

/**
 * One expectation, one response, one classification. Only disagreeing with something the
 * other person called non-negotiable is a conflict. Everything else that is not agreement is
 * something to talk about.
 */
export function classify(level: Level, type: ResponseType): Classification {
  switch (type) {
    case "AGREE":
    case "NOT_APPLICABLE":
      return "ALIGNED";
    case "PARTIALLY_AGREE":
    case "WILLING_TO_DISCUSS":
      return "NEEDS_DISCUSSION";
    case "DISAGREE":
      return level === "NON_NEGOTIABLE" ? "CONFLICT" : "NEEDS_DISCUSSION";
  }
}

export interface ResolvedItem {
  itemId: string;
  authorId: string;
  category: string;
  level: Level;
  type: ResponseType;
}

export type Reason = "CONFLICT" | "TOO_MANY_DISCUSSION_POINTS" | "TOO_MANY_PREFERENCE_DISAGREEMENTS";

export interface CompatibilityResult {
  areas: { itemId: string; authorId: string; category: string; classification: Classification }[];
  categories: { category: string; classification: Classification }[];
  counts: { aligned: number; needsDiscussion: number; conflict: number; preferenceDisagreements: number };
  passed: boolean;
  reasons: Reason[];
}

const WORST: Record<Classification, number> = { ALIGNED: 0, NEEDS_DISCUSSION: 1, CONFLICT: 2 };

/**
 * The pairing is judged, never the people (PRD rule 8). It meets the requirements only when
 * nothing is in conflict and the differences are few enough to talk through.
 */
export function evaluateCompatibility(items: ResolvedItem[], s: CompatSettings): CompatibilityResult {
  const areas = items.map((i) => ({ itemId: i.itemId, authorId: i.authorId, category: i.category, classification: classify(i.level, i.type) }));

  const worst = new Map<string, Classification>();
  for (const a of areas) {
    const cur = worst.get(a.category);
    if (!cur || WORST[a.classification] > WORST[cur]) worst.set(a.category, a.classification);
  }
  const categories = CATEGORY_KEYS.filter((k) => worst.has(k)).map((k) => ({ category: k, classification: worst.get(k)! }));

  const count = (c: Classification) => areas.filter((a) => a.classification === c).length;
  const counts = {
    aligned: count("ALIGNED"),
    needsDiscussion: count("NEEDS_DISCUSSION"),
    conflict: count("CONFLICT"),
    preferenceDisagreements: items.filter((i) => i.level === "PREFERENCE" && i.type === "DISAGREE").length,
  };

  const reasons: Reason[] = [];
  if (counts.conflict > 0) reasons.push("CONFLICT");
  if (counts.needsDiscussion > s.maxNeedsDiscussion) reasons.push("TOO_MANY_DISCUSSION_POINTS");
  if (counts.preferenceDisagreements > s.maxPreferenceDisagreements) reasons.push("TOO_MANY_PREFERENCE_DISAGREEMENTS");
  return { areas, categories, counts, passed: reasons.length === 0, reasons };
}

/** PRD section 24: wording for a pairing that does not move on. It is about the pairing, never a person. */
export const NOT_MET_NOTE = "This pairing did not meet the requirements for the next stage.";
