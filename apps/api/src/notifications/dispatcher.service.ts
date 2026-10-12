import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { env } from "../config/env";
import { EmailService } from "../email/email.service";
import { templates } from "../email/templates";
import { PrismaService } from "../prisma/prisma.service";

const SWEEP_MS = 60_000;
const MAX_ATTEMPTS = 5;
/** Only recent notifications are emailed, so switching this on never floods people with old news. */
const FRESH_MS = 24 * 60 * 60 * 1000;
const BATCH = 25;

/**
 * Emails a copy of each in-app notification (PRD section 32). Notifications are written as they
 * always were; this sweeps up the ones not yet emailed. Keeping it separate means no feature has
 * to know about email, and a failure never affects the thing that caused the notification.
 *
 * EMAIL_NOTIFICATIONS = auto (default): on when an email service is configured (RESEND_API_KEY)
 *                       on: always (in development the message prints in the API terminal)
 *                       off: never
 */
@Injectable()
export class NotificationDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(NotificationDispatcher.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.sendPending(), SWEEP_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private get enabled(): boolean {
    const mode = (process.env.EMAIL_NOTIFICATIONS ?? "auto").toLowerCase();
    if (mode === "on") return true;
    if (mode === "off") return false;
    return !!process.env.RESEND_API_KEY;
  }

  async sendPending(): Promise<{ sent: number; failed: number }> {
    if (!this.enabled || this.running) return { sent: 0, failed: 0 };
    this.running = true;
    let sent = 0;
    let failed = 0;
    try {
      const waiting = await this.prisma.notification.findMany({
        where: { emailedAt: null, emailAttempts: { lt: MAX_ATTEMPTS }, createdAt: { gte: new Date(Date.now() - FRESH_MS) } },
        orderBy: { createdAt: "asc" },
        take: BATCH,
      });

      for (const n of waiting) {
        const user = await this.prisma.user.findUnique({ where: { id: n.userId }, include: { profile: true } });
        // Nobody to write to: settle it so it is not retried forever
        if (!user || !user.emailVerifiedAt || user.status === "SUSPENDED") {
          await this.prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
          continue;
        }
        const name = (user.profile?.preferredName || user.profile?.fullName || "there").split(/\s+/)[0];
        try {
          await this.email.send(user.email, templates.notification(name, n.title, n.body, `${env.appWebUrl}/dashboard`));
          await this.prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
          sent++;
        } catch (e) {
          failed++;
          this.log.warn(`Email for notification ${n.id} failed (attempt ${n.emailAttempts + 1}): ${(e as Error).message.slice(0, 120)}`);
          await this.prisma.notification.update({ where: { id: n.id }, data: { emailAttempts: n.emailAttempts + 1 } });
        }
      }
    } catch (e) {
      this.log.error(`Notification email sweep failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
    return { sent, failed };
  }
}
