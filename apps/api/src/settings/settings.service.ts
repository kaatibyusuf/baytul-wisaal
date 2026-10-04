import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Thresholds and rules live in the SystemSetting table so administrators can change them
 * without a deploy (PRD section 15: "do not hard-code them"). The values below are only
 * the fallbacks used when no setting has been stored.
 */
@Injectable()
export class SettingsService {
  private cache = new Map<string, { value: unknown; at: number }>();
  private readonly ttlMs = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value as T;
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    const value = (row ? (row.value as T) : fallback) ?? fallback;
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  clearCache() {
    this.cache.clear();
  }
}
