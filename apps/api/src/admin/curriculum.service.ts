import { HttpException, Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators";
import { CurriculumError, exportCurriculum, importCurriculum, validateCurriculum } from "../programme/curriculum";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async export() {
    const c = await exportCurriculum(this.prisma);
    if (!c) throw new HttpException({ code: "NO_PROGRAMME", message: "There is no active programme to export." }, 404);
    return c;
  }

  async import(actor: AuthUser, raw: unknown, dryRun: boolean) {
    const v = validateCurriculum(raw);
    if (!v.ok) throw new HttpException({ code: "CURRICULUM_INVALID", message: "The curriculum has problems.", problems: v.problems }, 400);

    try {
      const summary = dryRun
        ? await importCurriculum(this.prisma, v.value, true)
        : await this.prisma.$transaction((tx) => importCurriculum(tx, v.value, false), { timeout: 60_000 });

      if (!dryRun) {
        await this.audit.record({
          actorId: actor.id,
          action: "CURRICULUM_IMPORTED",
          targetType: "Programme",
          targetId: v.value.programme.slug,
          metadata: { days: summary.days, activities: summary.activities, scenarios: summary.scenarios },
        });
      }
      return summary;
    } catch (e) {
      if (e instanceof CurriculumError) throw new HttpException({ code: "CURRICULUM_INVALID", message: e.message, problems: e.problems }, 400);
      throw e;
    }
  }
}
