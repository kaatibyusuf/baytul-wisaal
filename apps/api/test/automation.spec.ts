import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "@node-rs/argon2";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { EmailService } from "../src/email/email.service";
import { MatchingScheduler } from "../src/matching/matching-scheduler.service";
import { QUESTIONS } from "../src/matching/questionnaire";
import { NotificationDispatcher } from "../src/notifications/dispatcher.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { SettingsService } from "../src/settings/settings.service";
import { createFakePrisma } from "./fake-prisma";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const HOUR = 3600_000;

const prefs = () => ({
  self: Object.fromEntries(QUESTIONS.map((q) => [q.key, q.options[0].value])),
  seek: Object.fromEntries(QUESTIONS.map((q) => [q.key, { accept: q.options.map((o) => o.value), level: "PREFERENCE" }])),
  filters: { ageMin: 18, ageMax: 99, maritalStatuses: ["NEVER_MARRIED", "DIVORCED", "WIDOWED"], locationScope: "ANYWHERE" },
});

describe("Automation: notification emails and scheduled matching", () => {
  let app: INestApplication;
  let db: ReturnType<typeof createFakePrisma>;
  let passwordHash: string;
  let send: jest.Mock;
  const savedEnv = { mode: process.env.EMAIL_NOTIFICATIONS, key: process.env.RESEND_API_KEY };

  const http = () => request(app.getHttpServer());

  async function account(email: string, over: Record<string, unknown> = {}, gender: "MALE" | "FEMALE" = "MALE") {
    const user = await db.users.create({ data: { email, passwordHash, role: "USER", status: "ACTIVE", emailVerifiedAt: new Date(), ...over } });
    await db.profiles.create({ data: { userId: user.id, fullName: `${email.split("@")[0]} Person`, preferredName: email.split("@")[0], gender, dateOfBirth: new Date("1994-06-01"), maritalStatus: "NEVER_MARRIED" } });
    return user.id as string;
  }
  async function signIn(email: string): Promise<string> {
    const res = await http().post("/api/v1/auth/login").set("Origin", ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return (res.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
  }
  const setSettings = async (values: Record<string, number>) => {
    for (const [key, value] of Object.entries(values)) {
      const row = db.settings.rows.find((r: { key: string }) => r.key === key);
      if (row) row.value = value;
      else await db.settings.create({ data: { key, value } });
    }
    app.get(SettingsService).clearCache();
  };

  beforeAll(async () => {
    passwordHash = await hash(PASSWORD);
  });

  beforeEach(async () => {
    delete process.env.EMAIL_NOTIFICATIONS;
    delete process.env.RESEND_API_KEY;
    db = createFakePrisma();
    send = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db)
      .overrideProvider(EmailService).useValue({ send })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (savedEnv.mode === undefined) delete process.env.EMAIL_NOTIFICATIONS;
    else process.env.EMAIL_NOTIFICATIONS = savedEnv.mode;
    if (savedEnv.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedEnv.key;
  });

  const note = (userId: string, over: Record<string, unknown> = {}) =>
    db.notifications.create({ data: { userId, type: "MATCH_CREATED", title: "You have a new match", body: "We have found someone whose expectations may fit yours.", ...over } });
  const dispatcher = () => app.get(NotificationDispatcher);

  // ───────────────────────── Emailing notifications ─────────────────────────

  it("stays quiet unless an email service is configured, or it is switched on", async () => {
    const id = await account("a@example.com");
    await note(id);
    expect(await dispatcher().sendPending()).toEqual({ sent: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(db.notifications.rows[0].emailedAt).toBeNull();

    process.env.RESEND_API_KEY = "re_test_key";
    expect((await dispatcher().sendPending()).sent).toBe(1); // a configured email service switches it on

    process.env.EMAIL_NOTIFICATIONS = "off";
    await note(id);
    expect((await dispatcher().sendPending()).sent).toBe(0); // and off means off, key or not
  });

  it("sends one neutral email per notification, to the right person, once", async () => {
    process.env.EMAIL_NOTIFICATIONS = "on";
    const a = await account("a@example.com");
    const b = await account("b@example.com", {}, "FEMALE");
    await note(a);
    await note(b, { type: "MATCH_NEXT_STAGE", title: "You have reached the next stage", body: "Open your match to see how they compare." });

    expect(await dispatcher().sendPending()).toEqual({ sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);

    const [toA, contentA] = send.mock.calls.find((c) => c[0] === "a@example.com")!;
    expect(toA).toBe("a@example.com");
    expect(contentA.subject).toBe("You have a new match");
    expect(contentA.text).toContain("Assalamu alaikum a,");
    expect(contentA.text).toContain("We have found someone whose expectations may fit yours.");
    expect(contentA.text).toContain("http://localhost:3000/dashboard");
    // Nothing about anyone else, and no identifiers
    expect(contentA.text + contentA.html).not.toMatch(/b@example|b Person|c0000000/);
    const toB = send.mock.calls.find((c) => c[0] === "b@example.com")![1];
    expect(toB.subject).toBe("You have reached the next stage");

    expect(db.notifications.rows.every((n: { emailedAt: unknown }) => n.emailedAt !== null)).toBe(true);
    expect(await dispatcher().sendPending()).toEqual({ sent: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2); // never twice
  });

  it("never emails old news, so switching it on does not flood anyone", async () => {
    process.env.EMAIL_NOTIFICATIONS = "on";
    const id = await account("a@example.com");
    await note(id, { createdAt: new Date(Date.now() - 30 * HOUR) });
    await note(id, { title: "Recent", createdAt: new Date(Date.now() - 2 * HOUR) });
    await dispatcher().sendPending();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].subject).toBe("Recent");
  });

  it("does not write to unverified or suspended accounts, and does not keep trying", async () => {
    process.env.EMAIL_NOTIFICATIONS = "on";
    const unverified = await account("u@example.com", { emailVerifiedAt: null, status: "PENDING_VERIFICATION" });
    const suspended = await account("s@example.com", { status: "SUSPENDED" });
    await note(unverified);
    await note(suspended);
    expect((await dispatcher().sendPending()).sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(db.notifications.rows.every((n: { emailedAt: unknown }) => n.emailedAt !== null)).toBe(true); // settled, not retried forever
  });

  it("retries a failed email, then gives up after five tries, without harming the notification", async () => {
    process.env.EMAIL_NOTIFICATIONS = "on";
    const id = await account("a@example.com");
    await note(id);
    send.mockRejectedValue(new Error("Resend responded with 503"));

    for (let i = 1; i <= 5; i++) {
      expect(await dispatcher().sendPending()).toEqual({ sent: 0, failed: 1 });
      expect(db.notifications.rows[0].emailAttempts).toBe(i);
    }
    send.mockResolvedValue(undefined);
    expect(await dispatcher().sendPending()).toEqual({ sent: 0, failed: 0 }); // stopped trying
    expect(db.notifications.rows[0]).toMatchObject({ emailedAt: null, emailAttempts: 5, readAt: null }); // still there in the app
  });

  it("a temporary failure heals on its own", async () => {
    process.env.EMAIL_NOTIFICATIONS = "on";
    const id = await account("a@example.com");
    await note(id);
    send.mockRejectedValueOnce(new Error("network error"));
    expect((await dispatcher().sendPending()).failed).toBe(1);
    expect((await dispatcher().sendPending()).sent).toBe(1);
    expect(db.notifications.rows[0].emailedAt).not.toBeNull();
  });

  // ───────────────────────── Scheduled matching ─────────────────────────

  async function twoEligible() {
    await setSettings({ "matching.requireProgramme": 0 });
    await account("m@example.com", {}, "MALE");
    await account("w@example.com", {}, "FEMALE");
    for (const e of ["m@example.com", "w@example.com"]) {
      const cookie = await signIn(e);
      await http().put("/api/v1/preferences").set("Origin", ORIGIN).set("Cookie", cookie).send(prefs()).expect(200);
    }
  }
  const scheduler = () => app.get(MatchingScheduler);

  it("does nothing unless an administrator turns it on", async () => {
    await twoEligible();
    expect(await scheduler().runDue()).toEqual({ ran: false, reason: "off" });
    expect(db.matches.rows).toHaveLength(0);
  });

  it("makes matches on its own once switched on, records it, and tells both people", async () => {
    await twoEligible();
    await setSettings({ "matching.autoRunMinutes": 30 });
    expect(await scheduler().runDue()).toEqual({ ran: true, created: 1 });

    expect(db.matches.rows).toHaveLength(1);
    expect(db.notifications.rows.filter((n: { type: string }) => n.type === "MATCH_CREATED")).toHaveLength(2);
    const created = db.audit.rows.find((a: { action: string }) => a.action === "MATCH_CREATED");
    expect(created.actorId).toBe("system");
    const run = db.audit.rows.find((a: { action: string }) => a.action === "MATCHMAKING_AUTO_RUN");
    expect(run).toMatchObject({ actorId: "system", metadata: { created: 1, candidates: 2, unmatched: 0 } });
    expect(typeof db.settings.rows.find((r: { key: string }) => r.key === "matching.lastAutoRun").value).toBe("number");
  });

  it("waits the configured time between rounds", async () => {
    await twoEligible();
    await setSettings({ "matching.autoRunMinutes": 30 });
    await scheduler().runDue();
    expect(await scheduler().runDue()).toEqual({ ran: false, reason: "not due" });

    const last = db.settings.rows.find((r: { key: string }) => r.key === "matching.lastAutoRun");
    last.value = Date.now() - 31 * 60_000;
    app.get(SettingsService).clearCache();
    expect(await scheduler().runDue()).toEqual({ ran: true, created: 0 }); // due again, nobody new to match
  });

  it("follows the same rules as a manual round: it does not match anyone twice", async () => {
    await twoEligible();
    await setSettings({ "matching.autoRunMinutes": 1 });
    await scheduler().runDue();
    db.settings.rows.find((r: { key: string }) => r.key === "matching.lastAutoRun").value = 0;
    await scheduler().runDue();
    expect(db.matches.rows).toHaveLength(1);
  });

  it("survives a failure without crashing, and tries again next time", async () => {
    await twoEligible();
    await setSettings({ "matching.autoRunMinutes": 5 });
    const original = db.systemSetting.findUnique;
    db.systemSetting.findUnique = async () => {
      throw new Error("database unavailable");
    };
    app.get(SettingsService).clearCache();
    await expect(scheduler().runDue()).resolves.toEqual({ ran: false, reason: "error" });
    expect(db.matches.rows).toHaveLength(0);

    db.systemSetting.findUnique = original;
    app.get(SettingsService).clearCache();
    expect(await scheduler().runDue()).toEqual({ ran: true, created: 1 });
  });

  it("is a setting an administrator can change, within limits", async () => {
    await account("admin@example.com", { role: "ADMIN" });
    const cookie = await signIn("admin@example.com");
    const put = (value: number) => http().put("/api/v1/admin/settings/matching.autoRunMinutes").set("Origin", ORIGIN).set("Cookie", cookie).send({ value, reason: "Turn on automatic matching" });
    expect((await put(2000)).status).toBe(400);
    expect((await put(15)).status).toBe(200);
    expect(await app.get(SettingsService).get("matching.autoRunMinutes", 0)).toBe(15);
  });
});
