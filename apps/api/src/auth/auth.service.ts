import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthTokenType, User, UserStatus } from "@prisma/client";
import { hash, verify } from "@node-rs/argon2";
import { AuditService } from "../audit/audit.service";
import { hashToken, newToken } from "../common/crypto";
import { AuthUser } from "../common/decorators";
import { env } from "../config/env";
import { EmailService } from "../email/email.service";
import { templates } from "../email/templates";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const MIN_AGE = 18;
const MAX_AGE = 100;

const invalidCredentials = () =>
  new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
const invalidToken = () =>
  new BadRequestException({ code: "INVALID_TOKEN", message: "This link is invalid or has expired." });

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

let dummyHash: Promise<string> | undefined;
/** Verified against when the email is unknown, so response time does not reveal which emails exist. */
const getDummyHash = () => (dummyHash ??= hash("timing-equaliser-not-a-real-password"));

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── Registration ─────────────────────────

  async register(dto: RegisterDto): Promise<void> {
    const dob = this.parseAdultDob(dto.dateOfBirth);
    // Always hash first so existing and new emails take similar time.
    const passwordHash = await hash(dto.password);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      const raw = await this.issueToken(existing.id, AuthTokenType.PASSWORD_RESET, env.resetTokenHours * HOUR);
      await this.safeSend(dto.email, templates.accountExists(this.firstName(dto), this.resetUrl(raw)));
      return;
    }

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          profile: {
            create: {
              fullName: dto.fullName,
              preferredName: dto.preferredName || null,
              gender: dto.gender,
              dateOfBirth: dob,
              maritalStatus: dto.maritalStatus,
            },
          },
        },
      });
    } catch (e) {
      // Two simultaneous sign-ups with the same email: the loser behaves like the "existing" case.
      if ((e as { code?: string }).code === "P2002") return;
      throw e;
    }

    const raw = await this.issueToken(user.id, AuthTokenType.EMAIL_VERIFICATION, env.verifyTokenHours * HOUR);
    await this.safeSend(user.email, templates.verifyEmail(this.firstName(dto), this.verifyUrl(raw)));
    await this.audit.record({
      actorId: user.id,
      action: "USER_REGISTERED",
      targetType: "User",
      targetId: user.id,
    });
  }

  private parseAdultDob(value: string): Date {
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) {
      throw new BadRequestException({ code: "INVALID_DOB", message: "Enter a valid date of birth." });
    }
    const now = new Date();
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const hadBirthday =
      now.getUTCMonth() > dob.getUTCMonth() ||
      (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() >= dob.getUTCDate());
    if (!hadBirthday) age -= 1;
    if (age < MIN_AGE) {
      throw new BadRequestException({
        code: "UNDERAGE",
        message: `You must be at least ${MIN_AGE} years old to register.`,
      });
    }
    if (age > MAX_AGE) {
      throw new BadRequestException({ code: "INVALID_DOB", message: "Enter a valid date of birth." });
    }
    return dob;
  }

  // ───────────────────────── Login / sessions ─────────────────────────

  /** Used by the passport-local strategy. Throws on any failure. */
  async validateCredentials(rawEmail: string, password: string): Promise<User> {
    const email = String(rawEmail ?? "").trim().toLowerCase();
    const user = email ? await this.prisma.user.findUnique({ where: { email } }) : null;

    if (!user) {
      await this.safeVerify(await getDummyHash(), String(password ?? ""));
      throw invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        { code: "TOO_MANY_ATTEMPTS", message: "Too many failed attempts. Please try again in a few minutes." },
        429,
      );
    }

    const ok = await this.safeVerify(user.passwordHash, String(password ?? ""));
    if (!ok) {
      const count = user.failedLoginCount + 1;
      if (count >= env.maxFailedLogins) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + env.lockMinutes * MINUTE) },
        });
        await this.audit.record({
          actorId: user.id,
          action: "ACCOUNT_TEMPORARILY_LOCKED",
          targetType: "User",
          targetId: user.id,
          reason: "Repeated failed sign-in attempts",
        });
      } else {
        await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: count } });
      }
      throw invalidCredentials();
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }
    return user;
  }

  /** Called after credentials are valid. Enforces account state, then opens a session. */
  async startSession(user: User, ctx: RequestContext): Promise<string> {
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: "ACCOUNT_SUSPENDED",
        message: "This account is suspended. Please contact support.",
      });
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please confirm your email address before signing in.",
      });
    }
    const token = newToken();
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        ip: ctx.ip?.slice(0, 64),
        userAgent: ctx.userAgent?.slice(0, 255),
        expiresAt: new Date(Date.now() + env.sessionTtlDays * DAY),
      },
    });
    return token;
  }

  /** Resolves a cookie token to the signed-in user, or null. Used by the session strategy. */
  async userForSessionToken(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.revokedAt) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now) return null;
    if (now - session.lastSeenAt.getTime() > env.sessionIdleDays * DAY) return null;
    const { user } = session;
    if (user.status === UserStatus.SUSPENDED || !user.emailVerifiedAt) return null;

    if (now - session.lastSeenAt.getTime() > MINUTE) {
      await this.prisma.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    return { id: user.id, role: user.role, sessionId: session.id };
  }

  async endSession(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ───────────────────────── Email verification ─────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const record = await this.findUsableToken(token, AuthTokenType.EMAIL_VERIFICATION);
    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) throw invalidToken();

    const data: { emailVerifiedAt: Date; status?: UserStatus } = {
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    };
    if (user.status === UserStatus.PENDING_VERIFICATION) data.status = UserStatus.ACTIVE;

    await this.prisma.$transaction([
      this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: user.id }, data }),
    ]);
  }

  /** Always succeeds from the caller's point of view, so it cannot be used to probe for emails. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user || user.emailVerifiedAt) return;
    await this.invalidateTokens(user.id, AuthTokenType.EMAIL_VERIFICATION);
    const raw = await this.issueToken(user.id, AuthTokenType.EMAIL_VERIFICATION, env.verifyTokenHours * HOUR);
    await this.safeSend(user.email, templates.verifyEmail(this.nameOf(user.profile), this.verifyUrl(raw)));
  }

  // ───────────────────────── Password recovery ─────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { profile: true } });
    if (!user) return;
    await this.invalidateTokens(user.id, AuthTokenType.PASSWORD_RESET);
    const raw = await this.issueToken(user.id, AuthTokenType.PASSWORD_RESET, env.resetTokenHours * HOUR);
    await this.safeSend(user.email, templates.passwordReset(this.nameOf(user.profile), this.resetUrl(raw)));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.findUsableToken(token, AuthTokenType.PASSWORD_RESET);
    const passwordHash = await hash(newPassword);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: now } }),
      // A password reset signs the user out everywhere.
      this.prisma.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    await this.audit.record({
      actorId: record.userId,
      action: "PASSWORD_RESET_COMPLETED",
      targetType: "User",
      targetId: record.userId,
    });
  }

  // ───────────────────────── Helpers ─────────────────────────

  private async issueToken(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
    const raw = newToken();
    await this.prisma.authToken.create({
      data: { userId, type, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return raw;
  }

  private async invalidateTokens(userId: string, type: AuthTokenType) {
    await this.prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  private async findUsableToken(raw: string, type: AuthTokenType) {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!record || record.type !== type || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw invalidToken();
    }
    return record;
  }

  private async safeVerify(hashed: string, password: string): Promise<boolean> {
    try {
      return await verify(hashed, password);
    } catch {
      return false;
    }
  }

  /** Email delivery problems must never reveal whether an account exists. Log and carry on. */
  private async safeSend(to: string, content: ReturnType<(typeof templates)["verifyEmail"]>) {
    try {
      await this.email.send(to, content);
    } catch (e) {
      this.logger.error(`Email to ${to} failed: ${(e as Error).message}`);
    }
  }

  private firstName(dto: RegisterDto): string {
    return (dto.preferredName || dto.fullName).split(/\s+/)[0];
  }

  private nameOf(profile: { fullName: string; preferredName: string | null } | null): string {
    if (!profile) return "there";
    return (profile.preferredName || profile.fullName).split(/\s+/)[0];
  }

  private verifyUrl = (raw: string) => `${env.appWebUrl}/verify-email?token=${encodeURIComponent(raw)}`;
  private resetUrl = (raw: string) => `${env.appWebUrl}/reset-password?token=${encodeURIComponent(raw)}`;
}
