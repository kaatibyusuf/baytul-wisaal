import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const PAGE_SIZE = 50;

/** Read-only by design. There is no way to edit or delete an entry (PRD section 36). */
@Injectable()
export class AuditAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: { action?: string; actorId?: string; targetId?: string; page?: string }) {
    const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
    const where: Record<string, unknown> = {};
    if (q.action?.trim()) where.action = q.action.trim().slice(0, 80);
    if (q.actorId?.trim()) where.actorId = q.actorId.trim().slice(0, 40);
    if (q.targetId?.trim()) where.targetId = q.targetId.trim().slice(0, 80);

    const total = await this.prisma.auditLog.count({ where });
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });

    // Show who did it in words
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id) => id !== "system"))];
    const actors = actorIds.length ? await this.prisma.user.findMany({ where: { id: { in: actorIds } } }) : [];
    const label = new Map(actors.map((u) => [u.id, u.email]));

    return {
      page,
      pageSize: PAGE_SIZE,
      total,
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        actorId: r.actorId,
        actor: r.actorId === "system" ? "System" : (label.get(r.actorId) ?? "Unknown account"),
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        metadata: r.metadata,
      })),
    };
  }
}
