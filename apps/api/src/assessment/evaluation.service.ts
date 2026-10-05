import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ActivityStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ProgrammeService } from "../programme/programme.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { AssessmentEvaluatorService } from "./ai/evaluator.service";
import { EvaluationOutcome } from "./ai/types";
import { CriticalCriterion, RubricCriterion, decide, looksLikeInjection } from "./rules";
import { loadAssessmentSettings } from "./settings";

const MAX_ATTEMPTS = 3;
const SWEEP_MS = 30_000;

/**
 * Evaluates submitted answers in the background and applies the business rules (PRD section 11):
 * answer -> AI evaluation -> rules -> human review where required -> decision.
 *
 * This runs in-process for now. The work is already separated from the HTTP request and is safe
 * to retry, so it can move onto BullMQ + Redis (PRD section 44) without changing the pipeline.
 */
@Injectable()
export class EvaluationService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(EvaluationService.name);
  private readonly running = new Set<string>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsSvc: SettingsService,
    private readonly evaluator: AssessmentEvaluatorService,
    private readonly programme: ProgrammeService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    // Picks up anything left pending (a restart, a provider outage) and retries it.
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS);
    void this.sweep();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Start work on one answer right after submission. */
  kick(sessionId: string) {
    if (process.env.NODE_ENV === "test") return;
    setImmediate(() => void this.process(sessionId));
  }

  async sweep() {
    try {
      const pending = await this.prisma.assessmentSession.findMany({ where: { evalState: "PENDING" } });
      for (const s of pending.slice(0, 10)) await this.process(s.id);
    } catch (e) {
      this.log.error(`Sweep failed: ${(e as Error).message}`);
    }
  }

  async process(sessionId: string): Promise<void> {
    if (this.running.has(sessionId)) return;
    this.running.add(sessionId);
    try {
      await this.run(sessionId);
    } catch (e) {
      this.log.error(`Evaluation of ${sessionId} failed: ${(e as Error).message}`);
    } finally {
      this.running.delete(sessionId);
    }
  }

  private async run(sessionId: string) {
    const session = await this.prisma.assessmentSession.findUnique({ where: { id: sessionId } });
    if (!session || session.evalState !== "PENDING") return;
    const answer = await this.prisma.assessmentAnswer.findFirst({ where: { sessionId, sequence: 0 } });
    if (!answer) return;
    const version = await this.prisma.scenarioVersion.findUnique({ where: { id: session.scenarioVersionId } });
    if (!version) return;
    const rubricRow = await this.prisma.rubric.findFirst({
      where: { scenarioId: version.scenarioId },
      orderBy: { version: "desc" },
    });
    if (!rubricRow) {
      this.log.error(`Scenario ${version.scenarioId} has no rubric; sending to review.`);
    }

    const rubric = (rubricRow?.criteria ?? []) as unknown as RubricCriterion[];
    const critical = (rubricRow?.criticalCriteria ?? []) as unknown as CriticalCriterion[];
    const variant = session.renderedVariant as unknown as { text: string; parts: { key: string; label: string }[] };
    const written = (answer.parts ?? {}) as Record<string, string>;
    const settings = await loadAssessmentSettings(this.settingsSvc);

    // Nothing configured (or no rubric) means no AI evaluation: go straight to a person.
    let outcome: EvaluationOutcome = { aggregate: null, perProvider: [], failures: [] };
    if (rubricRow && this.evaluator.providerCount > 0) {
      outcome = await this.evaluator.evaluateAnswer({
        scenarioText: variant.text,
        parts: variant.parts.map((p) => ({ label: p.label, text: written[p.key] ?? "" })),
        rubric,
        critical,
        previous: await this.previousAnswers(session.userId, session.id),
      });
      if (!outcome.aggregate) {
        const attempts = session.evalAttempts + 1;
        if (attempts < MAX_ATTEMPTS) {
          await this.prisma.assessmentSession.update({
            where: { id: session.id },
            data: { evalAttempts: attempts, evalError: this.describe(outcome) },
          });
          return; // the sweep tries again shortly
        }
      }
    }

    const decision = decide({
      aggregate: outcome.aggregate,
      passThreshold: rubricRow?.passThreshold ?? settings.defaultPassThreshold,
      integrityScore: session.integrityScore ?? 0,
      integrityThreshold: settings.integrityReviewThreshold,
      minConfidence: settings.minConfidence,
      maxDisagreement: settings.maxDisagreement,
      minProviders: Math.min(settings.minProviders, Math.max(1, this.evaluator.providerCount)),
      injectionInText: looksLikeInjection(answer.originalText),
    });
    const passed = decision.outcome === "AUTO_PASS";

    // Everything is written together, so a crash can never leave half a result.
    const writes: Prisma.PrismaPromise<unknown>[] = [];
    if (rubricRow) {
      const row = (r: { provider: string; model: string; criteria: Record<string, { score: number; evidence: string }>; total: number; concerns: string[]; contradictions: unknown; confidence: number; followUp: string; summary: string; critical: boolean }, isAggregate: boolean) =>
        this.prisma.aIEvaluation.create({
          data: {
            answerId: answer.id,
            rubricId: rubricRow.id,
            provider: r.provider,
            model: r.model,
            scores: Object.fromEntries(Object.entries(r.criteria).map(([k, v]) => [k, v.score])),
            total: r.total,
            evidence: Object.fromEntries(Object.entries(r.criteria).map(([k, v]) => [k, v.evidence])),
            concerns: r.concerns,
            contradictions: r.contradictions as Prisma.InputJsonValue,
            confidence: r.confidence,
            followUp: r.followUp,
            recommendation: r.summary,
            isAggregate,
            criticalFlag: r.critical,
          },
        });
      for (const r of outcome.perProvider) {
        writes.push(row({ ...r, critical: r.critical.some((c) => c.triggered) }, false));
      }
      const a = outcome.aggregate;
      if (a) {
        writes.push(
          row(
            {
              provider: "consensus",
              model: outcome.perProvider.map((p) => p.provider).join("+"),
              criteria: a.criteria,
              total: a.total,
              concerns: a.concerns,
              contradictions: a.contradictions,
              confidence: a.confidence,
              followUp: a.followUp,
              summary: a.summary,
              critical: a.criticalKeys.length > 0,
            },
            true,
          ),
        );
      }
    }
    writes.push(
      this.prisma.assessmentSession.update({
        where: { id: session.id },
        data: {
          evalState: passed ? "DONE" : "REVIEW",
          evaluatedAt: new Date(),
          evalAttempts: session.evalAttempts + (outcome.aggregate ? 0 : 1),
          evalError: outcome.failures.length ? this.describe(outcome) : null,
        },
      }),
    );
    if (!passed) {
      writes.push(
        this.prisma.humanReview.create({
          data: {
            answerId: answer.id,
            triggers: decision.triggers,
            reason: outcome.aggregate?.summary ?? "No AI evaluation was available.",
          },
        }),
      );
    }
    await this.prisma.$transaction(writes);

    if (session.activityId) {
      await this.programme.resolveActivity(
        session.userId,
        session.activityId,
        passed ? ActivityStatus.PASSED : ActivityStatus.UNDER_REVIEW,
      );
    }
    await this.prisma.notification.create({
      data: passed
        ? { userId: session.userId, type: "SCENARIO_COMPLETE", title: "Scenario complete", body: "Your response has been assessed and the activity is complete." }
        : { userId: session.userId, type: "SCENARIO_IN_REVIEW", title: "Your response is being reviewed", body: "A member of our team will look at your response. There is nothing you need to do." },
    });
    await this.audit.record({
      actorId: "system",
      action: "ASSESSMENT_EVALUATED",
      targetType: "AssessmentSession",
      targetId: session.id,
      metadata: {
        outcome: decision.outcome,
        triggers: decision.triggers,
        providers: outcome.perProvider.map((p) => `${p.provider}:${p.model}`),
        failed: outcome.failures.map((f) => f.provider),
      },
    });
  }

  private async previousAnswers(userId: string, excludeSessionId: string) {
    const sessions = (await this.prisma.assessmentSession.findMany({ where: { userId, status: "SUBMITTED" } }))
      .filter((s) => s.id !== excludeSessionId && s.submittedAt)
      .sort((a, b) => b.submittedAt!.getTime() - a.submittedAt!.getTime())
      .slice(0, 5);
    const out: { scenarioTitle: string; text: string }[] = [];
    for (const s of sessions) {
      const a = await this.prisma.assessmentAnswer.findFirst({ where: { sessionId: s.id, sequence: 0 } });
      const title = (s.renderedVariant as { title?: string } | null)?.title ?? "Earlier scenario";
      if (a) out.push({ scenarioTitle: title, text: a.originalText });
    }
    return out;
  }

  private describe(o: EvaluationOutcome) {
    return o.failures.map((f) => `${f.provider}: ${f.error}`).join(" | ").slice(0, 500);
  }
}
