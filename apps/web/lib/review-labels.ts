/** Plain-language reasons an answer reached a person, for reviewers. */
export const TRIGGER_LABELS: Record<string, string> = {
  CRITICAL_FLAG: "A critical concern was raised",
  BELOW_PASS_MARK: "Below the pass mark",
  LOW_CONFIDENCE: "The assessors were not confident",
  PROVIDER_DISAGREEMENT: "The assessors disagreed",
  REDUCED_PANEL: "Fewer assessors than usual answered",
  CONTRADICTION: "Conflicts with an earlier answer",
  INJECTION_ATTEMPT: "The answer tried to instruct the assessor",
  INTEGRITY_FLAG: "Unusual activity during the session",
  AI_UNAVAILABLE: "No AI assessment was available",
};

export const EVENT_LABELS: Record<string, string> = {
  TAB_SWITCH: "Switched tab",
  WINDOW_BLUR: "Window lost focus",
  LARGE_PASTE: "Large paste",
  RAPID_SUBMISSION: "Very fast submission",
  LONG_INACTIVITY: "Long inactivity",
  MULTIPLE_SESSIONS: "Opened in two places",
  PAGE_RELOAD: "Reloaded the page",
  SESSION_CHANGE: "Used a stale session",
  SCREEN_CAPTURE_SIGNAL: "Screen-capture key pressed",
  QUESTION_SERVED: "Scenario displayed",
};
