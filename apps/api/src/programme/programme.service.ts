import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Activity, ActivityProgress, ActivityStatus, ActivityType, Enrollment, EnrollmentStatus, Programme, ProgrammeDay } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import {
  DEFAULT_SETTINGS,
  DayState,
  LessonContent,
  ProgrammeSettings,
  QuizContent,
  ReflectionContent,
  SETTING_KEYS,
  checkReflection,
  countWords,
  dayState,
  dayUnlockAt,
  dueDate,
  gradeQuiz,
  lessonWordCount,
  requiredReadSeconds,
} from "./rules";
import { SubmitDto } from "./dto";

interface DayInfo {
  day: ProgrammeDay;
  activities: Activity[];
  state: DayState;
  unlocksAt: Date;
  required: number;
  requiredDone: number;
  done: number;
}

interface Evaluation {
  days: DayInfo[];
  progress: Map<string, ActivityProgress>;
  allComplete: boolean;
}

const notAvailable = () =>
  new ConflictException({ code: "NOT_AVAILABLE_YET", message: "This kind of activity is not available yet." });

@Injectable()
export class ProgrammeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsSvc: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── Settings & lookups ─────────────────────────

  private async settings(): Promise<ProgrammeSettings> {
    const out = { ...DEFAULT_SETTINGS };
    for (const k of Object.keys(SETTING_KEYS) as (keyof ProgrammeSettings)[]) {
      const v = await this.settingsSvc.get<number>(SETTING_KEYS[k], DEFAULT_SETTINGS[k]);
      out[k] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : DEFAULT_SETTINGS[k];
    }
    return out;
  }

  private async activeProgramme(): Promise<Programme> {
    const programme = await this.prisma.programme.findFirst({ where: { isActive: true } });
    if (!programme) {
      throw new NotFoundException({ code: "NO_PROGRAMME", message: "The programme is not available yet." });
    }
    return programme;
  }

  private findEnrollment(userId: string, programmeId: string) {
    return this.prisma.enrollment.findUnique({ where: { userId_programmeId: { userId, programmeId } } });
  }

  /** Enrolments that run past their deadline are closed lazily when next touched. */
  private async expireIfNeeded(enrollment: Enrollment): Promise<Enrollment> {
    if (
      enrollment.status === EnrollmentStatus.IN_PROGRESS &&
      enrollment.dueAt &&
      enrollment.dueAt.getTime() < Date.now()
    ) {
      return this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.EXPIRED },
      });
    }
    return enrollment;
  }

  // ───────────────────────── State evaluation ─────────────────────────

  private async evaluate(enrollment: Enrollment, programmeId: string, s: ProgrammeSettings): Promise<Evaluation> {
    const days = await this.prisma.programmeDay.findMany({
      where: { programmeId },
      orderBy: { dayNumber: "asc" },
    });
    const activities = await this.prisma.activity.findMany({
      where: { dayId: { in: days.map((d) => d.id) } },
      orderBy: { position: "asc" },
    });
    const rows = await this.prisma.activityProgress.findMany({ where: { enrollmentId: enrollment.id } });
    const progress = new Map(rows.map((r) => [r.activityId, r]));
    const now = new Date();

    const infos: DayInfo[] = [];
    let previousComplete = true;
    for (const day of days) {
      const acts = activities.filter((a) => a.dayId === day.id);
      const required = acts.filter((a) => a.required);
      const passed = (a: Activity) => progress.get(a.id)?.status === ActivityStatus.PASSED;
      const unlocksAt = dayUnlockAt(enrollment.startedAt, day.dayNumber, s);
      // A day with nothing required is complete once its time arrives, so it can never block the programme.
      const thisComplete =
        required.length > 0 ? required.every(passed) : now.getTime() >= unlocksAt.getTime();
      const state = dayState({
        dayNumber: day.dayNumber,
        now,
        startedAt: enrollment.startedAt,
        settings: s,
        previousDayComplete: previousComplete,
        thisDayComplete: thisComplete,
      });
      infos.push({
        day,
        activities: acts,
        state,
        unlocksAt,
        required: required.length,
        requiredDone: required.filter(passed).length,
        done: acts.filter(passed).length,
      });
      previousComplete = thisComplete;
    }
    return { days: infos, progress, allComplete: infos.length > 0 && infos.every((d) => d.state === "COMPLETE") };
  }

  // ───────────────────────── Public operations ─────────────────────────

  async summary(userId: string) {
    const programme = await this.activeProgramme();
    let enrollment = await this.findEnrollment(userId, programme.id);
    const header = { id: programme.id, title: programme.title, totalDays: programme.totalDays };

    if (!enrollment) {
      const days = await this.prisma.programmeDay.findMany({
        where: { programmeId: programme.id },
        orderBy: { dayNumber: "asc" },
      });
      return {
        programme: header,
        enrollment: null,
        days: days.map((d) => ({ dayNumber: d.dayNumber, title: d.title, state: "NOT_ENROLLED" })),
        currentDay: null,
        percentComplete: 0,
      };
    }

    enrollment = await this.expireIfNeeded(enrollment);
    const s = await this.settings();
    const ev = await this.evaluate(enrollment, programme.id, s);
    const requiredTotal = ev.days.reduce((n, d) => n + d.required, 0);
    const requiredDone = ev.days.reduce((n, d) => n + d.requiredDone, 0);
    const current = ev.days.find((d) => d.state === "OPEN");

    return {
      programme: header,
      enrollment: {
        status: enrollment.status,
        startedAt: enrollment.startedAt,
        dueAt: enrollment.dueAt,
        completedAt: enrollment.completedAt,
      },
      days: ev.days.map((d) => ({
        dayNumber: d.day.dayNumber,
        title: d.day.title,
        state: d.state,
        unlocksAt: d.state === "LOCKED_TIME" ? d.unlocksAt : null,
        activitiesTotal: d.activities.length,
        activitiesDone: d.done,
      })),
      currentDay: current ? current.day.dayNumber : null,
      percentComplete: requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 0,
    };
  }

  /** The same summary a person sees, for an administrator looking at their progress. */
  summaryFor(userId: string) {
    return this.summary(userId);
  }

  async enroll(userId: string) {
    const programme = await this.activeProgramme();
    const existing = await this.findEnrollment(userId, programme.id);
    if (!existing) {
      const s = await this.settings();
      const startedAt = new Date();
      try {
        await this.prisma.enrollment.create({
          data: {
            userId,
            programmeId: programme.id,
            startedAt,
            dueAt: dueDate(startedAt, programme.totalDays, s),
          },
        });
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e; // double-click: already enrolled
      }
      await this.audit.record({
        actorId: userId,
        action: "PROGRAMME_ENROLLED",
        targetType: "Programme",
        targetId: programme.id,
      });
    }
    return this.summary(userId);
  }

  async dayView(userId: string, dayNumber: number) {
    const { enrollment, programme } = await this.requireEnrollment(userId);
    const s = await this.settings();
    const ev = await this.evaluate(enrollment, programme.id, s);
    const info = ev.days.find((d) => d.day.dayNumber === dayNumber);
    if (!info) throw new NotFoundException({ code: "NOT_FOUND", message: "That day does not exist." });
    this.assertDayOpen(info);
    return {
      dayNumber: info.day.dayNumber,
      title: info.day.title,
      state: info.state,
      activities: info.activities.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        required: a.required,
        status: ev.progress.get(a.id)?.status ?? ActivityStatus.NOT_STARTED,
      })),
    };
  }

  async activityView(userId: string, activityId: string) {
    const ctx = await this.context(userId, activityId);
    const { activity } = ctx;
    if (
      activity.type !== ActivityType.LESSON &&
      activity.type !== ActivityType.REFLECTION &&
      activity.type !== ActivityType.QUIZ &&
      activity.type !== ActivityType.SCENARIO
    ) {
      throw notAvailable();
    }

    let progress = await this.progressFor(ctx.enrollment.id, activity.id);
    if (!progress.startedAt) {
      progress = await this.prisma.activityProgress.update({
        where: { id: progress.id },
        data: {
          startedAt: new Date(),
          status: progress.status === ActivityStatus.NOT_STARTED ? ActivityStatus.IN_PROGRESS : progress.status,
        },
      });
    }

    const base = {
      id: activity.id,
      type: activity.type,
      title: activity.title,
      required: activity.required,
      dayNumber: ctx.day.dayNumber,
      status: progress.status,
      attemptsUsed: progress.attempts,
    };

    if (activity.type === ActivityType.LESSON) {
      const c = activity.content as unknown as LessonContent;
      return {
        ...base,
        content: { blocks: c.blocks },
        minReadSeconds: requiredReadSeconds(lessonWordCount(c), ctx.settings),
      };
    }

    if (activity.type === ActivityType.REFLECTION) {
      const c = activity.content as unknown as ReflectionContent;
      const last = await this.lastSubmission(progress.id);
      return {
        ...base,
        content: { prompt: c.prompt, minWords: c.minWords ?? 50 },
        submittedText: (last?.data as { text?: string } | undefined)?.text ?? null,
      };
    }

    if (activity.type === ActivityType.SCENARIO) {
      // The scenario itself is only ever served inside a protected assessment session.
      return {
        ...base,
        sessionMinutes: await this.settingsSvc.get<number>("assessment.sessionMinutes", 60),
      };
    }

    // QUIZ: the answer key is never sent to the browser.
    const c = activity.content as unknown as QuizContent;
    return {
      ...base,
      content: { questions: c.questions.map((q) => ({ text: q.text, options: q.options })) },
      passMark: c.passMark ?? ctx.settings.quizPassMark,
      maxAttempts: c.maxAttempts ?? ctx.settings.quizMaxAttempts,
    };
  }

  async completeLesson(userId: string, activityId: string) {
    const ctx = await this.context(userId, activityId);
    if (ctx.activity.type !== ActivityType.LESSON) {
      throw new BadRequestException({ code: "WRONG_TYPE", message: "Only lessons are completed this way." });
    }
    const progress = await this.progressFor(ctx.enrollment.id, ctx.activity.id);
    if (progress.status === ActivityStatus.PASSED) return this.result(ctx, progress.status);
    this.assertEnrollmentActive(ctx.enrollment);

    if (!progress.startedAt) {
      throw new ConflictException({ code: "NOT_OPENED", message: "Open the lesson before completing it." });
    }
    const needed = requiredReadSeconds(lessonWordCount(ctx.activity.content as unknown as LessonContent), ctx.settings);
    const elapsed = (Date.now() - progress.startedAt.getTime()) / 1000;
    if (elapsed < needed) {
      throw new HttpException(
        {
          code: "TOO_EARLY",
          message: "Take your time with the lesson. You can mark it complete shortly.",
          retryAfterSeconds: Math.ceil(needed - elapsed),
        },
        409,
      );
    }

    await this.prisma.activityProgress.update({
      where: { id: progress.id },
      data: { status: ActivityStatus.PASSED, completedAt: new Date() },
    });
    return this.result(ctx, ActivityStatus.PASSED);
  }

  async submit(userId: string, activityId: string, dto: SubmitDto) {
    const ctx = await this.context(userId, activityId);
    const { activity } = ctx;
    if (activity.type !== ActivityType.REFLECTION && activity.type !== ActivityType.QUIZ) {
      throw new BadRequestException({ code: "WRONG_TYPE", message: "This activity does not take a submission." });
    }
    this.assertEnrollmentActive(ctx.enrollment);

    const progress = await this.progressFor(ctx.enrollment.id, activity.id);
    if (progress.status === ActivityStatus.PASSED) return this.result(ctx, progress.status);
    if (progress.status === ActivityStatus.UNDER_REVIEW) {
      throw new ForbiddenException({ code: "UNDER_REVIEW", message: "This activity is with our team for review." });
    }
    if (!progress.startedAt) {
      throw new ConflictException({ code: "NOT_OPENED", message: "Open the activity before submitting it." });
    }

    const attempt = progress.attempts + 1;

    if (activity.type === ActivityType.REFLECTION) {
      const c = activity.content as unknown as ReflectionContent;
      const text = (dto.text ?? "").trim();
      const check = checkReflection(text, c.minWords ?? 50);
      if (!check.ok) throw new BadRequestException({ code: "REFLECTION_TOO_SHORT", message: check.reason });

      await this.store(progress, attempt, { text }, undefined, true, ActivityStatus.PASSED);
      return this.result(ctx, ActivityStatus.PASSED);
    }

    // QUIZ
    const c = activity.content as unknown as QuizContent;
    const graded = gradeQuiz(c.questions, dto.answers ?? []);
    if (!graded.ok) throw new BadRequestException({ code: "INVALID_ANSWERS", message: graded.reason });

    const passMark = c.passMark ?? ctx.settings.quizPassMark;
    const maxAttempts = c.maxAttempts ?? ctx.settings.quizMaxAttempts;
    const passed = graded.score >= passMark;
    const status = passed
      ? ActivityStatus.PASSED
      : attempt >= maxAttempts
        ? ActivityStatus.UNDER_REVIEW
        : ActivityStatus.IN_PROGRESS;

    await this.store(progress, attempt, { answers: dto.answers }, graded.score, passed, status);
    const done = await this.result(ctx, status);
    // Only the score and the verdict go back, never which answers were wrong.
    return { ...done, score: graded.score, passed, attemptsLeft: Math.max(0, maxAttempts - attempt) };
  }

  // ───────────────────────── Used by the assessment engine ─────────────────────────

  /** Checks a person may start this scenario now, and marks it opened. */
  async prepareScenario(userId: string, activityId: string) {
    const ctx = await this.context(userId, activityId);
    if (ctx.activity.type !== ActivityType.SCENARIO) {
      throw new BadRequestException({ code: "WRONG_TYPE", message: "This activity is not a scenario." });
    }
    this.assertEnrollmentActive(ctx.enrollment);
    let progress = await this.progressFor(ctx.enrollment.id, ctx.activity.id);
    if (progress.status === ActivityStatus.PASSED) {
      throw new ConflictException({ code: "ALREADY_COMPLETE", message: "You have already completed this." });
    }
    if (progress.status === ActivityStatus.SUBMITTED || progress.status === ActivityStatus.UNDER_REVIEW) {
      throw new ConflictException({ code: "ALREADY_SUBMITTED", message: "Your response has been received and is being reviewed." });
    }
    if (progress.status === ActivityStatus.FAILED) {
      throw new ForbiddenException({ code: "ON_HOLD", message: "This is with our team. We will be in touch." });
    }
    if (!progress.startedAt) {
      progress = await this.prisma.activityProgress.update({
        where: { id: progress.id },
        data: { startedAt: new Date(), status: ActivityStatus.IN_PROGRESS },
      });
    }
    return { activity: ctx.activity };
  }

  /**
   * Sets the outcome of an activity decided outside this service (assessment evaluation or a
   * moderator), then rechecks whether the whole programme is now complete.
   */
  async resolveActivity(userId: string, activityId: string, status: ActivityStatus) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) return null;
    const day = await this.prisma.programmeDay.findUnique({ where: { id: activity.dayId } });
    if (!day) return null;
    const enrollment = await this.findEnrollment(userId, day.programmeId);
    if (!enrollment) return null;

    const progress = await this.progressFor(enrollment.id, activity.id);
    await this.prisma.activityProgress.update({
      where: { id: progress.id },
      data: {
        status,
        completedAt: status === ActivityStatus.PASSED ? new Date() : progress.completedAt,
        attempts: status === ActivityStatus.SUBMITTED ? progress.attempts + 1 : progress.attempts,
      },
    });
    const settings = await this.settings();
    return this.result({ activity, day, enrollment, settings, programmeId: day.programmeId }, status);
  }

  /** The status the person sees for an activity, for polling after a scenario is submitted. */
  async activityStatusFor(userId: string, activityId: string): Promise<ActivityStatus> {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    const day = activity && (await this.prisma.programmeDay.findUnique({ where: { id: activity.dayId } }));
    const enrollment = day && (await this.findEnrollment(userId, day.programmeId));
    if (!activity || !enrollment) return ActivityStatus.NOT_STARTED;
    const progress = await this.progressFor(enrollment.id, activity.id);
    return progress.status;
  }

  // ───────────────────────── Internals ─────────────────────────

  private async store(
    progress: ActivityProgress,
    attempt: number,
    data: object,
    score: number | undefined,
    passed: boolean,
    status: ActivityStatus,
  ) {
    try {
      await this.prisma.$transaction([
        this.prisma.activitySubmission.create({
          data: { progressId: progress.id, attempt, data, score, passed },
        }),
        this.prisma.activityProgress.update({
          where: { id: progress.id },
          data: {
            attempts: attempt,
            status,
            completedAt: status === ActivityStatus.PASSED ? new Date() : null,
          },
        }),
      ]);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        throw new ConflictException({ code: "DUPLICATE_SUBMISSION", message: "That was already submitted." });
      }
      throw e;
    }
  }

  /** After any change: recheck the whole programme, close it out if everything is done. */
  private async result(ctx: Ctx, activityStatus: ActivityStatus) {
    const ev = await this.evaluate(ctx.enrollment, ctx.programmeId, ctx.settings);
    let programmeCompleted = ctx.enrollment.status === EnrollmentStatus.COMPLETED;

    if (!programmeCompleted && ev.allComplete) {
      await this.prisma.enrollment.update({
        where: { id: ctx.enrollment.id },
        data: { status: EnrollmentStatus.COMPLETED, completedAt: new Date() },
      });
      await this.prisma.notification.create({
        data: {
          userId: ctx.enrollment.userId,
          type: "PROGRAMME_COMPLETED",
          title: "You have completed the marriage-readiness programme",
          body: "Well done. The next step is defining what you are seeking.",
        },
      });
      await this.audit.record({
        actorId: ctx.enrollment.userId,
        action: "PROGRAMME_COMPLETED",
        targetType: "Enrollment",
        targetId: ctx.enrollment.id,
      });
      programmeCompleted = true;
    }

    const today = ev.days.find((d) => d.day.id === ctx.day.id);
    return {
      activityStatus,
      dayComplete: today?.state === "COMPLETE",
      programmeCompleted,
    };
  }

  private async requireEnrollment(userId: string) {
    const programme = await this.activeProgramme();
    let enrollment = await this.findEnrollment(userId, programme.id);
    if (!enrollment) {
      throw new ForbiddenException({ code: "NOT_ENROLLED", message: "Begin the programme first." });
    }
    enrollment = await this.expireIfNeeded(enrollment);
    return { programme, enrollment };
  }

  private assertEnrollmentActive(enrollment: Enrollment) {
    if (enrollment.status === EnrollmentStatus.EXPIRED) {
      throw new ForbiddenException({
        code: "PROGRAMME_EXPIRED",
        message: "The time allowed for this programme has passed. Please contact support.",
      });
    }
    if (enrollment.status === EnrollmentStatus.FAILED || enrollment.status === EnrollmentStatus.UNDER_REVIEW) {
      throw new ForbiddenException({ code: "PROGRAMME_ON_HOLD", message: "Your programme is with our team." });
    }
  }

  private assertDayOpen(info: DayInfo) {
    if (info.state === "LOCKED_TIME") {
      throw new HttpException(
        { code: "DAY_LOCKED_TIME", message: "This day has not opened yet.", unlocksAt: info.unlocksAt },
        403,
      );
    }
    if (info.state === "LOCKED_PREVIOUS") {
      throw new HttpException(
        { code: "DAY_LOCKED_PREVIOUS", message: "Complete the previous day to open this one." },
        403,
      );
    }
  }

  private async context(userId: string, activityId: string): Promise<Ctx> {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw new NotFoundException({ code: "NOT_FOUND", message: "Activity not found." });
    const day = await this.prisma.programmeDay.findUnique({ where: { id: activity.dayId } });
    if (!day) throw new NotFoundException({ code: "NOT_FOUND", message: "Activity not found." });

    const enrollment0 = await this.findEnrollment(userId, day.programmeId);
    if (!enrollment0) throw new ForbiddenException({ code: "NOT_ENROLLED", message: "Begin the programme first." });
    const enrollment = await this.expireIfNeeded(enrollment0);

    const settings = await this.settings();
    const ev = await this.evaluate(enrollment, day.programmeId, settings);
    const info = ev.days.find((d) => d.day.id === day.id);
    if (!info) throw new NotFoundException({ code: "NOT_FOUND", message: "Activity not found." });
    this.assertDayOpen(info);
    return { activity, day, enrollment, settings, programmeId: day.programmeId };
  }

  private progressFor(enrollmentId: string, activityId: string) {
    return this.prisma.activityProgress.upsert({
      where: { enrollmentId_activityId: { enrollmentId, activityId } },
      create: { enrollmentId, activityId },
      update: {},
    });
  }

  private lastSubmission(progressId: string) {
    return this.prisma.activitySubmission.findFirst({ where: { progressId }, orderBy: { attempt: "desc" } });
  }
}

interface Ctx {
  activity: Activity;
  day: ProgrammeDay;
  enrollment: Enrollment;
  settings: ProgrammeSettings;
  programmeId: string;
}

export { countWords };
