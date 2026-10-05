/**
 * The spouse questionnaire (PRD section 16). Every question is asked two ways:
 *   about you        -> your own answer, which other people are compared against
 *   what you seek    -> which answers you would accept in a spouse, and how firmly
 *
 * IMPORTANT: the wording and options below are SAMPLE content so the engine can run end to end.
 * Have them reviewed and replace them with your own. Changing a question's key or options
 * means raising QUESTIONNAIRE_VERSION.
 */
export const QUESTIONNAIRE_VERSION = 1;

export type CategoryKey = "religion" | "marriage" | "children" | "finance" | "family" | "lifestyle" | "personal";

export const CATEGORIES: { key: CategoryKey; title: string; intro: string }[] = [
  { key: "religion", title: "Religion", intro: "How faith shapes your life and the home you want to build." },
  { key: "marriage", title: "Marriage", intro: "How you picture day-to-day life as a married couple." },
  { key: "children", title: "Children", intro: "Whether, when and how you hope to raise a family." },
  { key: "finance", title: "Money", intro: "How you expect to earn, save and spend together." },
  { key: "family", title: "Family and home", intro: "Where you will live and how close the wider family will be." },
  { key: "lifestyle", title: "Lifestyle", intro: "Ambition, social life, travel and timing." },
  { key: "personal", title: "Personal", intro: "Deliberately last, and deliberately light. These can never be non-negotiable." },
];

export interface Option {
  value: string;
  label: string;
}

export interface Question {
  key: string;
  category: CategoryKey;
  /** About you */
  prompt: string;
  /** What you seek */
  seekPrompt: string;
  options: Option[];
  /** How much this question counts in scoring, relative to others. */
  weight: number;
  /** False for questions that must never rule someone out (PRD: think beyond physique). */
  allowNonNegotiable: boolean;
}

const q = (
  key: string,
  category: CategoryKey,
  prompt: string,
  options: [string, string][],
  extra: Partial<Pick<Question, "weight" | "allowNonNegotiable" | "seekPrompt">> = {},
): Question => ({
  key,
  category,
  prompt,
  seekPrompt: extra.seekPrompt ?? "Which of these would you be comfortable with in a spouse?",
  options: options.map(([value, label]) => ({ value, label })),
  weight: extra.weight ?? 1,
  allowNonNegotiable: extra.allowNonNegotiable ?? true,
});

export const QUESTIONS: Question[] = [
  // Religion
  q("prayer", "religion", "How would you describe your prayer?", [
    ["five_daily", "I pray all five daily prayers"],
    ["most_days", "I pray most days"],
    ["building", "I am working on becoming regular"],
    ["rarely", "I rarely pray"],
  ]),
  q("quran", "religion", "Your relationship with the Qur'an", [
    ["regular_study", "I study it regularly"],
    ["daily_recitation", "I recite it most days"],
    ["occasional", "I read it occasionally"],
    ["beginning", "I am just beginning"],
  ]),
  q("religious_home", "religion", "The religious atmosphere you want at home", [
    ["very_observant", "Very observant"],
    ["observant", "Observant"],
    ["moderate", "Moderate"],
    ["relaxed", "Relaxed"],
  ]),
  q("religious_growth", "religion", "Growing in faith together", [
    ["priority", "A priority for me"],
    ["welcome", "I would welcome it"],
    ["independent", "I prefer to grow independently"],
  ]),

  // Marriage
  q("decision_making", "marriage", "How should major decisions be made?", [
    ["joint", "Jointly, by agreement"],
    ["consult_then_decide", "After consultation, with one person having the final say"],
    ["by_area", "Divided by area, each leading their own"],
  ]),
  q("household", "marriage", "Household responsibilities", [
    ["shared", "Shared fairly between us"],
    ["traditional", "A traditional division of roles"],
    ["flexible", "Flexible, depending on our circumstances"],
    ["paid_help", "With paid help where we can"],
  ]),
  q("conflict_style", "marriage", "When we disagree, I prefer to", [
    ["talk_now", "Talk it through straight away"],
    ["cool_off", "Cool off first, then talk"],
    ["involve_elders", "Involve family elders early"],
    ["third_party", "Seek counsel from a trusted third party"],
  ]),
  q("privacy", "marriage", "Privacy in marriage (phones, social media, friendships)", [
    ["open", "Largely open with each other"],
    ["some_private", "Some private space is healthy"],
    ["very_private", "I value a great deal of privacy"],
  ]),

  // Children
  q("wants_children", "children", "Do you want children?", [
    ["yes", "Yes"],
    ["open", "I am open"],
    ["no", "No"],
  ], { weight: 1.5 }),
  q("number_children", "children", "How many children do you hope for?", [
    ["one_two", "One or two"],
    ["three_four", "Three or four"],
    ["five_plus", "Five or more"],
    ["no_preference", "No preference"],
  ]),
  q("childcare", "children", "Caring for young children", [
    ["one_at_home", "One parent stays home"],
    ["shared", "Shared between us"],
    ["family_help", "With family's help"],
    ["external", "A nursery or childminder"],
  ]),
  q("islamic_schooling", "children", "Islamic education for children", [
    ["full_time", "A full-time Islamic school"],
    ["part_time", "Weekend or evening classes alongside mainstream school"],
    ["at_home", "Taught at home"],
    ["flexible", "No strong view"],
  ]),

  // Money
  q("work_after_marriage", "finance", "Work after marriage", [
    ["both_work", "Both of us work"],
    ["one_provides", "One of us provides and the other may choose to work"],
    ["flexible", "It depends on circumstances"],
  ]),
  q("money_management", "finance", "Managing money together", [
    ["joint", "A joint pot"],
    ["separate_shared_costs", "Separate, with agreed shared costs"],
    ["proportional", "Proportional contributions"],
  ]),
  q("debt", "finance", "Attitude to debt", [
    ["avoid_all", "Avoid all debt"],
    ["home_loan_only", "A home loan only"],
    ["manageable", "Manageable debt is fine"],
  ]),
  q("spending", "finance", "Spending and saving", [
    ["saver", "I save first"],
    ["balanced", "I balance the two"],
    ["spender", "I spend more freely"],
  ]),

  // Family and home
  q("living", "family", "Where would you like to live after marriage?", [
    ["own_home", "Our own home"],
    ["with_husbands_family", "With the husband's family"],
    ["with_wifes_family", "With the wife's family"],
    ["flexible", "Flexible"],
  ]),
  q("in_laws", "family", "Involvement of in-laws", [
    ["close", "Close and involved"],
    ["regular", "Regular contact"],
    ["limited", "Limited, with clear boundaries"],
  ]),
  q("relocation", "family", "Willingness to relocate", [
    ["anywhere", "Anywhere, including abroad"],
    ["within_country", "Within my country"],
    ["discuss", "Open to discussing it"],
    ["no", "I would not relocate"],
  ]),

  // Lifestyle
  q("career", "lifestyle", "Career and ambition", [
    ["career_focused", "My career is a major priority"],
    ["balanced", "Balanced with family life"],
    ["family_first", "Family comes first"],
  ]),
  q("social_life", "lifestyle", "Social life", [
    ["very_social", "Very social"],
    ["balanced", "Balanced"],
    ["quiet", "Quiet and home-centred"],
  ]),
  q("travel", "lifestyle", "Travel", [
    ["love_travel", "I love to travel"],
    ["occasional", "Occasionally"],
    ["rarely", "Rarely"],
  ]),
  q("timeline", "lifestyle", "How soon do you hope to marry?", [
    ["six_months", "Within six months"],
    ["one_year", "Within a year"],
    ["two_years", "Within two years"],
    ["no_rush", "No fixed timeline"],
  ]),

  // Personal: light by design
  q("appearance_importance", "personal", "How much does physical appearance matter in your choice?", [
    ["very", "Very much"],
    ["somewhat", "Somewhat"],
    ["little", "Very little"],
  ], { weight: 0.5, allowNonNegotiable: false }),
  q("fitness", "personal", "Fitness and activity", [
    ["very_active", "Very active"],
    ["moderate", "Moderately active"],
    ["not_priority", "Not a priority"],
  ], { weight: 0.5, allowNonNegotiable: false }),
];

export const QUESTION_BY_KEY = new Map(QUESTIONS.map((x) => [x.key, x]));

export const LEVELS = ["NON_NEGOTIABLE", "PREFERENCE", "FLEXIBLE"] as const;
export type Level = (typeof LEVELS)[number];

export const LOCATION_SCOPES = ["ANYWHERE", "SAME_COUNTRY", "SAME_REGION"] as const;
export type LocationScope = (typeof LOCATION_SCOPES)[number];
export const MARITAL_STATUSES = ["NEVER_MARRIED", "DIVORCED", "WIDOWED"] as const;

export interface Filters {
  ageMin: number;
  ageMax: number;
  maritalStatuses: string[];
  locationScope: LocationScope;
}

export interface Submission {
  self: Record<string, string>;
  seek: Record<string, { accept: string[]; level: Level; note?: string }>;
  filters: Filters;
}

export const MIN_AGE = 18;
export const MAX_AGE = 100;

/**
 * Checks a submitted form completely, on the server. Returns every problem at once, keyed by
 * question (or by "filters" / "form"), so the person can fix them in one go.
 */
export function validateSubmission(
  raw: unknown,
  opts: { maxNonNegotiable: number; profile: { country?: string | null; region?: string | null } },
): { ok: true; value: Submission } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const self = (body.self && typeof body.self === "object" ? body.self : {}) as Record<string, unknown>;
  const seek = (body.seek && typeof body.seek === "object" ? body.seek : {}) as Record<string, any>;

  const clean: Submission = { self: {}, seek: {}, filters: { ageMin: 0, ageMax: 0, maritalStatuses: [], locationScope: "ANYWHERE" } };
  let nonNegotiables = 0;

  for (const question of QUESTIONS) {
    const values = new Set(question.options.map((o) => o.value));

    const mine = self[question.key];
    if (typeof mine !== "string" || !values.has(mine)) errors[question.key] = "Choose the answer that describes you.";
    else clean.self[question.key] = mine;

    const s = seek[question.key];
    const accept = Array.isArray(s?.accept) ? [...new Set(s.accept as unknown[])] : [];
    const level = s?.level;
    if (accept.length === 0 || !accept.every((a) => typeof a === "string" && values.has(a))) {
      errors[question.key] ??= "Choose at least one answer you would accept in a spouse.";
    } else if (!LEVELS.includes(level)) {
      errors[question.key] ??= "Say how firmly you feel about this.";
    } else if (level === "NON_NEGOTIABLE" && !question.allowNonNegotiable) {
      errors[question.key] ??= "This cannot be a non-negotiable. It can only be a preference or flexible.";
    } else {
      if (level === "NON_NEGOTIABLE") nonNegotiables++;
      const note = typeof s.note === "string" ? s.note.trim().slice(0, 500) : "";
      clean.seek[question.key] = { accept: accept as string[], level, ...(note ? { note } : {}) };
    }
  }

  if (nonNegotiables > opts.maxNonNegotiable) {
    errors.form = `You can mark at most ${opts.maxNonNegotiable} things as non-negotiable. You marked ${nonNegotiables}. Keep these for what you truly cannot live without.`;
  }

  // Hard filters (PRD section 18)
  const f = (body.filters && typeof body.filters === "object" ? body.filters : {}) as Record<string, any>;
  const ageMin = Number(f.ageMin);
  const ageMax = Number(f.ageMax);
  const statuses = Array.isArray(f.maritalStatuses) ? [...new Set(f.maritalStatuses as unknown[])] : [];
  if (!Number.isInteger(ageMin) || !Number.isInteger(ageMax) || ageMin < MIN_AGE || ageMax > MAX_AGE || ageMin > ageMax) {
    errors.filters = `Enter an age range between ${MIN_AGE} and ${MAX_AGE}.`;
  } else if (statuses.length === 0 || !statuses.every((m) => (MARITAL_STATUSES as readonly unknown[]).includes(m))) {
    errors.filters = "Choose at least one marital status you would accept.";
  } else if (!LOCATION_SCOPES.includes(f.locationScope)) {
    errors.filters = "Choose where your spouse should live.";
  } else if (f.locationScope === "SAME_COUNTRY" && !opts.profile.country?.trim()) {
    errors.filters = "Add your country to your profile first, so we can apply this filter.";
  } else if (f.locationScope === "SAME_REGION" && !(opts.profile.country?.trim() && opts.profile.region?.trim())) {
    errors.filters = "Add your country and region to your profile first, so we can apply this filter.";
  } else {
    clean.filters = { ageMin, ageMax, maritalStatuses: statuses as string[], locationScope: f.locationScope };
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: clean };
}
