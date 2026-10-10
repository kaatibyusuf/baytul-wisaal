import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role, UserStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/decorators";
import { MatchmakingService } from "../matching/matchmaking.service";
import { ageOn } from "../matching/rules";
import { ProgrammeService } from "../programme/programme.service";
import { PrismaService } from "../prisma/prisma.service";

const PAGE_SIZE = 25;
const DAY = 24 * 60 * 60 * 1000;

const notFound = () => new NotFoundException({ code: "NOT_FOUND", message: "That account was not found." });

@Injectable()
export class UsersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly matchmaking: MatchmakingService,
    private readonly programme: ProgrammeService,
  ) {}

  // ───────────────────────── Finding people ─────────────────────────

  async list(q: { q?: string; status?: string; role?: string; page?: string }) {
    const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
    const where: Record<string, unknown> = {};
    if (q.status && q.status in UserStatus) where.status = q.status;
    if (q.role && q.role in Role) where.role = q.role;

    const term = q.q?.trim().slice(0, 100);
    if (term) {
      const byName = await this.prisma.profile.findMany({ where: { fullName: { contains: term, mode: "insensitive" } }, take: 50 });
      where.OR = [{ email: { contains: term.toLowerCase() } }, { id: { in: byName.map((p) => p.userId) } }];
    }

    const total = await this.prisma.user.count({ where });
    const users = await this.prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });
    const ids = users.map((u) => u.id);
    const profiles = new Map((await this.prisma.profile.findMany({ where: { userId: { in: ids } } })).map((p) => [p.userId, p]));
    const enrollments = new Map((await this.prisma.enrollment.findMany({ where: { userId: { in: ids } } })).map((e) => [e.userId, e.status]));

    return {
      page,
      pageSize: PAGE_SIZE,
      total,
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        status: u.status,
        emailVerified: !!u.emailVerifiedAt,
        createdAt: u.createdAt,
        fullName: profiles.get(u.id)?.fullName ?? null,
        programme: enrollments.get(u.id) ?? "NOT_STARTED",
      })),
    };
  }

  /**
   * What an administrator needs to look after an account, and no more. Private answers,
   * assessment responses and preferences are never shown here (PRD section 34).
   */
  async detail(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { profile: true } });
    if (!user) throw notFound();
    const p = user.profile;

    // Before a programme exists there is nothing to summarise, and the account should still open
    const programme = await this.programme.summaryFor(id).catch((e) => {
      if ((e as { response?: { code?: string } }).response?.code === "NO_PROGRAMME") return null;
      throw e;
    });
    const prefs = await this.prisma.preferenceSet.findUnique({ where: { userId: id } });
    const hasMatch =
      !!(await this.prisma.match.findFirst({ where: { userAId: id, status: "ACTIVE" } })) ||
      !!(await this.prisma.match.findFirst({ where: { userBId: id, status: "ACTIVE" } }));

    const mine = await this.prisma.auditLog.findMany({ where: { OR: [{ actorId: id }, { targetId: id }] }, orderBy: { createdAt: "desc" }, take: 20 });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt,
      lockedUntil: user.lockedUntil,
      profile: p && {
        fullName: p.fullName,
        gender: p.gender,
        age: ageOn(p.dateOfBirth, new Date()),
        maritalStatus: p.maritalStatus,
        location: [p.region, p.country].filter(Boolean).join(", ") || p.location,
        phone: p.phone,
      },
      programme,
      preferences: { submitted: !!prefs?.submittedAt, availability: prefs?.availability ?? null },
      hasActiveMatch: hasMatch,
      recent: mine.map((a) => ({ createdAt: a.createdAt, action: a.action, reason: a.reason, asActor: a.actorId === id })),
    };
  }

  // ───────────────────────── Who may manage whom ─────────────────────────

  /**
   * Nobody manages their own account here. Administrators look after ordinary members and
   * moderators. Looking after another administrator takes a super administrator.
   */
  private async target(actor: AuthUser, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound();
    if (user.id === actor.id) {
      throw new ForbiddenException({ code: "OWN_ACCOUNT", message: "You cannot change your own account here." });
    }
    const manageable = actor.role === Role.SUPER_ADMIN || user.role === Role.USER || user.role === Role.MODERATOR;
    if (!manageable) {
      throw new ForbiddenException({ code: "NOT_PERMITTED", message: "Only a super administrator can manage another administrator." });
    }
    return user;
  }

  // ───────────────────────── Actions ─────────────────────────

  async setStatus(actor: AuthUser, id: string, status: "ACTIVE" | "RESTRICTED" | "SUSPENDED", reason: string) {
    const user = await this.target(actor, id);
    if (user.status === status) throw new ConflictException({ code: "NO_CHANGE", message: "The account already has that status." });
    if (status === "ACTIVE" && !user.emailVerifiedAt) {
      throw new ConflictException({ code: "NOT_VERIFIED", message: "Verify the email address first." });
    }

    await this.prisma.user.update({ where: { id }, data: { status } });

    let closedMatch = false;
    if (status === "SUSPENDED") {
      // Signed out everywhere, straight away
      await this.prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      // The other person must not be left waiting on someone who can no longer take part
      const match =
        (await this.prisma.match.findFirst({ where: { userAId: id, status: "ACTIVE" } })) ??
        (await this.prisma.match.findFirst({ where: { userBId: id, status: "ACTIVE" } }));
      if (match) {
        await this.matchmaking.closeAndExclude(match.id, match.userAId, match.userBId, "account-suspended", actor.id);
        const otherId = match.userAId === id ? match.userBId : match.userAId;
        await this.prisma.notification.create({
          data: { userId: otherId, type: "MATCH_CLOSED", title: "A pairing has been closed", body: "This pairing is now closed. You remain eligible for other matches." },
        });
        closedMatch = true;
      }
    } else if (status === "RESTRICTED") {
      await this.prisma.notification.create({
        data: { userId: id, type: "ACCOUNT_RESTRICTED", title: "A restriction has been placed on matching", body: "You can keep using the programme, but you will not be matched for now. Please contact support." },
      });
    }

    await this.audit.record({
      actorId: actor.id,
      action: "USER_STATUS_CHANGED",
      targetType: "User",
      targetId: id,
      reason,
      metadata: { from: user.status, to: status, closedMatch },
    });
    return { ok: true, closedMatch };
  }

  async verifyEmail(actor: AuthUser, id: string, reason: string) {
    const user = await this.target(actor, id);
    if (user.emailVerifiedAt) throw new ConflictException({ code: "NO_CHANGE", message: "This email is already verified." });
    await this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: new Date(), ...(user.status === "PENDING_VERIFICATION" ? { status: "ACTIVE" } : {}) },
    });
    await this.audit.record({ actorId: actor.id, action: "USER_EMAIL_VERIFIED_MANUALLY", targetType: "User", targetId: id, reason });
    return { ok: true };
  }

  /** Super administrators only. The last super administrator can never be removed. */
  async setRole(actor: AuthUser, id: string, role: Role, reason: string) {
    const user = await this.target(actor, id);
    if (user.role === role) throw new ConflictException({ code: "NO_CHANGE", message: "The account already has that role." });
    if (user.role === Role.SUPER_ADMIN) {
      const supers = await this.prisma.user.count({ where: { role: Role.SUPER_ADMIN } });
      if (supers <= 1) throw new ConflictException({ code: "LAST_SUPER_ADMIN", message: "There must always be at least one super administrator." });
    }
    await this.prisma.user.update({ where: { id }, data: { role } });
    await this.audit.record({ actorId: actor.id, action: "USER_ROLE_CHANGED", targetType: "User", targetId: id, reason, metadata: { from: user.role, to: role } });
    return { ok: true };
  }

  /** For someone whose programme ran out of time. */
  async extendProgramme(actor: AuthUser, id: string, days: number, reason: string) {
    await this.target(actor, id);
    const enrollment = await this.prisma.enrollment.findFirst({ where: { userId: id } });
    if (!enrollment) throw new ConflictException({ code: "NOT_ENROLLED", message: "This person has not started the programme." });
    if (enrollment.status === "COMPLETED") throw new ConflictException({ code: "NO_CHANGE", message: "The programme is already complete." });

    const from = Math.max(enrollment.dueAt?.getTime() ?? 0, Date.now());
    const dueAt = new Date(from + days * DAY);
    await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { dueAt, ...(enrollment.status === "EXPIRED" ? { status: "IN_PROGRESS" } : {}) },
    });
    await this.audit.record({
      actorId: actor.id,
      action: "PROGRAMME_EXTENDED",
      targetType: "Enrollment",
      targetId: enrollment.id,
      reason,
      metadata: { days, wasExpired: enrollment.status === "EXPIRED" },
    });
    return { ok: true, dueAt };
  }
}
