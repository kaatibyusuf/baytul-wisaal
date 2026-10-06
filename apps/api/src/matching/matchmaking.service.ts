import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MatchStage } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { Filters, Level, QUESTIONS } from "./questionnaire";
import { Candidate, RoundPlan, ageOn, pairKey, planRound } from "./rules";
import { MatchingSettings, loadMatchingSettings } from "./settings";

const DAY = 24 * 60 * 60 * 1000;
const CLOSED_NOTE = "This pairing has been closed.";

const ref = (id: string) => `User ${id.slice(-6)}`;

const WHAT_NEXT: Record<MatchStage, string> = {
  EXPECTATIONS_PENDING: "Write what you are seeking in a spouse. Your words stay private until you have both submitted.",
  RESPONSE_PENDING: "Read what the other person is seeking and respond to each point, explaining your position.",
  COMPATIBILITY_REVIEW: "Your expectations are being compared. Our team may take a look before the next step. Nothing is needed from you.",
  NEXT_STAGE: "Your expectations are compatible enough to move forward. The later steps open in a future release.",
};

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsSvc: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── Building the pool ─────────────────────────

  /** Everyone who can be matched right now, with everything the rules need. */
  private async candidates(settings: MatchingSettings): Promise<Candidate[]> {
    const now = Date.now();
    const sets = (await this.prisma.preferenceSet.findMany({
      where: { submittedAt: { not: null }, availability: "AVAILABLE" },
    })).filter((s) => !s.availableAfter || s.availableAfter.getTime() <= now);
    if (sets.length === 0) return [];

    const ids = sets.map((s) => s.userId);
    const users = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } } })).map((u) => [u.id, u]));
    const profiles = new Map((await this.prisma.profile.findMany({ where: { userId: { in: ids } } })).map((p) => [p.userId, p]));
    const completed = settings.requireProgramme
      ? new Set((await this.prisma.enrollment.findMany({ where: { userId: { in: ids }, status: "COMPLETED" } })).map((e) => e.userId))
      : null;
    const busy = new Set(
      (await this.prisma.match.findMany({ where: { status: "ACTIVE" } })).flatMap((m) => [m.userAId, m.userBId]),
    );
    const items = await this.prisma.preferenceItem.findMany({ where: { setId: { in: sets.map((s) => s.id) } } });

    const out: Candidate[] = [];
    for (const set of sets) {
      const user = users.get(set.userId);
      const profile = profiles.get(set.userId);
      if (!user || !profile) continue;
      if (user.status !== "ACTIVE" || !user.emailVerifiedAt) continue;
      if (completed && !completed.has(set.userId)) continue;
      if (busy.has(set.userId)) continue;

      const mine = items.filter((i) => i.setId === set.id);
      // A half-saved form is never matchable
      if (mine.length !== QUESTIONS.length || !set.selfAnswers || !set.hardFilters) continue;

      const seek: Candidate["seek"] = {};
      for (const i of mine) seek[i.key] = { accept: ((i.value as { accept?: string[] })?.accept ?? []) as string[], level: i.level as Level };

      out.push({
        userId: set.userId,
        gender: profile.gender,
        age: ageOn(profile.dateOfBirth, new Date(now)),
        maritalStatus: profile.maritalStatus,
        country: profile.country,
        region: profile.region,
        self: set.selfAnswers as Record<string, string>,
        seek,
        filters: set.hardFilters as unknown as Filters,
        waitingSince: set.submittedAt!,
      });
    }
    return out;
  }

  private async exclusions(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.matchExclusion.findMany({ where: { userLowId: { in: ids } } });
    return new Set(rows.map((r) => pairKey(r.userLowId, r.userHighId)));
  }

  private async hasActive(userId: string): Promise<boolean> {
    return (
      !!(await this.prisma.match.findFirst({ where: { userAId: userId, status: "ACTIVE" } })) ||
      !!(await this.prisma.match.findFirst({ where: { userBId: userId, status: "ACTIVE" } }))
    );
  }

  async plan(): Promise<RoundPlan> {
    const settings = await loadMatchingSettings(this.settingsSvc);
    const pool = await this.candidates(settings);
    const excluded = await this.exclusions(pool.map((c) => c.userId));
    return planRound(pool, { isExcluded: (a, b) => excluded.has(pairKey(a, b)), minScore: settings.minScore });
  }

  // ───────────────────────── Creating matches (PRD section 20) ─────────────────────────

  async run(actor: AuthUser, dryRun: boolean) {
    const plan = await this.plan();
    if (dryRun) {
      return {
        dryRun: true,
        created: 0,
        proposed: plan.pairs.map((p) => ({ a: ref(p.a), b: ref(p.b), score: p.score })),
        stats: plan.stats,
      };
    }

    let created = 0;
    for (const p of plan.pairs) {
      // Last check before committing, in case someone was matched since the plan was made
      if ((await this.hasActive(p.a)) || (await this.hasActive(p.b))) continue;
      const match = await this.prisma.match.create({ data: { userAId: p.a, userBId: p.b } });
      for (const userId of [p.a, p.b]) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: "MATCH_CREATED",
            title: "You have a new match",
            body: "We have found someone whose expectations may fit yours. Open Matches to read their introduction.",
          },
        });
      }
      await this.audit.record({
        actorId: actor.id,
        action: "MATCH_CREATED",
        targetType: "Match",
        targetId: match.id,
        metadata: { score: p.score },
      });
      created++;
    }
    return { dryRun: false, created, proposed: [], stats: plan.stats };
  }

  // ───────────────────────── What a person sees (PRD section 25) ─────────────────────────

  async listForUser(userId: string) {
    const all = [
      ...(await this.prisma.match.findMany({ where: { userAId: userId } })),
      ...(await this.prisma.match.findMany({ where: { userBId: userId } })),
    ].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());

    let current: unknown = null;
    const history: unknown[] = [];
    for (const m of all) {
      if (m.status === "ACTIVE") {
        const otherId = m.userAId === userId ? m.userBId : m.userAId;
        const p = await this.prisma.profile.findUnique({ where: { userId: otherId } });
        current = {
          id: m.id,
          stage: m.stage,
          createdAt: m.createdAt,
          whatNext: WHAT_NEXT[m.stage],
          // Basic introduction only: no photo, contact details or date of birth at this stage
          introduction: p && {
            name: p.preferredName || p.fullName.split(/\s+/)[0],
            age: ageOn(p.dateOfBirth, new Date()),
            location: [p.region, p.country].filter(Boolean).join(", ") || p.location,
            education: p.education,
            occupation: p.occupation,
            maritalStatus: p.maritalStatus,
          },
        };
      } else {
        // Closed pairings show nothing about the other person
        history.push({ id: m.id, status: m.status, stage: m.stage, createdAt: m.createdAt, closedAt: m.closedAt, note: m.closureNote });
      }
    }
    return { current, history };
  }

  // ───────────────────────── Closing a pairing ─────────────────────────

  /**
   * Closing a pairing is permanent for that pair (PRD rule 9), and the person who withdrew rests
   * for a few days, so matches cannot be browsed by closing them one after another.
   */
  async withdraw(userId: string, matchId: string, reason?: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match || (match.userAId !== userId && match.userBId !== userId)) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "Match not found." });
    }
    if (match.status !== "ACTIVE") {
      throw new ConflictException({ code: "ALREADY_CLOSED", message: "This pairing is already closed." });
    }
    const settings = await loadMatchingSettings(this.settingsSvc);
    const otherId = match.userAId === userId ? match.userBId : match.userAId;

    await this.closeAndExclude(match.id, match.userAId, match.userBId, `withdrawn:${userId}`, userId);
    await this.prisma.preferenceSet.update({
      where: { userId },
      data: { availableAfter: new Date(Date.now() + settings.withdrawCooldownDays * DAY) },
    });
    await this.prisma.notification.create({
      data: {
        userId: otherId,
        type: "MATCH_CLOSED",
        title: "A pairing has been closed",
        body: "This pairing is now closed. You remain eligible for other matches.",
      },
    });
    await this.audit.record({
      actorId: userId,
      action: "MATCH_WITHDRAWN",
      targetType: "Match",
      targetId: match.id,
      reason: reason?.slice(0, 500),
    });
    return { ok: true, availableAfter: new Date(Date.now() + settings.withdrawCooldownDays * DAY) };
  }

  /** Closes a pairing and makes it permanent: the same two people are never matched again (PRD rule 9). */
  async closeAndExclude(matchId: string, a: string, b: string, why: string, by: string, note: string = CLOSED_NOTE) {
    const [low, high] = a < b ? [a, b] : [b, a];
    await this.prisma.match.update({ where: { id: matchId }, data: { status: "CLOSED", closedAt: new Date(), closureNote: note } });
    try {
      await this.prisma.matchExclusion.create({ data: { userLowId: low, userHighId: high, reason: why, createdBy: by } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // already excluded
    }
  }

  /** Administrators can stop two people ever being matched (PRD section 33). */
  async excludePair(actor: AuthUser, emailA: string, emailB: string, reason?: string) {
    if (emailA === emailB) throw new BadRequestException({ code: "SAME_USER", message: "Choose two different people." });
    const a = await this.prisma.user.findUnique({ where: { email: emailA } });
    const b = await this.prisma.user.findUnique({ where: { email: emailB } });
    if (!a || !b) throw new NotFoundException({ code: "NOT_FOUND", message: "One of those accounts was not found." });

    const together = (await this.prisma.match.findMany({ where: { userAId: a.id, status: "ACTIVE" } })).find((m) => m.userBId === b.id)
      ?? (await this.prisma.match.findMany({ where: { userAId: b.id, status: "ACTIVE" } })).find((m) => m.userBId === a.id);

    if (together) {
      await this.closeAndExclude(together.id, a.id, b.id, reason ?? "admin", actor.id);
      for (const userId of [a.id, b.id]) {
        await this.prisma.notification.create({
          data: { userId, type: "MATCH_CLOSED", title: "A pairing has been closed", body: "This pairing is now closed. You remain eligible for other matches." },
        });
      }
    } else {
      const [low, high] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      try {
        await this.prisma.matchExclusion.create({ data: { userLowId: low, userHighId: high, reason: reason ?? "admin", createdBy: actor.id } });
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
      }
    }
    await this.audit.record({
      actorId: actor.id,
      action: "MATCH_EXCLUDED",
      targetType: "User",
      targetId: a.id,
      reason,
      metadata: { other: b.id, closedActiveMatch: !!together },
    });
    return { ok: true, closedActiveMatch: !!together };
  }
}
