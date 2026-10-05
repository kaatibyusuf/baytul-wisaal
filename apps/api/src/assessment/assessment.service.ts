import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ActivityStatus, AssessmentSession, IntegrityEventType, Prisma } from "@prisma/client";
import { randomBytes, timingSafeEqual } from "crypto";
import { hashToken, newToken } from "../common/crypto";
import { ProgrammeService } from "../programme/programme.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { EventDto } from "./dto";
import { EvaluationService } from "./evaluation.service";
import {
  ScenarioBody,
  ScenarioPart,
  composeAnswerText,
  fastestPlausibleSeconds,
  integrityScore,
  renderScenario,
  validateParts,
  wordsIn,
} from "./rules";
import { loadAssessmentSettings } from "./settings";

const MAX_EVENTS_PER_SESSION = 300;
const SECOND = 1000;

interface Variant {
  seed: string;
  title: string;
  text: string;
  instructions: string;
  parts: ScenarioPart[];
  values: Record<string, string>;
}

const err = (status: number, code: string, message: string, extra: object = {}) =>
  new HttpException({ code, message, ...extra }, status);

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Only small, plain values from the browser are kept. Pasted text itself is never stored. */
function cleanMetadata(m: Record<string, unknown> | undefined): Prisma.InputJsonObject | undefined {
  if (!m) return undefined;
  const out: Record<string, number | string> = {};
  for (const k of ["length", "ratio", "hiddenMs", "field", "idleSeconds"]) {
    const v = m[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 40);
  }
  return Object.keys(out).length ? out : undefined;
}

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsSvc: SettingsService,
    private readonly programme: ProgrammeService,
    private readonly evaluation: EvaluationService,
  ) {}

  // ───────────────────────── Starting and resuming ─────────────────────────

  /** Opens a session, or resumes the open one with a fresh token (the old token stops working). */
  async start(userId: string, activityId: string) {
    const { activity } = await this.programme.prepareScenario(userId, activityId);
    if (!activity.scenarioId) throw err(409, "NOT_AVAILABLE_YET", "This scenario is not available yet.");
    const s = await loadAssessmentSettings(this.settingsSvc);
    const now = Date.now();

    const sessions = await this.prisma.assessmentSession.findMany({ where: { userId, activityId } });
    const open = sessions.find((x) => x.status === "ACTIVE");
    if (open) {
      if (open.expiresAt.getTime() > now) return this.resume(open);
      await this.prisma.assessmentSession.update({ where: { id: open.id }, data: { status: "EXPIRED" } });
    }
    const used = sessions.filter((x) => x.status !== "VOIDED").length;
    if (used >= s.maxSessions) {
      throw err(403, "ATTEMPTS_EXHAUSTED", "You have used the attempts available for this scenario. Please contact support.");
    }

    const version = await this.prisma.scenarioVersion.findFirst({
      where: { scenarioId: activity.scenarioId, isActive: true },
      orderBy: { version: "desc" },
    });
    if (!version) throw err(409, "NOT_AVAILABLE_YET", "This scenario is not available yet.");

    const seed = newToken();
    const rendered = renderScenario(version.body as unknown as ScenarioBody, seed);
    const variant: Variant = { seed, ...rendered };
    const token = newToken();

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const session = await this.prisma.assessmentSession.create({
          data: {
            userId,
            activityId,
            scenarioVersionId: version.id,
            tokenHash: hashToken(token),
            watermarkCode: `BW-${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`,
            renderedVariant: variant as unknown as Prisma.InputJsonObject,
            expiresAt: new Date(now + s.sessionMinutes * 60 * SECOND),
            lastSeenAt: new Date(now),
          },
        });
        return { sessionId: session.id, token, expiresAt: session.expiresAt, resumed: false };
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e; // watermark clash: try another
      }
    }
    throw err(500, "SESSION_FAILED", "We could not start the assessment. Please try again.");
  }

  private async resume(session: AssessmentSession) {
    const now = Date.now();
    const token = newToken();
    // A second tab or a quick reload both rotate the token, which ends the other copy.
    const recentlyActive = session.lastSeenAt && now - session.lastSeenAt.getTime() < 20 * SECOND;
    await this.prisma.assessmentSession.update({
      where: { id: session.id },
      data: { tokenHash: hashToken(token), lastSeenAt: new Date(now) },
    });
    await this.logEvent(session.id, "PAGE_RELOAD");
    if (recentlyActive) await this.logEvent(session.id, "MULTIPLE_SESSIONS");
    return { sessionId: session.id, token, expiresAt: session.expiresAt, resumed: true };
  }

  // ───────────────────────── Serving the question ─────────────────────────

  /** The scenario text exists only here, per session, and every fetch is logged (PRD section 30). */
  async question(userId: string, sessionId: string, token: string | undefined) {
    const session = await this.authenticate(userId, sessionId, token);
    await this.prisma.assessmentSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    await this.logEvent(session.id, "QUESTION_SERVED");
    const v = session.renderedVariant as unknown as Variant;
    return {
      sessionId: session.id,
      watermark: session.watermarkCode,
      expiresAt: session.expiresAt,
      title: v.title,
      text: v.text,
      instructions: v.instructions,
      parts: v.parts.map((p) => ({ key: p.key, label: p.label, minWords: p.minWords })),
    };
  }

  async recordEvent(userId: string, sessionId: string, token: string | undefined, dto: EventDto) {
    const session = await this.authenticate(userId, sessionId, token);
    await this.logEvent(session.id, dto.type, cleanMetadata(dto.metadata));
    return { ok: true };
  }

  // ───────────────────────── Submitting ─────────────────────────

  async submit(userId: string, sessionId: string, token: string | undefined, answers: Record<string, unknown>) {
    const session = await this.authenticate(userId, sessionId, token);
    const variant = session.renderedVariant as unknown as Variant;

    const valid = validateParts(variant.parts, answers);
    if (!valid.ok) throw err(400, "ANSWER_INVALID", "Some answers need attention.", { errors: valid.errors });

    // Server-derived signal: writing this much in this little time is implausible, even for a fast typist.
    const served = await this.prisma.integrityEvent.findFirst({
      where: { sessionId: session.id, type: "QUESTION_SERVED" },
      orderBy: { at: "asc" },
    });
    const since = (served?.at ?? session.startedAt).getTime();
    const words = Object.values(valid.clean).reduce((n, t) => n + wordsIn(t), 0);
    if ((Date.now() - since) / SECOND < fastestPlausibleSeconds(words) * 0.5) {
      await this.logEvent(session.id, "RAPID_SUBMISSION");
    }
    const events = await this.prisma.integrityEvent.findMany({ where: { sessionId: session.id } });
    const { score } = integrityScore(events);

    try {
      await this.prisma.$transaction([
        this.prisma.assessmentAnswer.create({
          data: {
            sessionId: session.id,
            sequence: 0,
            promptShown: `${variant.text}\n\n${variant.parts.map((p) => p.label).join("\n")}`,
            parts: valid.clean,
            originalText: composeAnswerText(variant.parts, valid.clean),
          },
        }),
        this.prisma.assessmentSession.update({
          where: { id: session.id },
          data: { status: "SUBMITTED", submittedAt: new Date(), evalState: "PENDING", integrityScore: score },
        }),
      ]);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw err(409, "SESSION_CLOSED", "This was already submitted.");
      throw e;
    }

    if (session.activityId) await this.programme.resolveActivity(userId, session.activityId, ActivityStatus.SUBMITTED);
    this.evaluation.kick(session.id);
    return { status: "RECEIVED" };
  }

  /** Progress only. No scores, no rubric, no reasons (PRD section 9). */
  async status(userId: string, sessionId: string) {
    const session = await this.prisma.assessmentSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new NotFoundException({ code: "NOT_FOUND", message: "Not found." });

    let state: "IN_PROGRESS" | "RECEIVED" | "IN_REVIEW" | "COMPLETE" | "EXPIRED" = "IN_PROGRESS";
    if (session.status === "EXPIRED") state = "EXPIRED";
    else if (session.status === "SUBMITTED") {
      state = session.evalState === "DONE" ? "COMPLETE" : session.evalState === "REVIEW" ? "IN_REVIEW" : "RECEIVED";
    }
    const activityStatus = session.activityId
      ? await this.programme.activityStatusFor(userId, session.activityId)
      : ActivityStatus.NOT_STARTED;
    return { state, activityStatus };
  }

  // ───────────────────────── Internals ─────────────────────────

  private async authenticate(userId: string, sessionId: string, token: string | undefined) {
    const session = await this.prisma.assessmentSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new NotFoundException({ code: "NOT_FOUND", message: "Not found." });
    if (!token || !same(session.tokenHash, hashToken(token))) {
      await this.logEvent(session.id, "SESSION_CHANGE");
      throw new UnauthorizedException({
        code: "INVALID_ASSESSMENT_TOKEN",
        message: "This assessment was opened somewhere else. Reload this page to continue here.",
      });
    }
    if (session.status !== "ACTIVE") throw err(409, "SESSION_CLOSED", "This assessment is closed.");
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.assessmentSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
      throw err(410, "SESSION_EXPIRED", "The time for this assessment has ended.");
    }
    return session;
  }

  private async logEvent(sessionId: string, type: IntegrityEventType, metadata?: Prisma.InputJsonObject) {
    const count = await this.prisma.integrityEvent.count({ where: { sessionId } });
    if (count >= MAX_EVENTS_PER_SESSION) return;
    await this.prisma.integrityEvent.create({ data: { sessionId, type, metadata } });
  }
}

export { BadRequestException, ConflictException, ForbiddenException };
