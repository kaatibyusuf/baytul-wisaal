import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { EmailService } from "../src/email/email.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { SettingsService } from "../src/settings/settings.service";
import { createFakePrisma } from "./fake-prisma";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const REFLECTION = "I want to learn to listen first and speak second especially when we disagree about money and family";

describe("Programme and profile", () => {
  let app: INestApplication;
  let db: ReturnType<typeof createFakePrisma>;
  let sent: { text: string }[];
  let ids: { lesson1: string; reflection1: string; quiz2: string; lesson3: string };

  const http = () => request(app.getHttpServer());
  const post = (path: string, body?: object, cookie?: string) => {
    const r = http().post(`/api/v1${path}`).set("Origin", ORIGIN);
    if (cookie) r.set("Cookie", cookie);
    return r.send(body ?? {});
  };
  const get = (path: string, cookie: string) => http().get(`/api/v1${path}`).set("Cookie", cookie);
  const patch = (path: string, body: object, cookie: string) =>
    http().patch(`/api/v1${path}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body);

  const setSettings = async (values: Record<string, number>) => {
    db.settings.rows.length = 0;
    for (const [k, v] of Object.entries(values)) await db.settings.create({ data: { key: `programme.${k}`, value: v } });
    app.get(SettingsService).clearCache();
  };
  const fastSettings = () => setSettings({ unlockIntervalHours: 0, lessonMinSeconds: 0, lessonMaxSeconds: 0 });

  async function newUser(email: string): Promise<string> {
    await post("/auth/register", {
      email,
      password: PASSWORD,
      fullName: "Test User",
      gender: "MALE",
      dateOfBirth: "1994-06-01",
      maritalStatus: "NEVER_MARRIED",
    }).expect(202);
    const token = decodeURIComponent(sent[sent.length - 1].text.match(/token=([^\s&]+)/)![1]);
    await post("/auth/verify-email", { token }).expect(200);
    const res = await post("/auth/login", { email, password: PASSWORD }).expect(200);
    return (res.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
  }

  beforeEach(async () => {
    db = createFakePrisma();
    sent = [];
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(EmailService)
      .useValue({ send: async (_to: string, c: { text: string }) => void sent.push(c) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    // Three-day sample programme: day 1 lesson + reflection, day 2 quiz, day 3 lesson
    const p = await db.programme.create({ data: { slug: "marriage-readiness", title: "Marriage Readiness Programme", totalDays: 3 } });
    const mkDay = (dayNumber: number) => db.days.create({ data: { programmeId: p.id, dayNumber, title: `Day ${dayNumber}` } });
    const [d1, d2, d3] = [await mkDay(1), await mkDay(2), await mkDay(3)];
    const mkAct = (dayId: string, type: string, title: string, content: object, position = 0) =>
      db.activities.create({ data: { dayId, type, title, content, position } });
    const lesson1 = await mkAct(d1.id, "LESSON", "Lesson 1", { blocks: [{ type: "p", text: "A short sample lesson body." }] });
    const reflection1 = await mkAct(d1.id, "REFLECTION", "Reflection", { prompt: "Why?", minWords: 8 }, 1);
    const quiz2 = await mkAct(d2.id, "QUIZ", "Quiz", {
      passMark: 67,
      maxAttempts: 2,
      questions: [
        { text: "q1", options: ["a", "b", "c"], correctIndex: 1 },
        { text: "q2", options: ["a", "b"], correctIndex: 0 },
        { text: "q3", options: ["a", "b", "c"], correctIndex: 2 },
      ],
    });
    const lesson3 = await mkAct(d3.id, "LESSON", "Lesson 3", { blocks: [{ type: "p", text: "Another sample lesson." }] });
    ids = { lesson1: lesson1.id, reflection1: reflection1.id, quiz2: quiz2.id, lesson3: lesson3.id };
  });

  afterEach(async () => app.close());

  const finishDay1 = async (cookie: string) => {
    await get(`/programme/activities/${ids.lesson1}`, cookie).expect(200);
    await post(`/programme/activities/${ids.lesson1}/complete`, {}, cookie).expect(200);
    await get(`/programme/activities/${ids.reflection1}`, cookie).expect(200);
    return post(`/programme/activities/${ids.reflection1}/submit`, { text: REFLECTION }, cookie).expect(200);
  };

  // ───────────────────────── Programme ─────────────────────────

  it("needs a signed-in user", async () => {
    await http().get("/api/v1/programme").expect(401);
    await http().get("/api/v1/profile").expect(401);
  });

  it("shows day titles before enrolment but no content, and blocks activities until enrolled", async () => {
    const cookie = await newUser("a@example.com");
    const s = await get("/programme", cookie).expect(200);
    expect(s.body.enrollment).toBeNull();
    expect(s.body.days).toHaveLength(3);
    expect(s.body.days[0].state).toBe("NOT_ENROLLED");
    const r = await get(`/programme/activities/${ids.lesson1}`, cookie).expect(403);
    expect(r.body.code).toBe("NOT_ENROLLED");
  });

  it("enrols once, opens day 1, and keeps later days timed by default (one day per day)", async () => {
    const cookie = await newUser("a@example.com");
    const first = await post("/programme/enroll", {}, cookie).expect(200);
    const again = await post("/programme/enroll", {}, cookie).expect(200);
    expect(db.enrollments.rows).toHaveLength(1);
    expect(again.body.enrollment.startedAt).toEqual(first.body.enrollment.startedAt);
    expect(first.body.days.map((d: { state: string }) => d.state)).toEqual(["OPEN", "LOCKED_TIME", "LOCKED_TIME"]);
    expect(first.body.currentDay).toBe(1);

    const locked = await get("/programme/days/2", cookie).expect(403);
    expect(locked.body.code).toBe("DAY_LOCKED_TIME");
    expect(locked.body.unlocksAt).toBeDefined();
    await get(`/programme/activities/${ids.quiz2}`, cookie).expect(403);
  });

  it("opens the next day only after the previous day's required work is finished", async () => {
    await fastSettings();
    const cookie = await newUser("a@example.com");
    await post("/programme/enroll", {}, cookie).expect(200);

    let s = await get("/programme", cookie).expect(200);
    expect(s.body.days.map((d: { state: string }) => d.state)).toEqual(["OPEN", "LOCKED_PREVIOUS", "LOCKED_PREVIOUS"]);
    const blocked = await get("/programme/days/2", cookie).expect(403);
    expect(blocked.body.code).toBe("DAY_LOCKED_PREVIOUS");

    const done = await finishDay1(cookie);
    expect(done.body.dayComplete).toBe(true);
    s = await get("/programme", cookie).expect(200);
    expect(s.body.days.map((d: { state: string }) => d.state)).toEqual(["COMPLETE", "OPEN", "LOCKED_PREVIOUS"]);
    expect(s.body.currentDay).toBe(2);
  });

  it("will not accept 'complete' for a lesson that was never opened, or opened too recently", async () => {
    await setSettings({ unlockIntervalHours: 0, lessonMinSeconds: 60, lessonMaxSeconds: 60 });
    const cookie = await newUser("a@example.com");
    await post("/programme/enroll", {}, cookie).expect(200);

    const notOpened = await post(`/programme/activities/${ids.lesson1}/complete`, {}, cookie).expect(409);
    expect(notOpened.body.code).toBe("NOT_OPENED");

    await get(`/programme/activities/${ids.lesson1}`, cookie).expect(200);
    const early = await post(`/programme/activities/${ids.lesson1}/complete`, {}, cookie).expect(409);
    expect(early.body.code).toBe("TOO_EARLY");
    expect(early.body.retryAfterSeconds).toBeGreaterThan(50);

    // Time passes (simulated by moving the recorded open time back)
    db.progress.rows[0].startedAt = new Date(Date.now() - 61_000);
    const ok = await post(`/programme/activities/${ids.lesson1}/complete`, {}, cookie).expect(200);
    expect(ok.body.activityStatus).toBe("PASSED");
  });

  it("checks reflections server-side and keeps the original text", async () => {
    await fastSettings();
    const cookie = await newUser("a@example.com");
    await post("/programme/enroll", {}, cookie).expect(200);
    await get(`/programme/activities/${ids.reflection1}`, cookie).expect(200);

    const short = await post(`/programme/activities/${ids.reflection1}/submit`, { text: "too short" }, cookie).expect(400);
    expect(short.body.code).toBe("REFLECTION_TOO_SHORT");
    const padded = await post(`/programme/activities/${ids.reflection1}/submit`, { text: Array(30).fill("word").join(" ") }, cookie).expect(400);
    expect(padded.body.code).toBe("REFLECTION_TOO_SHORT");
    expect(db.submissions.rows).toHaveLength(0);

    await post(`/programme/activities/${ids.reflection1}/submit`, { text: REFLECTION }, cookie).expect(200);
    expect(db.submissions.rows).toHaveLength(1);
    expect(db.submissions.rows[0].data.text).toBe(REFLECTION);

    // Submitting again does not create a second attempt or change the stored original
    await post(`/programme/activities/${ids.reflection1}/submit`, { text: `${REFLECTION} edited later` }, cookie).expect(200);
    expect(db.submissions.rows).toHaveLength(1);
    expect(db.submissions.rows[0].data.text).toBe(REFLECTION);

    const view = await get(`/programme/activities/${ids.reflection1}`, cookie).expect(200);
    expect(view.body.submittedText).toBe(REFLECTION);
  });

  it("never sends the quiz answer key to the browser, and never says which answers were wrong", async () => {
    await fastSettings();
    const cookie = await newUser("a@example.com");
    await post("/programme/enroll", {}, cookie).expect(200);
    await finishDay1(cookie);

    const view = await get(`/programme/activities/${ids.quiz2}`, cookie).expect(200);
    expect(JSON.stringify(view.body)).not.toMatch(/correctIndex/);
    expect(view.body.content.questions).toHaveLength(3);

    const wrong = await post(`/programme/activities/${ids.quiz2}/submit`, { answers: [0, 1, 0] }, cookie).expect(200);
    expect(wrong.body).toMatchObject({ passed: false, score: 0, attemptsLeft: 1, activityStatus: "IN_PROGRESS" });
    expect(JSON.stringify(wrong.body)).not.toMatch(/correct/i);
  });

  it("validates quiz answers and sends a quiz to human review once attempts run out", async () => {
    await fastSettings();
    const cookie = await newUser("a@example.com");
    await post("/programme/enroll", {}, cookie).expect(200);
    await finishDay1(cookie);
    await get(`/programme/activities/${ids.quiz2}`, cookie).expect(200);

    await post(`/programme/activities/${ids.quiz2}/submit`, { answers: [1, 0] }, cookie).expect(400);
    await post(`/programme/activities/${ids.quiz2}/submit`, { answers: [1, 0, 9] }, cookie).expect(400);
    await post(`/programme/activities/${ids.quiz2}/submit`, { answers: "nope" }, cookie).expect(400);
    expect(db.submissions.rows).toHaveLength(1); // only the day-1 reflection

    await post(`/programme/activities/${ids.quiz2}/submit`, { answers: [0, 1, 0] }, cookie).expect(200);
    const second = await post(`/programme/activities/${ids.quiz2}/submit`, { answers: [0, 1, 0] }, cookie).expect(200);
    expect(second.body.activityStatus).toBe("UNDER_REVIEW");
    expect(second.body.attemptsLeft).toBe(0);

    const blocked = await post(`/programme/activities/${ids.quiz2}/submit`, { answers: [1, 0, 2] }, cookie).expect(403);
    expect(blocked.body.code).toBe("UNDER_REVIEW");
  });

  it("completes the whole programme, records it, and notifies the user", async () => {
    await fastSettings();
    const cookie = await newUser("a@example.com");
    await post("/programme/enroll", {}, cookie).expect(200);
    await finishDay1(cookie);

    await get(`/programme/activities/${ids.quiz2}`, cookie).expect(200);
    const q = await post(`/programme/activities/${ids.quiz2}/submit`, { answers: [1, 0, 2] }, cookie).expect(200);
    expect(q.body).toMatchObject({ passed: true, score: 100, activityStatus: "PASSED", dayComplete: true, programmeCompleted: false });

    await get(`/programme/activities/${ids.lesson3}`, cookie).expect(200);
    const last = await post(`/programme/activities/${ids.lesson3}/complete`, {}, cookie).expect(200);
    expect(last.body.programmeCompleted).toBe(true);

    const s = await get("/programme", cookie).expect(200);
    expect(s.body.enrollment.status).toBe("COMPLETED");
    expect(s.body.percentComplete).toBe(100);
    expect(db.notifications.rows.some((n: { type: string }) => n.type === "PROGRAMME_COMPLETED")).toBe(true);
    expect(db.audit.rows.some((a: { action: string }) => a.action === "PROGRAMME_COMPLETED")).toBe(true);
  });

  it("keeps each user's progress separate", async () => {
    await fastSettings();
    const a = await newUser("a@example.com");
    const b = await newUser("b@example.com");
    await post("/programme/enroll", {}, a).expect(200);
    await finishDay1(a);
    const sb = await get("/programme", b).expect(200);
    expect(sb.body.enrollment).toBeNull();
    await get(`/programme/activities/${ids.lesson1}`, b).expect(403);
    await post("/programme/enroll", {}, b).expect(200);
    const sb2 = await get("/programme", b).expect(200);
    expect(sb2.body.percentComplete).toBe(0);
  });

  it("closes an enrolment that has run past its deadline", async () => {
    await fastSettings();
    const cookie = await newUser("a@example.com");
    await post("/programme/enroll", {}, cookie).expect(200);
    await get(`/programme/activities/${ids.lesson1}`, cookie).expect(200);
    db.enrollments.rows[0].dueAt = new Date(Date.now() - 1000);
    const r = await post(`/programme/activities/${ids.lesson1}/complete`, {}, cookie).expect(403);
    expect(r.body.code).toBe("PROGRAMME_EXPIRED");
    expect(db.enrollments.rows[0].status).toBe("EXPIRED");
  });

  it("refuses unknown activities and malformed ids safely", async () => {
    const cookie = await newUser("a@example.com");
    await get("/programme/activities/does-not-exist", cookie).expect(404);
    await get("/programme/days/abc", cookie).expect(400);
  });

  // ───────────────────────── Profile ─────────────────────────

  it("returns the user's own profile and lets them update the permitted fields", async () => {
    const cookie = await newUser("a@example.com");
    const before = await get("/profile", cookie).expect(200);
    expect(before.body.fullName).toBe("Test User");

    const res = await patch(
      "/profile",
      {
        preferredName: "Tester",
        location: "Lagos",
        nationality: "Nigerian",
        phone: "+234 801 234 5678",
        education: "BSc",
        occupation: "Engineer",
        religiousInfo: { practice: "Prays five times daily", notes: "" },
        familyInfo: { siblings: 3 },
      },
      cookie,
    ).expect(200);
    expect(res.body).toMatchObject({ preferredName: "Tester", location: "Lagos", phone: "+234 801 234 5678", fullName: "Test User" });
    expect(res.body.religiousInfo).toEqual({ practice: "Prays five times daily" });
    expect(res.body.familyInfo).toEqual({ siblings: 3 });
  });

  it("clears a field when sent blank", async () => {
    const cookie = await newUser("a@example.com");
    await patch("/profile", { location: "Lagos" }, cookie).expect(200);
    const res = await patch("/profile", { location: "  " }, cookie).expect(200);
    expect(res.body.location).toBeNull();
  });

  it("will not let users change their name, gender, date of birth or role", async () => {
    const cookie = await newUser("a@example.com");
    for (const body of [{ fullName: "Someone Else" }, { gender: "FEMALE" }, { dateOfBirth: "2000-01-01" }, { role: "ADMIN" }]) {
      await patch("/profile", body, cookie).expect(400);
    }
    expect(db.profiles.rows[0].fullName).toBe("Test User");
    expect(db.users.rows[0].role).toBe("USER");
  });

  it("validates profile input and records marital status changes", async () => {
    const cookie = await newUser("a@example.com");
    await patch("/profile", { phone: "call me maybe" }, cookie).expect(400);
    await patch("/profile", { maritalStatus: "MARRIED" }, cookie).expect(400);
    await patch("/profile", { familyInfo: { siblings: -2 } }, cookie).expect(400);
    await patch("/profile", { religiousInfo: { notes: "x".repeat(1001) } }, cookie).expect(400);

    await patch("/profile", { maritalStatus: "DIVORCED" }, cookie).expect(200);
    const entry = db.audit.rows.find((a: { action: string }) => a.action === "PROFILE_MARITAL_STATUS_CHANGED");
    expect(entry.metadata).toEqual({ from: "NEVER_MARRIED", to: "DIVORCED" });
  });
});
