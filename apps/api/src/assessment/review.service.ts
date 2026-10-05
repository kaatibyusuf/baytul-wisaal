import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ActivityStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators";
import { ProgrammeService } from "../programme/programme.service";
import { PrismaService } from "../prisma/prisma.service";
import { DecideReviewDto } from "./dto";

/** Human review queue (PRD sections 11, 12, 33). A person always makes the consequential call. */
@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programme: ProgrammeService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const reviews = await this.prisma.humanReview.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } });
    return reviews.map((r) => ({ id: r.id, createdAt: r.createdAt, triggers: r.triggers }));
  }

  private async load(id: string) {
    const review = await this.prisma.humanReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException({ code: "NOT_FOUND", message: "Review not found." });
    const answer = await this.prisma.assessmentAnswer.findUnique({ where: { id: review.answerId } });
    const session = answer && (await this.prisma.assessmentSession.findUnique({ where: { id: answer.sessionId } }));
    if (!answer || !session) throw new NotFoundException({ code: "NOT_FOUND", message: "Review not found." });
    return { review, answer, session };
  }

  async detail(id: string) {
    const { review, answer, session } = await this.load(id);
    const evaluations = await this.prisma.aIEvaluation.findMany({ where: { answerId: answer.id }, orderBy: { createdAt: "asc" } });
    const events = await this.prisma.integrityEvent.findMany({ where: { sessionId: session.id }, orderBy: { at: "asc" } });
    return {
      id: review.id,
      status: review.status,
      triggers: review.triggers,
      createdAt: review.createdAt,
      // Identity is withheld to keep review focused on the answer.
      candidate: `Candidate ${session.userId.slice(-6)}`,
      scenario: (session.renderedVariant as { text?: string } | null)?.text ?? "",
      answer: answer.originalText,
      integrityScore: session.integrityScore ?? 0,
      evaluations: evaluations.map((e) => ({
        provider: e.provider,
        model: e.model,
        isAggregate: e.isAggregate,
        total: e.total,
        scores: e.scores,
        evidence: e.evidence,
        concerns: e.concerns,
        contradictions: e.contradictions,
        confidence: e.confidence,
        followUp: e.followUp,
        summary: e.recommendation,
        criticalFlag: e.criticalFlag,
      })),
      events: events.map((e) => ({ type: e.type, at: e.at, metadata: e.metadata })),
    };
  }

  async decide(reviewer: AuthUser, id: string, dto: DecideReviewDto) {
    const { review, session } = await this.load(id);
    if (session.userId === reviewer.id) {
      throw new ForbiddenException({ code: "OWN_REVIEW", message: "You cannot review your own response." });
    }
    if (review.status !== "PENDING") {
      throw new ConflictException({ code: "ALREADY_DECIDED", message: "This review has already been decided." });
    }

    await this.prisma.humanReview.update({
      where: { id },
      data: { status: dto.status, reviewerId: reviewer.id, notes: dto.notes ?? null, decidedAt: new Date() },
    });

    if (session.activityId) {
      const next =
        dto.status === "APPROVED" ? ActivityStatus.PASSED : dto.status === "FAILED" ? ActivityStatus.FAILED : ActivityStatus.UNDER_REVIEW;
      await this.programme.resolveActivity(session.userId, session.activityId, next);
    }

    const message =
      dto.status === "APPROVED"
        ? { title: "Scenario complete", body: "Your response has been reviewed and the activity is complete." }
        : dto.status === "FAILED"
          ? { title: "Your response has been reviewed", body: "This activity did not meet the requirements. Our team will be in touch about next steps." }
          : { title: "We need a little more from you", body: "Our team may ask a follow-up question about your response. There is nothing to do right now." };
    await this.prisma.notification.create({ data: { userId: session.userId, type: "SCENARIO_REVIEWED", ...message } });

    await this.audit.record({
      actorId: reviewer.id,
      action: "ASSESSMENT_REVIEW_DECIDED",
      targetType: "HumanReview",
      targetId: id,
      reason: dto.notes,
      metadata: { decision: dto.status, triggers: review.triggers },
    });
    return { ok: true };
  }
}
