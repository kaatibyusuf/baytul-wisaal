import { AggregateEval, CriticalCriterion, ProviderResult, RubricCriterion } from "../rules";

/** One request for structured JSON, expressed without any vendor's vocabulary. */
export interface LlmRequest {
  system: string;
  user: string;
  schemaName: string;
  schema: object;
  maxTokens: number;
}

/** What each vendor adapter must do. Adding a fourth provider means writing one of these. */
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  completeJson(req: LlmRequest): Promise<unknown>;
}

export const LLM_PROVIDERS = Symbol("LLM_PROVIDERS");

export interface EvaluationInput {
  scenarioText: string;
  parts: { label: string; text: string }[];
  rubric: RubricCriterion[];
  critical: CriticalCriterion[];
  previous: { scenarioTitle: string; text: string }[];
}

export interface EvaluationOutcome {
  aggregate: AggregateEval | null;
  perProvider: ProviderResult[];
  failures: { provider: string; error: string }[];
}

/** PRD section 43: the rest of the system only ever sees this, never a vendor. */
export interface AssessmentEvaluator {
  evaluateAnswer(input: EvaluationInput): Promise<EvaluationOutcome>;
  identifyEvidence(o: EvaluationOutcome): Record<string, string>;
  detectContradictions(o: EvaluationOutcome): AggregateEval["contradictions"];
  generateFollowUp(o: EvaluationOutcome): string;
  summarizeCompatibility(): Promise<never>;
}
