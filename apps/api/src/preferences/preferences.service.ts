import { ConflictException, ForbiddenException, HttpException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { loadMatchingSettings } from "../matching/settings";
import {
  CATEGORIES,
  LEVELS,
  QUESTIONNAIRE_VERSION,
  QUESTIONS,
  validateSubmission,
} from "../matching/questionnaire";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";

@Injectable()
export class PreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsSvc: SettingsService,
    private readonly audit: AuditService,
  ) {}

  private async eligible(userId: string, requireProgramme: number): Promise<boolean> {
    if (!requireProgramme) return true;
    const done = await this.prisma.enrollment.findFirst({ where: { userId, status: "COMPLETED" } });
    return !!done;
  }

  async hasActiveMatch(userId: string): Promise<boolean> {
    const asA = await this.prisma.match.findFirst({ where: { userAId: userId, status: "ACTIVE" } });
    if (asA) return true;
    const asB = await this.prisma.match.findFirst({ where: { userBId: userId, status: "ACTIVE" } });
    return !!asB;
  }

  /** The questionnaire, the person's current answers, and whether they may fill it in yet. */
  async getForm(userId: string) {
    const settings = await loadMatchingSettings(this.settingsSvc);
    const set = await this.prisma.preferenceSet.findUnique({ where: { userId } });
    const items = set ? await this.prisma.preferenceItem.findMany({ where: { setId: set.id } }) : [];
    const eligible = await this.eligible(userId, settings.requireProgramme);

    const seek: Record<string, { accept: string[]; level: string; note?: string }> = {};
    for (const i of items) {
      seek[i.key] = { accept: ((i.value as { accept?: string[] })?.accept ?? []) as string[], level: i.level, ...(i.note ? { note: i.note } : {}) };
    }

    return {
      version: QUESTIONNAIRE_VERSION,
      categories: CATEGORIES,
      questions: QUESTIONS,
      levels: LEVELS,
      eligible,
      ineligibleReason: eligible ? null : "Finish the marriage-readiness programme first.",
      nonNegotiableMax: settings.maxNonNegotiable,
      submittedAt: set?.submittedAt ?? null,
      availability: set?.availability ?? "AVAILABLE",
      availableAfter: set?.availableAfter ?? null,
      hasActiveMatch: await this.hasActiveMatch(userId),
      answers: set?.submittedAt
        ? { self: set.selfAnswers ?? {}, seek, filters: set.hardFilters ?? null }
        : null,
    };
  }

  async save(userId: string, body: unknown) {
    const settings = await loadMatchingSettings(this.settingsSvc);
    if (!(await this.eligible(userId, settings.requireProgramme))) {
      throw new ForbiddenException({ code: "NOT_ELIGIBLE", message: "Finish the marriage-readiness programme first." });
    }
    // Changing what you want while someone is considering you would be unfair to them.
    if (await this.hasActiveMatch(userId)) {
      throw new ConflictException({
        code: "HAS_ACTIVE_MATCH",
        message: "You have a current match. You can update your preferences once that pairing is complete.",
      });
    }

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const v = validateSubmission(body, {
      maxNonNegotiable: settings.maxNonNegotiable,
      profile: { country: profile?.country, region: profile?.region },
    });
    if (!v.ok) throw new HttpException({ code: "FORM_INVALID", message: "Some answers need attention.", errors: v.errors }, 400);

    const existing = await this.prisma.preferenceSet.findUnique({ where: { userId } });
    const data = {
      selfAnswers: v.value.self as Prisma.InputJsonObject,
      hardFilters: v.value.filters as unknown as Prisma.InputJsonObject,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
    };
    const set = await this.prisma.preferenceSet.upsert({
      where: { userId },
      create: { userId, ...data, submittedAt: new Date() },
      // Editing keeps the original submission time, so it does not push anyone back in the queue.
      update: { ...data, submittedAt: existing?.submittedAt ?? new Date() },
    });

    await this.prisma.$transaction([
      this.prisma.preferenceItem.deleteMany({ where: { setId: set.id } }),
      this.prisma.preferenceItem.createMany({
        data: QUESTIONS.map((q) => ({
          setId: set.id,
          category: q.category,
          key: q.key,
          level: v.value.seek[q.key].level,
          value: { accept: v.value.seek[q.key].accept },
          note: v.value.seek[q.key].note ?? null,
        })),
      }),
    ]);

    await this.audit.record({ actorId: userId, action: "PREFERENCES_SUBMITTED", targetType: "PreferenceSet", targetId: set.id });
    return this.getForm(userId);
  }

  async setAvailability(userId: string, availability: "AVAILABLE" | "PAUSED") {
    const set = await this.prisma.preferenceSet.findUnique({ where: { userId } });
    if (!set?.submittedAt) {
      throw new ConflictException({ code: "NO_PREFERENCES", message: "Complete the preferences form first." });
    }
    await this.prisma.preferenceSet.update({ where: { userId }, data: { availability } });
    return this.getForm(userId);
  }
}
