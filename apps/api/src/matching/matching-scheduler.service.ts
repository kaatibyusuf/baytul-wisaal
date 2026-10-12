import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { MatchmakingService } from "./matchmaking.service";
import { loadMatchingSettings } from "./settings";

const CHECK_MS = 60_000;
const LAST_RUN_KEY = "matching.lastAutoRun";
const SYSTEM: AuthUser = { id: "system", role: Role.ADMIN, sessionId: "system" };

/**
 * Runs matchmaking on a schedule when an administrator turns it on (matching.autoRunMinutes).
 * It does exactly what the admin button does, with the same rules and the same safeguards.
 */
@Injectable()
export class MatchingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MatchingScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsSvc: SettingsService,
    private readonly matchmaking: MatchmakingService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.runDue(), CHECK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runDue(): Promise<{ ran: boolean; reason?: string; created?: number }> {
    try {
      const settings = await loadMatchingSettings(this.settingsSvc);
      if (!settings.autoRunMinutes) return { ran: false, reason: "off" };

      const last = await this.prisma.systemSetting.findUnique({ where: { key: LAST_RUN_KEY } });
      const lastMs = typeof last?.value === "number" ? last.value : 0;
      const now = Date.now();
      if (now - lastMs < settings.autoRunMinutes * 60_000) return { ran: false, reason: "not due" };

      // Claim this slot before running, so a second server in the same minute skips it
      await this.prisma.systemSetting.upsert({ where: { key: LAST_RUN_KEY }, create: { key: LAST_RUN_KEY, value: now }, update: { value: now } });

      const result = await this.matchmaking.run(SYSTEM, false);
      await this.audit.record({
        actorId: "system",
        action: "MATCHMAKING_AUTO_RUN",
        targetType: "Matchmaking",
        targetId: "scheduled",
        metadata: { created: result.created, candidates: result.stats.candidates, unmatched: result.stats.unmatched },
      });
      if (result.created > 0) this.log.log(`Automatic matching created ${result.created} match${result.created === 1 ? "" : "es"}.`);
      return { ran: true, created: result.created };
    } catch (e) {
      this.log.error(`Automatic matching failed: ${(e as Error).message}`);
      return { ran: false, reason: "error" };
    }
  }
}
