import { ConflictException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { Match, MatchExpectation, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { MatchmakingService } from "../matching/matchmaking.service";
import { loadMatchingSettings } from "../matching/settings";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import {
  COMPAT_DEFAULTS,
  EXPECTATION_CATEGORIES,
  LEVELS,
  Level,
  NOT_MET_NOTE,
  RESPONSE_TYPES,
  ResolvedItem,
  ResponseType,
  evaluateCompatibility,
  validateExpectations,
  validateResponses,
} from "./rules";
import { loadCompatSettings } from "./settings";

const form = (errors: Record<string, string>) =>
  new HttpException({ code: "FORM_INVALID", message: "Some answers need attention.", errors }, 400);

type Area = { itemId: string; authorId: string; category: string; classification: string };

@Injectable()
export class PostMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsSvc: SettingsService,
    private readonly audit: AuditService,
    private readonly matchmaking: MatchmakingService,
  ) {}

  // ───────────────────────── Lookups ─────────────────────────

  private async participantMatch(userId: string, matchId: string): Promise<Match> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || (match.userAId !== userId && match.userBId !== userId)) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Match not found." });
    }
    return match;
  }

  private other(match: Match, userId: string) {
    return match.userAId === userId ? match.userBId : match.userAId;
  }

  private expectationOf(matchId: string, authorId: string) {
    return this.prisma.matchExpectation.findFirst({ where: { matchId, authorId } });
  }

  private itemsOf(expectationId: string) {
    return this.prisma.matchExpectationItem.findMany({ where: { expectationId }, orderBy: { position: "asc" } });
  }

  private requireActive(match: Match) {
    if (match.status !== "ACTIVE") {
      throw new ConflictException({ code: "CLOSED", message: "This pairing is closed." });
    }
  }

  // ───────────────────────── What a person sees ─────────────────────────

  /**
   * Blind first: neither person sees the other's expectations until both have submitted their own,
   * so nobody can tailor what they write to what they have just read. The other person's responses
   * to you stay hidden until the result is known.
   */
  async view(userId: string, matchId: string) {
    const match = await this.participantMatch(userId, matchId);
    const settings = await loadCompatSettings(this.settingsSvc);
    const matching = await loadMatchingSettings(this.settingsSvc);
    const base = { matchId: match.id, status: match.status, stage: match.stage };

    if (match.status !== "ACTIVE") return { ...base, note: match.closureNote };

    const otherId = this.other(match, userId);
    const mine = await this.expectationOf(match.id, userId);
    const theirs = await this.expectationOf(match.id, otherId);
    const myItems = mine ? await this.itemsOf(mine.id) : [];
    const revealed = !!(mine?.submittedAt && theirs?.submittedAt);

    let theirItems: unknown[] | null = null;
    if (revealed && theirs) {
      const items = await this.itemsOf(theirs.id);
      const responses = await this.prisma.matchResponse.findMany({ where: { itemId: { in: items.map((i) => i.id) } } });
      const byItem = new Map(responses.map((r) => [r.itemId, r]));
      theirItems = items.map((i) => ({
        id: i.id,
        category: i.category,
        statement: i.statement,
        level: i.level,
        compromiseNote: i.compromiseNote,
        myResponse: byItem.get(i.id) ? { type: byItem.get(i.id)!.type, explanation: byItem.get(i.id)!.explanation ?? "" } : null,
      }));
    }

    return {
      ...base,
      rules: {
        categories: EXPECTATION_CATEGORIES,
        levels: LEVELS,
        responseTypes: RESPONSE_TYPES,
        minItems: settings.minItems,
        maxItems: settings.maxItems,
        maxPhysicalItems: settings.maxPhysicalItems,
        maxNonNegotiable: matching.maxNonNegotiable,
        minExplanationWords: settings.minExplanationWords,
      },
      progress: {
        you: { expectationsSubmitted: !!mine?.submittedAt, responsesSubmitted: !!theirs?.responsesSubmittedAt },
        other: { expectationsSubmitted: !!theirs?.submittedAt, responsesSubmitted: !!mine?.responsesSubmittedAt },
      },
      myExpectations: myItems.map((i) => ({ category: i.category, statement: i.statement, level: i.level, compromiseNote: i.compromiseNote })),
      theirExpectations: theirItems,
      // Only a pairing that met the requirements shows what each person wrote and answered
      result: match.stage === "NEXT_STAGE" ? await this.resultView(match, userId, mine, theirs) : null,
    };
  }

  private async resultView(match: Match, userId: string, mine: MatchExpectation | null, theirs: MatchExpectation | null) {
    const compat = await this.prisma.compatibility.findUnique({ where: { matchId: match.id } });
    if (!compat || !mine || !theirs) return null;
    const stored = compat.areas as unknown as { areas: Area[]; categories: unknown[]; counts: unknown };
    const klass = new Map(stored.areas.map((a) => [a.itemId, a.classification]));

    const rows: unknown[] = [];
    for (const [exp, direction] of [[mine, "YOURS"], [theirs, "THEIRS"]] as const) {
      const items = await this.itemsOf(exp.id);
      const responses = await this.prisma.matchResponse.findMany({ where: { itemId: { in: items.map((i) => i.id) } } });
      const byItem = new Map(responses.map((r) => [r.itemId, r]));
      for (const i of items) {
        const r = byItem.get(i.id);
        rows.push({
          direction,
          category: i.category,
          statement: i.statement,
          level: i.level,
          classification: klass.get(i.id) ?? "ALIGNED",
          response: r ? { type: r.type, explanation: r.explanation ?? "" } : null,
        });
      }
    }
    void userId;
    return { counts: stored.counts, categories: stored.categories, items: rows };
  }

  // ───────────────────────── Expectations ─────────────────────────

  async saveExpectations(userId: string, matchId: string, body: { items: unknown[]; submit?: boolean }) {
    const match = await this.participantMatch(userId, matchId);
    this.requireActive(match);
    if (match.stage !== "EXPECTATIONS_PENDING") {
      throw new ConflictException({ code: "STAGE_CLOSED", message: "Expectations are already in for this pairing." });
    }
    let mine = await this.expectationOf(match.id, userId);
    if (mine?.submittedAt) {
      throw new ConflictException({ code: "ALREADY_SUBMITTED", message: "You have already submitted your expectations." });
    }

    const final = !!body.submit;
    const v = validateExpectations(body.items, {
      final,
      maxNonNegotiable: (await loadMatchingSettings(this.settingsSvc)).maxNonNegotiable,
      settings: await loadCompatSettings(this.settingsSvc),
    });
    if (!v.ok) throw form(v.errors);

    if (!mine) {
      try {
        mine = await this.prisma.matchExpectation.create({ data: { matchId: match.id, authorId: userId } });
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
        mine = await this.expectationOf(match.id, userId);
      }
    }
    const exp = mine!;

    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.matchExpectationItem.deleteMany({ where: { expectationId: exp.id } }),
      this.prisma.matchExpectationItem.createMany({
        data: v.items.map((it, position) => ({
          expectationId: exp.id,
          category: it.category,
          statement: it.statement,
          level: it.level,
          isDealBreaker: it.level === "NON_NEGOTIABLE",
          compromiseNote: it.compromiseNote ?? null,
          position,
        })),
      }),
    ];
    if (final) writes.push(this.prisma.matchExpectation.update({ where: { id: exp.id }, data: { submittedAt: new Date() } }));
    await this.prisma.$transaction(writes);

    if (final) {
      await this.audit.record({ actorId: userId, action: "MATCH_EXPECTATIONS_SUBMITTED", targetType: "Match", targetId: match.id });
      await this.afterExpectations(match);
    }
    return this.view(userId, matchId);
  }

  /** When both are in, the pairing moves on and both people are told. */
  private async afterExpectations(match: Match) {
    const a = await this.expectationOf(match.id, match.userAId);
    const b = await this.expectationOf(match.id, match.userBId);
    if (!a?.submittedAt || !b?.submittedAt) return;
    const moved = await this.prisma.match.updateMany({
      where: { id: match.id, stage: "EXPECTATIONS_PENDING" },
      data: { stage: "RESPONSE_PENDING" },
    });
    if (moved.count === 0) return;
    for (const userId of [match.userAId, match.userBId]) {
      await this.prisma.notification.create({
        data: {
          userId,
          type: "MATCH_EXPECTATIONS_IN",
          title: "Both sets of expectations are in",
          body: "You can now read what the other person is seeking and respond to each point.",
        },
      });
    }
  }

  // ───────────────────────── Responses ─────────────────────────

  async saveResponses(userId: string, matchId: string, body: { responses: unknown[]; submit?: boolean }) {
    const match = await this.participantMatch(userId, matchId);
    this.requireActive(match);
    if (match.stage !== "RESPONSE_PENDING") {
      throw new ConflictException({ code: "NOT_READY", message: "It is not time to respond yet." });
    }
    const theirs = await this.expectationOf(match.id, this.other(match, userId));
    if (!theirs?.submittedAt) throw new ConflictException({ code: "NOT_READY", message: "It is not time to respond yet." });
    if (theirs.responsesSubmittedAt) {
      throw new ConflictException({ code: "ALREADY_SUBMITTED", message: "You have already submitted your responses." });
    }

    const items = await this.itemsOf(theirs.id);
    const final = !!body.submit;
    const v = validateResponses(body.responses, {
      final,
      itemIds: items.map((i) => i.id),
      settings: await loadCompatSettings(this.settingsSvc),
    });
    if (!v.ok) throw form(v.errors);

    const writes: Prisma.PrismaPromise<unknown>[] = v.responses.map((r) =>
      this.prisma.matchResponse.upsert({
        where: { itemId: r.itemId },
        create: { itemId: r.itemId, responderId: userId, type: r.type, explanation: r.explanation || null },
        update: { type: r.type, explanation: r.explanation || null },
      }),
    );
    if (final) writes.push(this.prisma.matchExpectation.update({ where: { id: theirs.id }, data: { responsesSubmittedAt: new Date() } }));
    if (writes.length) await this.prisma.$transaction(writes);

    if (final) {
      await this.audit.record({ actorId: userId, action: "MATCH_RESPONSES_SUBMITTED", targetType: "Match", targetId: match.id });
      await this.afterResponses(match);
    }
    return this.view(userId, matchId);
  }

  private async afterResponses(match: Match) {
    const a = await this.expectationOf(match.id, match.userAId);
    const b = await this.expectationOf(match.id, match.userBId);
    if (a?.responsesSubmittedAt && b?.responsesSubmittedAt) await this.evaluate(match, a, b);
  }

  // ───────────────────────── The result (PRD section 23) ─────────────────────────

  private async evaluate(match: Match, a: MatchExpectation, b: MatchExpectation) {
    if (await this.prisma.compatibility.findUnique({ where: { matchId: match.id } })) return; // already decided

    const resolved: ResolvedItem[] = [];
    for (const exp of [a, b]) {
      const items = await this.itemsOf(exp.id);
      const responses = await this.prisma.matchResponse.findMany({ where: { itemId: { in: items.map((i) => i.id) } } });
      const byItem = new Map(responses.map((r) => [r.itemId, r]));
      for (const i of items) {
        const r = byItem.get(i.id);
        if (!r) continue;
        resolved.push({ itemId: i.id, authorId: exp.authorId, category: i.category, level: i.level as Level, type: r.type as ResponseType });
      }
    }

    const settings = await loadCompatSettings(this.settingsSvc);
    const res = evaluateCompatibility(resolved, settings);
    const areas = { areas: res.areas, categories: res.categories, counts: res.counts } as unknown as Prisma.InputJsonObject;
    const now = new Date();

    const record = async (passed: boolean | null, summary: string) => {
      try {
        await this.prisma.compatibility.create({
          data: { matchId: match.id, areas, passed, reasons: res.reasons, summary, decidedBy: passed === null ? null : "system", decidedAt: passed === null ? null : now },
        });
        return true;
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return false; // the other person's submit got here first
        throw e;
      }
    };
    const tell = (title: string, body: string, type: string) =>
      Promise.all([match.userAId, match.userBId].map((userId) => this.prisma.notification.create({ data: { userId, type, title, body } })));
    const log = (outcome: string) =>
      this.audit.record({
        actorId: "system",
        action: "COMPATIBILITY_EVALUATED",
        targetType: "Match",
        targetId: match.id,
        metadata: { outcome, reasons: res.reasons, counts: res.counts },
      });

    if (res.passed) {
      if (!(await record(true, "Met the requirements for the next stage."))) return;
      await this.prisma.match.updateMany({ where: { id: match.id, status: "ACTIVE" }, data: { stage: "NEXT_STAGE" } });
      await tell("You have reached the next stage", "Your expectations are compatible enough to move forward. Open your match to see how they compare.", "MATCH_NEXT_STAGE");
      await log("PASSED");
    } else if (settings.requireReviewOnFail) {
      if (!(await record(null, "Did not meet the requirements. Awaiting review."))) return;
      await this.prisma.match.updateMany({ where: { id: match.id, status: "ACTIVE" }, data: { stage: "COMPATIBILITY_REVIEW" } });
      await tell("Your expectations are being compared", "Our team may take a look before the next step. There is nothing you need to do.", "MATCH_UNDER_REVIEW");
      await log("NEEDS_REVIEW");
    } else {
      if (!(await record(false, NOT_MET_NOTE))) return;
      await this.close(match, "compatibility", "system");
      await log("CLOSED");
    }
  }

  /** Closing for compatibility is neutral for both people, permanent for the pair, and rests nobody. */
  async close(match: Match, why: string, by: string) {
    await this.matchmaking.closeAndExclude(match.id, match.userAId, match.userBId, why, by, NOT_MET_NOTE);
    for (const userId of [match.userAId, match.userBId]) {
      await this.prisma.notification.create({
        data: {
          userId,
          type: "MATCH_CLOSED",
          title: "This pairing is closed",
          body: `${NOT_MET_NOTE} You remain eligible for other matches.`,
        },
      });
    }
  }
}

export { COMPAT_DEFAULTS };
