import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { CompatDecisionDto } from "./dto";
import { PostMatchService } from "./postmatch.service";

/**
 * A pairing that did not meet the requirements is looked at by a person before it is closed for
 * good (PRD sections 11 and 24). Closing a pairing is permanent, so it is never left to rules alone.
 */
@Injectable()
export class CompatReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly postMatch: PostMatchService,
  ) {}

  async list() {
    const pending = await this.prisma.compatibility.findMany({ where: { passed: null }, orderBy: { createdAt: "asc" } });
    return pending.map((c) => ({ matchId: c.matchId, createdAt: c.createdAt, reasons: c.reasons }));
  }

  private async load(matchId: string) {
    const compat = await this.prisma.compatibility.findUnique({ where: { matchId } });
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!compat || !match) throw new NotFoundException({ code: "NOT_FOUND", message: "Not found." });
    return { compat, match };
  }

  async detail(matchId: string) {
    const { compat, match } = await this.load(matchId);
    const stored = compat.areas as unknown as { areas: { itemId: string; classification: string }[]; categories: unknown; counts: unknown };
    const klass = new Map(stored.areas.map((a) => [a.itemId, a.classification]));

    const items: unknown[] = [];
    for (const authorId of [match.userAId, match.userBId]) {
      const exp = await this.prisma.matchExpectation.findFirst({ where: { matchId, authorId } });
      if (!exp) continue;
      const rows = await this.prisma.matchExpectationItem.findMany({ where: { expectationId: exp.id }, orderBy: { position: "asc" } });
      const responses = await this.prisma.matchResponse.findMany({ where: { itemId: { in: rows.map((r) => r.id) } } });
      const byItem = new Map(responses.map((r) => [r.itemId, r]));
      for (const r of rows) {
        const resp = byItem.get(r.id);
        items.push({
          author: authorId === match.userAId ? "Person A" : "Person B",
          category: r.category,
          statement: r.statement,
          level: r.level,
          compromiseNote: r.compromiseNote,
          response: resp ? { type: resp.type, explanation: resp.explanation ?? "" } : null,
          classification: klass.get(r.id) ?? "ALIGNED",
        });
      }
    }
    return {
      matchId,
      decided: compat.passed !== null,
      passed: compat.passed,
      reasons: compat.reasons,
      counts: stored.counts,
      categories: stored.categories,
      items,
    };
  }

  async decide(reviewer: AuthUser, matchId: string, dto: CompatDecisionDto) {
    const { compat, match } = await this.load(matchId);
    if (match.userAId === reviewer.id || match.userBId === reviewer.id) {
      throw new ForbiddenException({ code: "OWN_REVIEW", message: "You cannot review your own pairing." });
    }
    if (compat.passed !== null) throw new ConflictException({ code: "ALREADY_DECIDED", message: "This has already been decided." });

    const passed = dto.decision === "PASS";
    await this.prisma.compatibility.update({
      where: { matchId },
      data: { passed, decidedBy: reviewer.id, decidedAt: new Date() },
    });

    if (passed) {
      await this.prisma.match.update({ where: { id: matchId }, data: { stage: "NEXT_STAGE" } });
      for (const userId of [match.userAId, match.userBId]) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: "MATCH_NEXT_STAGE",
            title: "You have reached the next stage",
            body: "Your expectations are compatible enough to move forward. Open your match to see how they compare.",
          },
        });
      }
    } else {
      await this.postMatch.close(match, "compatibility-review", reviewer.id);
    }

    await this.audit.record({
      actorId: reviewer.id,
      action: "COMPATIBILITY_REVIEW_DECIDED",
      targetType: "Match",
      targetId: matchId,
      reason: dto.notes,
      metadata: { decision: dto.decision, reasons: compat.reasons },
    });
    return { ok: true };
  }
}
