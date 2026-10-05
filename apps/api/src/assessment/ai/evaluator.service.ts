import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AggregateEval,
  ProviderResult,
  RubricCriterion,
  aggregate,
  evaluationJsonSchema,
  evaluationZod,
} from "../rules";
import { buildSystem, buildUser } from "./prompt";
import {
  AssessmentEvaluator,
  EvaluationInput,
  EvaluationOutcome,
  LLM_PROVIDERS,
  LlmProvider,
} from "./types";

/**
 * Runs the configured providers and combines them (PRD section 43). The rest of the app only
 * calls this class, so adding, removing or swapping a vendor never touches business logic.
 *
 * AI_MODE=consensus  every provider evaluates; results are combined (default with 2+ providers)
 * AI_MODE=failover   providers are tried in order until one succeeds
 */
@Injectable()
export class AssessmentEvaluatorService implements AssessmentEvaluator {
  private readonly log = new Logger(AssessmentEvaluatorService.name);

  constructor(@Inject(LLM_PROVIDERS) private readonly providers: LlmProvider[]) {}

  get providerCount(): number {
    return this.providers.length;
  }

  private get mode(): "consensus" | "failover" {
    const m = (process.env.AI_MODE ?? "").toLowerCase();
    if (m === "consensus" || m === "failover") return m;
    return this.providers.length > 1 ? "consensus" : "failover";
  }

  async evaluateAnswer(input: EvaluationInput): Promise<EvaluationOutcome> {
    const perProvider: ProviderResult[] = [];
    const failures: EvaluationOutcome["failures"] = [];
    const record = (p: LlmProvider) => (r: ProviderResult | Error) => {
      if (r instanceof Error) {
        failures.push({ provider: p.name, error: r.message.slice(0, 300) });
        this.log.warn(`${p.name} failed: ${r.message.slice(0, 200)}`);
      } else perProvider.push(r);
    };

    if (this.mode === "consensus") {
      await Promise.all(this.providers.map(async (p) => record(p)(await this.runOne(p, input).catch((e: Error) => e))));
    } else {
      for (const p of this.providers) {
        const r = await this.runOne(p, input).catch((e: Error) => e);
        record(p)(r);
        if (!(r instanceof Error)) break;
      }
    }

    return { aggregate: aggregate(perProvider, input.rubric), perProvider, failures };
  }

  private async runOne(provider: LlmProvider, input: EvaluationInput): Promise<ProviderResult> {
    const schema = evaluationJsonSchema(input.rubric);
    const validator = evaluationZod(input.rubric);
    const request = {
      system: buildSystem(input.rubric, input.critical),
      user: buildUser(input),
      schemaName: "record_evaluation",
      schema,
      maxTokens: 4000,
    };

    // One retry if the vendor returns something that does not pass our own validation.
    let lastIssue = "invalid result";
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await provider.completeJson(request);
      const parsed = validator.safeParse(raw);
      if (parsed.success) return this.toResult(provider, parsed.data, input.rubric);
      lastIssue = parsed.error.issues[0] ? `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` : "invalid result";
    }
    throw new Error(`${provider.name}: result failed validation (${lastIssue})`);
  }

  private toResult(
    provider: LlmProvider,
    d: ReturnType<ReturnType<typeof evaluationZod>["parse"]>,
    rubric: RubricCriterion[],
  ): ProviderResult {
    const total = rubric.reduce((n, c) => n + (d.criteria as any)[c.key].score, 0);
    return { provider: provider.name, model: provider.model, criteria: d.criteria as ProviderResult["criteria"], total, ...stripCriteria(d) };
  }

  // PRD section 43 interface. One call produces all of these; the rest read from the outcome.
  identifyEvidence(o: EvaluationOutcome) {
    return Object.fromEntries(Object.entries(o.aggregate?.criteria ?? {}).map(([k, v]) => [k, v.evidence]));
  }
  detectContradictions(o: EvaluationOutcome): AggregateEval["contradictions"] {
    return o.aggregate?.contradictions ?? [];
  }
  generateFollowUp(o: EvaluationOutcome): string {
    return o.aggregate?.followUp ?? "";
  }
  async summarizeCompatibility(): Promise<never> {
    throw new Error("summarizeCompatibility arrives with the compatibility milestone.");
  }
}

function stripCriteria(d: Record<string, unknown>) {
  const { criteria: _c, ...rest } = d as { criteria: unknown } & Omit<ProviderResult, "provider" | "model" | "criteria" | "total">;
  return rest;
}
