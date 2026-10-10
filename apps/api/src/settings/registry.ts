import { ASSESSMENT_DEFAULTS } from "../assessment/settings";
import { MATCHING_DEFAULTS } from "../matching/settings";
import { COMPAT_DEFAULTS } from "../postmatch/rules";
import { DEFAULT_SETTINGS } from "../programme/rules";

/**
 * Every setting an administrator may change (PRD section 15: nothing hard-coded). Each has limits,
 * so a typo cannot switch a rule off by accident.
 */
export interface SettingDef {
  key: string;
  group: "Programme" | "Assessment" | "Matching" | "Compatibility";
  label: string;
  description: string;
  default: number;
  min: number;
  max: number;
  integer: boolean;
  /** A yes/no switch stored as 1 or 0 */
  boolean?: boolean;
  /** A change here weakens a safeguard, so the screen warns about it. */
  sensitive?: boolean;
}

const def = (d: SettingDef): SettingDef => d;

export const SETTING_DEFS: SettingDef[] = [
  def({ key: "programme.unlockIntervalHours", group: "Programme", label: "Hours between days", description: "How long after one day opens the next can open. 24 means one day per day. 0 opens every day in order straight away (testing only).", default: DEFAULT_SETTINGS.unlockIntervalHours, min: 0, max: 168, integer: true, sensitive: true }),
  def({ key: "programme.graceDays", group: "Programme", label: "Grace period (days)", description: "Extra days after the final day before an unfinished programme expires.", default: DEFAULT_SETTINGS.graceDays, min: 0, max: 365, integer: true }),
  def({ key: "programme.lessonMinSeconds", group: "Programme", label: "Shortest lesson time (seconds)", description: "Least time a lesson must be open before it can be marked complete.", default: DEFAULT_SETTINGS.lessonMinSeconds, min: 0, max: 600, integer: true }),
  def({ key: "programme.lessonMaxSeconds", group: "Programme", label: "Longest required lesson time (seconds)", description: "No lesson ever needs more than this, however long it is.", default: DEFAULT_SETTINGS.lessonMaxSeconds, min: 0, max: 1800, integer: true }),
  def({ key: "programme.readingFraction", group: "Programme", label: "Share of reading time required", description: "Fraction of the estimated reading time that must pass, from 0 to 1.", default: DEFAULT_SETTINGS.readingFraction, min: 0, max: 1, integer: false }),
  def({ key: "programme.quizPassMark", group: "Programme", label: "Quiz pass mark (%)", description: "Default pass mark for quizzes that do not set their own.", default: DEFAULT_SETTINGS.quizPassMark, min: 1, max: 100, integer: true }),
  def({ key: "programme.quizMaxAttempts", group: "Programme", label: "Quiz attempts", description: "Default number of attempts before a quiz goes to review.", default: DEFAULT_SETTINGS.quizMaxAttempts, min: 1, max: 10, integer: true }),

  def({ key: "assessment.sessionMinutes", group: "Assessment", label: "Scenario time limit (minutes)", description: "How long a person has once they start a scenario.", default: ASSESSMENT_DEFAULTS.sessionMinutes, min: 5, max: 240, integer: true }),
  def({ key: "assessment.maxSessions", group: "Assessment", label: "Scenario attempts", description: "How many sessions a person may open for one scenario.", default: ASSESSMENT_DEFAULTS.maxSessions, min: 1, max: 5, integer: true }),
  def({ key: "assessment.integrityReviewThreshold", group: "Assessment", label: "Session-signal level that triggers review", description: "From 0 to 100. Lower sends more answers to a person.", default: ASSESSMENT_DEFAULTS.integrityReviewThreshold, min: 10, max: 100, integer: true, sensitive: true }),
  def({ key: "assessment.minConfidence", group: "Assessment", label: "Lowest AI confidence accepted", description: "From 0 to 1. Below this, a person reviews the answer.", default: ASSESSMENT_DEFAULTS.minConfidence, min: 0, max: 1, integer: false, sensitive: true }),
  def({ key: "assessment.maxDisagreement", group: "Assessment", label: "Largest AI disagreement accepted (points)", description: "If the AI assessors' totals differ by more than this, a person reviews the answer.", default: ASSESSMENT_DEFAULTS.maxDisagreement, min: 0, max: 100, integer: true, sensitive: true }),
  def({ key: "assessment.minProviders", group: "Assessment", label: "Fewest AI assessors required", description: "If fewer answer, a person reviews the answer.", default: ASSESSMENT_DEFAULTS.minProviders, min: 1, max: 3, integer: true, sensitive: true }),
  def({ key: "assessment.defaultPassThreshold", group: "Assessment", label: "Default pass mark (%)", description: "Used when a scenario's rubric does not set its own.", default: ASSESSMENT_DEFAULTS.defaultPassThreshold, min: 0, max: 100, integer: true }),

  def({ key: "matching.requireProgramme", group: "Matching", label: "Require the programme first", description: "1 means people must finish the marriage-readiness programme before preferences and matching. 0 switches this off (testing only).", default: MATCHING_DEFAULTS.requireProgramme, min: 0, max: 1, integer: true, boolean: true, sensitive: true }),
  def({ key: "matching.minScore", group: "Matching", label: "Lowest fit score matched", description: "From 0 to 1. Pairs that fit less well than this are not introduced.", default: MATCHING_DEFAULTS.minScore, min: 0, max: 1, integer: false }),
  def({ key: "matching.maxNonNegotiable", group: "Matching", label: "Most non-negotiables allowed", description: "How many things a person may mark as non-negotiable.", default: MATCHING_DEFAULTS.maxNonNegotiable, min: 0, max: 25, integer: true }),
  def({ key: "matching.withdrawCooldownDays", group: "Matching", label: "Rest after closing a pairing (days)", description: "How long a person waits before being matched again after closing a pairing.", default: MATCHING_DEFAULTS.withdrawCooldownDays, min: 0, max: 90, integer: true }),

  def({ key: "compat.minItems", group: "Compatibility", label: "Fewest expectations to submit", description: "", default: COMPAT_DEFAULTS.minItems, min: 1, max: 25, integer: true }),
  def({ key: "compat.maxItems", group: "Compatibility", label: "Most expectations allowed", description: "", default: COMPAT_DEFAULTS.maxItems, min: 5, max: 60, integer: true }),
  def({ key: "compat.maxPhysicalItems", group: "Compatibility", label: "Most physical expectations allowed", description: "Kept small so people think beyond physique.", default: COMPAT_DEFAULTS.maxPhysicalItems, min: 0, max: 5, integer: true, sensitive: true }),
  def({ key: "compat.minExplanationWords", group: "Compatibility", label: "Shortest explanation (words)", description: "Every response except 'not applicable' needs at least this many words.", default: COMPAT_DEFAULTS.minExplanationWords, min: 1, max: 100, integer: true, sensitive: true }),
  def({ key: "compat.maxNeedsDiscussion", group: "Compatibility", label: "Most discussion points allowed", description: "More than this and the pairing does not meet the requirements.", default: COMPAT_DEFAULTS.maxNeedsDiscussion, min: 0, max: 60, integer: true }),
  def({ key: "compat.maxPreferenceDisagreements", group: "Compatibility", label: "Most preferences disagreed with", description: "More than this and the pairing does not meet the requirements.", default: COMPAT_DEFAULTS.maxPreferenceDisagreements, min: 0, max: 60, integer: true }),
  def({ key: "compat.requireReviewOnFail", group: "Compatibility", label: "A person reviews before closing", description: "1 means a pairing that does not meet the requirements is looked at by a person before it is closed for good. 0 closes it automatically.", default: COMPAT_DEFAULTS.requireReviewOnFail, min: 0, max: 1, integer: true, boolean: true, sensitive: true }),
];

export const SETTING_BY_KEY = new Map(SETTING_DEFS.map((d) => [d.key, d]));

export function validateSettingValue(
  d: SettingDef,
  value: unknown,
  current: (key: string) => number,
): { ok: true; value: number } | { ok: false; message: string } {
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, message: "Enter a number." };
  if (d.integer && !Number.isInteger(value)) return { ok: false, message: "Enter a whole number." };
  if (value < d.min || value > d.max) return { ok: false, message: `Enter a value from ${d.min} to ${d.max}.` };
  // Pairs of settings that must stay consistent
  if (d.key === "programme.lessonMinSeconds" && value > current("programme.lessonMaxSeconds")) {
    return { ok: false, message: "The shortest time cannot be more than the longest." };
  }
  if (d.key === "programme.lessonMaxSeconds" && value < current("programme.lessonMinSeconds")) {
    return { ok: false, message: "The longest time cannot be less than the shortest." };
  }
  if (d.key === "compat.minItems" && value > current("compat.maxItems")) return { ok: false, message: "The fewest cannot be more than the most." };
  if (d.key === "compat.maxItems" && value < current("compat.minItems")) return { ok: false, message: "The most cannot be less than the fewest." };
  return { ok: true, value };
}
