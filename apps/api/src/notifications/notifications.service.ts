import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The person's own recent notifications, newest first. */
  async list(userId: string) {
    const rows = (await this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })).slice(0, 20);
    return {
      unread: rows.filter((r) => !r.readAt).length,
      items: rows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, readAt: r.readAt, createdAt: r.createdAt })),
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
