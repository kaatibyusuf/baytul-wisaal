import type { Classification, Level, ResponseType } from "./api";

export const LEVEL_TITLE: Record<Level, string> = {
  NON_NEGOTIABLE: "Non-negotiable",
  PREFERENCE: "Preference",
  FLEXIBLE: "Flexible",
};

export const LEVEL_HINT: Record<Level, string> = {
  NON_NEGOTIABLE: "I could not marry someone who does not meet this.",
  PREFERENCE: "I would like this, but I can compromise.",
  FLEXIBLE: "Open to discussion.",
};

export const RESPONSE_LABEL: Record<ResponseType, string> = {
  AGREE: "I agree",
  PARTIALLY_AGREE: "I partly agree",
  WILLING_TO_DISCUSS: "I am willing to discuss it",
  DISAGREE: "I disagree",
  NOT_APPLICABLE: "Not applicable to me",
};

export const CLASS_LABEL: Record<Classification, string> = {
  ALIGNED: "Aligned",
  NEEDS_DISCUSSION: "Needs discussion",
  CONFLICT: "Conflict",
};

export const CLASS_STYLE: Record<Classification, string> = {
  ALIGNED: "border-aqua/40 bg-aqua-tint text-nile",
  NEEDS_DISCUSSION: "border-gold bg-gold-tint text-nile",
  CONFLICT: "border-destructive/50 bg-[#fef3f2] text-[#912018]",
};

export const REASON_LABEL: Record<string, string> = {
  CONFLICT: "Someone disagreed with something the other called non-negotiable",
  TOO_MANY_DISCUSSION_POINTS: "Many points are still to be discussed",
  TOO_MANY_PREFERENCE_DISAGREEMENTS: "Several preferences were disagreed with",
};

export const wordCount = (t: string) => (t.trim().match(/\S+/g) ?? []).length;
