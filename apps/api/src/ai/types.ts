/**
 * Provider-independent AI contracts (PRD section 43).
 * The rest of the application only ever sees these types, never a vendor SDK.
 */

export interface RubricCriterion {
  key: string;
  label: string;
  weight: number;
  description?: string;
}
export interface CriticalCriterion {
  key: string;
  description: string;
}

export interface TranscriptTurn {
  /** null for the initial answer; the follow-up question for later turns */
  prompt: string | null;
  parts: { label: string; text: string }[];
}

export interface EvaluationInput {
  scenario: string;
  rubric: { criteria: RubricCriterion[]; critical: CriticalCriterion[] };
  /** Everything said in this session, oldest first. The last turn is the one being evaluated. */
  transcript: TranscriptTurn[];
  /** Earlier writing by the same person, for the consistency check (PRD section 13). */
  priorResponses: { source: "reflection" | "assessment"; text: string }[];
}

export interface Contradiction {
  earlier: string;
  current: string;
  explanation: string;
  severity: "low" | "medium" | "high";
}

export interface EvaluationResult {
  /** 0-100 per rubric criterion */
  scores: Record<string, number>;
  /** Short quotes or paraphrases from the answer supporting each score */
  evidence: Record<string, string[]>;
  concerns: string[];
  contradictions: Contradiction[];
  /** Critical criteria the answer appears to trigger. Any entry forces human review. */
  criticalFlags: { key: string; evidence: string }[];
  /** 0-1: how sure the evaluator is of its own assessment */
  confidence: number;
  /** A follow-up question, only when one is genuinely needed */
  followUp: string | null;
  /** Advisory only. Never executed directly (PRD section 11). */
  recommendation: "PASS" | "REVIEW" | "FAIL";
  provider: string;
  model: string;
}

/** The internal abstraction named in PRD section 43. */
export interface AssessmentEvaluator {
  readonly provider: string;
  readonly model: string;
  evaluateAnswer(input: EvaluationInput): Promise<EvaluationResult>;
  identifyEvidence(input: EvaluationInput): Promise<Record<string, string[]>>;
  detectContradictions(input: EvaluationInput): Promise<Contradiction[]>;
  generateFollowUp(input: EvaluationInput): Promise<string | null>;
  summarizeCompatibility(input: CompatibilityInput): Promise<CompatibilitySummary>;
}

export interface CompatibilityInput {
  areas: { category: string; statement: string; response: string; explanation?: string }[];
}
export interface CompatibilitySummary {
  summary: string;
  alignedAreas: string[];
  discussionAreas: string[];
  conflictAreas: string[];
}

/** One vendor behind a uniform "ask for JSON" call. Adapters live in ./providers. */
export interface LlmRequest {
  system: string;
  user: string;
  maxTokens: number;
  /** Only read by the development mock provider */
  meta?: { criteriaKeys?: string[]; criticalKeys?: string[]; totalWords?: number; turn?: number };
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  generateJson(req: LlmRequest): Promise<unknown>;
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public retryable = false,
  ) {
    super(`[${provider}] ${message}`);
  }
}
