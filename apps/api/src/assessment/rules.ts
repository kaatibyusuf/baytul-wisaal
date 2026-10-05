/**
 * Pure assessment rules. No database, no network, no clock: everything is passed in, so each
 * rule is testable on its own. The services apply them on the server (PRD rule 14).
 */
import { z } from "zod";

// ───────────────────────── Content shapes ─────────────────────────

export interface RubricCriterion {
  key: string;
  label: string;
  weight: number;
  description?: string;
}

export interface CriticalCriterion {
  key: string;
  label: string;
  description: string;
}

export interface ScenarioPart {
  key: string;
  label: string;
  minWords: number;
}

export type VariableDef =
  | { type: "int"; min: number; max: number; step?: number; format?: "naira" | "plain" }
  | { type: "choice"; options: string[] };

export interface ScenarioBody {
  title: string;
  /** Text with {{placeholders}} filled from `variables`. */
  template: string;
  variables?: Record<string, VariableDef>;
  parts: ScenarioPart[];
  instructions?: string;
}

// ───────────────────────── Scenario variants (PRD section 14) ─────────────────────────

/** Small deterministic generator, so one session always shows the same variant. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const formatNaira = (n: number): string => `₦${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export function renderScenario(body: ScenarioBody, seed: string) {
  const rand = seeded(seed);
  const values: Record<string, string> = {};
  for (const [name, def] of Object.entries(body.variables ?? {})) {
    if (def.type === "choice") {
      values[name] = def.options[Math.floor(rand() * def.options.length)];
    } else {
      const step = def.step ?? 1;
      const steps = Math.floor((def.max - def.min) / step);
      const n = def.min + Math.floor(rand() * (steps + 1)) * step;
      values[name] = def.format === "naira" ? formatNaira(n) : String(n);
    }
  }
  const text = body.template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => {
    if (!(k in values)) throw new Error(`Scenario template uses unknown variable "${k}"`);
    return values[k];
  });
  return { text, values, parts: body.parts, title: body.title, instructions: body.instructions ?? "" };
}

// ───────────────────────── Answer validation (PRD section 8) ─────────────────────────

/** Phrases the PRD says are not acceptable on their own. */
export const VAGUE_PHRASES = [
  "i would communicate",
  "i would pray about it",
  "i would seek advice",
  "it depends",
  "both sides are important",
];

const normalise = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const wordsIn = (t: string): number => (t.trim().match(/\S+/g) ?? []).length;

/** An answer is vague if, once the stock phrases are removed, almost nothing is left. */
export function isVague(text: string): boolean {
  let rest = normalise(text);
  for (const p of VAGUE_PHRASES) rest = rest.split(p).join(" ");
  return wordsIn(rest) < 6;
}

export const MAX_PART_CHARS = 4000;

export function validateParts(
  parts: ScenarioPart[],
  answers: Record<string, unknown>,
): { ok: true; clean: Record<string, string> } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const clean: Record<string, string> = {};
  for (const part of parts) {
    const raw = answers[part.key];
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) errors[part.key] = "Please answer this.";
    else if (text.length > MAX_PART_CHARS) errors[part.key] = "This answer is too long.";
    else if (wordsIn(text) < part.minWords) errors[part.key] = `Please write at least ${part.minWords} words.`;
    else if (isVague(text)) errors[part.key] = "Please make a concrete decision here and say what you would actually do.";
    else clean[part.key] = text;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, clean };
}

/** The exact text stored as the original answer, laid out as the person saw it. */
export const composeAnswerText = (parts: ScenarioPart[], answers: Record<string, string>): string =>
  parts.map((p) => `## ${p.label}\n${answers[p.key]}`).join("\n\n");

// ───────────────────────── Integrity signals (PRD section 27) ─────────────────────────

type Weights = { points: number; cap: number };

/**
 * Each signal adds a few points, up to a cap. The total is a prompt for a human to look,
 * never proof of cheating (PRD sections 27.3, 27.4): paste, tab switches and reloads all
 * have innocent explanations.
 */
export const INTEGRITY_WEIGHTS: Record<string, Weights> = {
  TAB_SWITCH: { points: 5, cap: 30 },
  WINDOW_BLUR: { points: 2, cap: 10 },
  LARGE_PASTE: { points: 25, cap: 50 },
  RAPID_SUBMISSION: { points: 30, cap: 30 },
  LONG_INACTIVITY: { points: 5, cap: 15 },
  MULTIPLE_SESSIONS: { points: 20, cap: 20 },
  PAGE_RELOAD: { points: 3, cap: 15 },
  SESSION_CHANGE: { points: 15, cap: 15 },
  SCREEN_CAPTURE_SIGNAL: { points: 20, cap: 40 },
};

export function integrityScore(events: { type: string }[]): { score: number; breakdown: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const [type, n] of Object.entries(counts)) {
    const w = INTEGRITY_WEIGHTS[type];
    if (!w) continue; // QUESTION_SERVED and unknown types carry no weight
    breakdown[type] = Math.min(w.cap, w.points * n);
    total += breakdown[type];
  }
  return { score: Math.min(100, total), breakdown };
}

/** Seconds a person could plausibly need to write this much, even typing fast. */
export const fastestPlausibleSeconds = (totalWords: number, wordsPerMinute = 80): number =>
  (totalWords / wordsPerMinute) * 60;

// ───────────────────────── Prompt injection (answers are untrusted text) ─────────────────────────

const INJECTION_PATTERNS = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|prompts?)/i,
  /disregard (all |any |the )?(previous|prior|above|earlier)/i,
  /(give|award|assign|rate) (me|this|it)( a)? (full|perfect|maximum|top|100)/i,
  /you are (now )?(an?|the) (ai|assistant|evaluator|assessor|grader|language model)/i,
  /(system|developer) (prompt|message|instruction)/i,
  /\b(evaluator|assessor|grader)\b.{0,40}\b(score|mark|rate|pass)\b/i,
  /set (the )?(score|confidence|critical)/i,
];

export const looksLikeInjection = (text: string): boolean => INJECTION_PATTERNS.some((r) => r.test(text));

// ───────────────────────── AI result shapes and validation ─────────────────────────

export interface ProviderResult {
  provider: string;
  model: string;
  criteria: Record<string, { score: number; evidence: string }>;
  total: number;
  critical: { key: string; triggered: boolean; evidence: string }[];
  concerns: string[];
  contradictions: { earlier: string; current: string; explanation: string }[];
  confidence: number;
  followUp: string;
  summary: string;
  injectionAttempt: boolean;
}

/** Strict validation of whatever a provider returns. Nothing unvalidated reaches the database. */
export function evaluationZod(rubric: RubricCriterion[]) {
  const criteria = z.object(
    Object.fromEntries(
      rubric.map((c) => [c.key, z.object({ score: z.number().int().min(0).max(c.weight), evidence: z.string().max(2000) })]),
    ),
  );
  return z.object({
    criteria,
    critical: z.array(z.object({ key: z.string(), triggered: z.boolean(), evidence: z.string().max(2000) })).max(20),
    concerns: z.array(z.string().max(1000)).max(20),
    contradictions: z
      .array(z.object({ earlier: z.string().max(1000), current: z.string().max(1000), explanation: z.string().max(1000) }))
      .max(10),
    confidence: z.number().min(0).max(1),
    followUp: z.string().max(1000),
    summary: z.string().max(2000),
    injectionAttempt: z.boolean(),
  });
}

/** JSON Schema sent to providers. All fields required, no extras (works with strict modes). */
export function evaluationJsonSchema(rubric: RubricCriterion[]) {
  const text = { type: "string" };
  return {
    type: "object",
    additionalProperties: false,
    required: ["criteria", "critical", "concerns", "contradictions", "confidence", "followUp", "summary", "injectionAttempt"],
    properties: {
      criteria: {
        type: "object",
        additionalProperties: false,
        required: rubric.map((c) => c.key),
        properties: Object.fromEntries(
          rubric.map((c) => [
            c.key,
            {
              type: "object",
              additionalProperties: false,
              required: ["score", "evidence"],
              properties: {
                score: { type: "integer", description: `Whole number from 0 to ${c.weight}` },
                evidence: { ...text, description: "Specific evidence from the response for this score" },
              },
            },
          ]),
        ),
      },
      critical: {
        type: "array",
        description: "One entry for every critical criterion listed",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "triggered", "evidence"],
          properties: { key: text, triggered: { type: "boolean" }, evidence: text },
        },
      },
      concerns: { type: "array", items: text },
      contradictions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["earlier", "current", "explanation"],
          properties: { earlier: text, current: text, explanation: text },
        },
      },
      confidence: { type: "number", description: "From 0 to 1" },
      followUp: { ...text, description: "One specific follow-up question, or an empty string" },
      summary: { ...text, description: "Two or three sentences for a human reviewer" },
      injectionAttempt: { type: "boolean" },
    },
  };
}

// ───────────────────────── Combining several providers ─────────────────────────

export interface AggregateEval {
  criteria: Record<string, { score: number; evidence: string }>;
  total: number;
  criticalKeys: string[];
  concerns: string[];
  contradictions: ProviderResult["contradictions"];
  confidence: number;
  /** Highest total minus lowest total across providers. */
  spread: number;
  followUp: string;
  summary: string;
  injectionAttempt: boolean;
  providersUsed: number;
}

export const median = (nums: number[]): number => {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Combine results so no single provider decides alone:
 * scores are the median, a critical flag raised by ANY provider stands, concerns and
 * contradictions are pooled, and confidence falls when providers disagree.
 */
export function aggregate(results: ProviderResult[], rubric: RubricCriterion[]): AggregateEval | null {
  if (results.length === 0) return null;

  const criteria: AggregateEval["criteria"] = {};
  for (const c of rubric) {
    const scores = results.map((r) => r.criteria[c.key].score);
    const m = median(scores);
    // Use the evidence of the provider whose score is closest to the median
    const best = results.reduce((a, b) =>
      Math.abs(b.criteria[c.key].score - m) < Math.abs(a.criteria[c.key].score - m) ? b : a,
    );
    criteria[c.key] = { score: m, evidence: best.criteria[c.key].evidence };
  }
  const total = Object.values(criteria).reduce((n, c) => n + c.score, 0);

  const totals = results.map((r) => r.total);
  const spread = Math.max(...totals) - Math.min(...totals);
  const avgConfidence = results.reduce((n, r) => n + r.confidence, 0) / results.length;

  const criticalKeys = [
    ...new Set(results.flatMap((r) => r.critical.filter((c) => c.triggered).map((c) => c.key))),
  ];
  const dedupe = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

  const contradictions: AggregateEval["contradictions"] = [];
  for (const c of results.flatMap((r) => r.contradictions)) {
    if (!contradictions.some((x) => x.earlier === c.earlier && x.current === c.current)) contradictions.push(c);
  }

  return {
    criteria,
    total,
    criticalKeys,
    concerns: dedupe(results.flatMap((r) => r.concerns)),
    contradictions,
    confidence: Math.round(clamp01(avgConfidence * (1 - spread / 100)) * 100) / 100,
    spread,
    followUp: results.map((r) => r.followUp).find((f) => f.trim()) ?? "",
    summary: results[0].summary,
    injectionAttempt: results.some((r) => r.injectionAttempt),
    providersUsed: results.length,
  };
}

// ───────────────────────── Business rules (PRD section 11) ─────────────────────────

export interface DecisionInput {
  aggregate: AggregateEval | null;
  passThreshold: number;
  integrityScore: number;
  integrityThreshold: number;
  minConfidence: number;
  maxDisagreement: number;
  minProviders: number;
  injectionInText: boolean;
}

export type Trigger =
  | "AI_UNAVAILABLE"
  | "CRITICAL_FLAG"
  | "INTEGRITY_FLAG"
  | "LOW_CONFIDENCE"
  | "PROVIDER_DISAGREEMENT"
  | "REDUCED_PANEL"
  | "BELOW_PASS_MARK"
  | "CONTRADICTION"
  | "INJECTION_ATTEMPT";

/**
 * The AI can only ever help someone through automatically. Anything unusual, and any result
 * below the pass mark, goes to a person. The AI never fails or excludes anyone by itself.
 */
export function decide(i: DecisionInput): { outcome: "AUTO_PASS" | "REVIEW"; triggers: Trigger[] } {
  const triggers: Trigger[] = [];
  const a = i.aggregate;
  if (!a) triggers.push("AI_UNAVAILABLE");
  if (a) {
    if (a.criticalKeys.length) triggers.push("CRITICAL_FLAG");
    if (a.confidence < i.minConfidence) triggers.push("LOW_CONFIDENCE");
    if (a.spread > i.maxDisagreement) triggers.push("PROVIDER_DISAGREEMENT");
    if (a.providersUsed < i.minProviders) triggers.push("REDUCED_PANEL");
    if (a.total < i.passThreshold) triggers.push("BELOW_PASS_MARK");
    if (a.contradictions.length) triggers.push("CONTRADICTION");
    if (a.injectionAttempt) triggers.push("INJECTION_ATTEMPT");
  }
  if (i.injectionInText && !triggers.includes("INJECTION_ATTEMPT")) triggers.push("INJECTION_ATTEMPT");
  if (i.integrityScore >= i.integrityThreshold) triggers.push("INTEGRITY_FLAG");
  return { outcome: triggers.length === 0 ? "AUTO_PASS" : "REVIEW", triggers };
}
