import { LlmProvider, LlmRequest } from "../types";

/**
 * DEVELOPMENT ONLY. Lets the whole assessment flow be clicked through without an API key.
 * It scores by length, which is not assessment. It is never enabled in production.
 */
export class MockProvider implements LlmProvider {
  readonly name = "mock";
  readonly model = "heuristic-v1";

  async generateJson(req: LlmRequest): Promise<unknown> {
    const keys = req.meta?.criteriaKeys ?? [];
    const words = req.meta?.totalWords ?? 0;
    const turn = req.meta?.turn ?? 0;
    const perCriterion = Math.min(95, 35 + Math.round(words / Math.max(keys.length, 1) / 3));

    return {
      scores: Object.fromEntries(keys.map((k) => [k, perCriterion])),
      evidence: Object.fromEntries(keys.map((k) => [k, ["(mock evaluation: no real analysis performed)"]])),
      concerns: [],
      contradictions: [],
      criticalFlags: [],
      confidence: 0.8,
      // Exercise the follow-up path once for short answers
      followUp: turn === 0 && words < 250 ? "(mock follow-up) What specifically would you be willing to give up to make this work?" : null,
      recommendation: perCriterion >= 60 ? "PASS" : "REVIEW",
    };
  }
}
