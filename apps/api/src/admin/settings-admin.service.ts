import { HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators";
import { PrismaService } from "../prisma/prisma.service";
import { SETTING_BY_KEY, SETTING_DEFS, validateSettingValue } from "../settings/registry";
import { SettingsService } from "../settings/settings.service";

@Injectable()
export class SettingsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  private async currentValue(key: string): Promise<number> {
    const d = SETTING_BY_KEY.get(key)!;
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return typeof row?.value === "number" ? row.value : d.default;
  }

  async list() {
    const out = [];
    for (const d of SETTING_DEFS) {
      const value = await this.currentValue(d.key);
      out.push({ ...d, value, isDefault: value === d.default });
    }
    return out;
  }

  async update(actor: AuthUser, key: string, value: number, reason: string) {
    const d = SETTING_BY_KEY.get(key);
    if (!d) throw new NotFoundException({ code: "NOT_FOUND", message: "That setting does not exist." });

    // Read current values for the pair checks
    const values = new Map<string, number>();
    for (const x of SETTING_DEFS) values.set(x.key, await this.currentValue(x.key));
    const v = validateSettingValue(d, value, (k) => values.get(k) ?? SETTING_BY_KEY.get(k)!.default);
    if (!v.ok) throw new HttpException({ code: "INVALID_VALUE", message: v.message }, 400);

    const before = values.get(key)!;
    await this.prisma.systemSetting.upsert({ where: { key }, create: { key, value: v.value }, update: { value: v.value } });
    this.settings.clearCache();
    await this.audit.record({
      actorId: actor.id,
      action: "SETTING_CHANGED",
      targetType: "SystemSetting",
      targetId: key,
      reason,
      metadata: { from: before, to: v.value },
    });
    return { key, value: v.value, previous: before };
  }
}
