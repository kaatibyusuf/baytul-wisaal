import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { EmailService } from "../src/email/email.service";
import { QUESTIONS } from "../src/matching/questionnaire";
import { PrismaService } from "../src/prisma/prisma.service";
import { SettingsService } from "../src/settings/settings.service";
import { createFakePrisma } from "./fake-prisma";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

const firstOption = () => Object.fromEntries(QUESTIONS.map((q) => [q.key, q.options[0].value]));
const acceptAll = () => Object.fromEntries(QUESTIONS.map((q) => [q.key, { accept: q.options.map((o) => o.value), level: "PREFERENCE" }]));
const filters = (over: object = {}) => ({ ageMin: 18, ageMax: 99, maritalStatuses: ["NEVER_MARRIED", "DIVORCED", "WIDOWED"], locationScope: "ANYWHERE", ...over });
const form = (over: { self?: object; seek?: object; filters?: object } = {}) => ({
  self: { ...firstOption(), ...(over.self ?? {}) },
  seek: { ...acceptAll(), ...(over.seek ?? {}) },
  filters: filters(over.filters),
});

describe("Preferences and matching", () => {
  let app: INestApplication;
  let db: ReturnType<typeof createFakePrisma>;
  let sent: { text: string }[];

  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (p: string) => http().get(`/api/v1${p}`).set("Cookie", cookie),
    post: (p: string, body: object = {}) => http().post(`/api/v1${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
    put: (p: string, body: object = {}) => http().put(`/api/v1${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
    patch: (p: string, body: object = {}) => http().patch(`/api/v1${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
  });

  async function newUser(email: string, gender: "MALE" | "FEMALE" = "MALE", dateOfBirth = "1994-06-01"): Promise<string> {
    await http().post("/api/v1/auth/register").set("Origin", ORIGIN).send({
      email, password: PASSWORD, fullName: `${email.split("@")[0]} Person`, preferredName: email.split("@")[0], gender, dateOfBirth, maritalStatus: "NEVER_MARRIED",
    }).expect(202);
    const token = decodeURIComponent(sent[sent.length - 1].text.match(/token=([^\s&]+)/)![1]);
    await http().post("/api/v1/auth/verify-email").set("Origin", ORIGIN).send({ token }).expect(200);
    const res = await http().post("/api/v1/auth/login").set("Origin", ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return (res.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
  }

  const userId = (email: string) => db.users.rows.find((u: { email: string }) => u.email === email).id as string;
  const makeAdmin = (email: string) => (db.users.rows.find((u: { email: string }) => u.email === email).role = "ADMIN");
  const setSetting = async (key: string, value: number) => {
    db.settings.rows.length = 0;
    await db.settings.create({ data: { key, value } });
    app.get(SettingsService).clearCache();
  };
  const prefsFor = async (email: string, cookie: string, over: Parameters<typeof form>[0] = {}) => as(cookie).put("/preferences", form(over)).expect(200);
  const run = (cookie: string, dryRun = false) => as(cookie).post("/admin/matchmaking/run", { dryRun });
  const notes = (type: string) => db.notifications.rows.filter((n: { type: string }) => n.type === type);

  beforeEach(async () => {
    db = createFakePrisma();
    sent = [];
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db)
      .overrideProvider(EmailService).useValue({ send: async (_t: string, c: { text: string }) => void sent.push(c) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await setSetting("matching.requireProgramme", 0); // most tests are about matching, not the programme
  });

  afterEach(async () => app.close());

  // ───────────────────────── The form ─────────────────────────

  it("needs a signed-in user", async () => {
    await http().get("/api/v1/preferences").expect(401);
    await http().get("/api/v1/matches").expect(401);
  });

  it("opens the form only after the programme is finished", async () => {
    await setSetting("matching.requireProgramme", 1);
    const cookie = await newUser("a@example.com");
    const f = await as(cookie).get("/preferences").expect(200);
    expect(f.body.eligible).toBe(false);
    expect(f.body.ineligibleReason).toMatch(/programme/);
    const r = await as(cookie).put("/preferences", form()).expect(403);
    expect(r.body.code).toBe("NOT_ELIGIBLE");
    expect(db.prefSets.rows).toHaveLength(0);

    await db.enrollments.create({ data: { userId: userId("a@example.com"), programmeId: "p", status: "COMPLETED" } });
    await as(cookie).put("/preferences", form()).expect(200);
  });

  it("serves the questionnaire so the screen never hard-codes it", async () => {
    const cookie = await newUser("a@example.com");
    const f = await as(cookie).get("/preferences").expect(200);
    expect(f.body.eligible).toBe(true);
    expect(f.body.questions).toHaveLength(QUESTIONS.length);
    expect(f.body.nonNegotiableMax).toBe(6);
    expect(f.body.answers).toBeNull();
  });

  it("explains every problem with a submitted form at once", async () => {
    const cookie = await newUser("a@example.com");
    const r = await as(cookie).put("/preferences", { self: {}, seek: {}, filters: {} }).expect(400);
    expect(r.body.code).toBe("FORM_INVALID");
    expect(Object.keys(r.body.errors).length).toBeGreaterThan(QUESTIONS.length);
    expect(db.prefSets.rows).toHaveLength(0);

    const bad = form({ seek: { appearance_importance: { accept: ["very"], level: "NON_NEGOTIABLE" } } });
    const r2 = await as(cookie).put("/preferences", bad).expect(400);
    expect(r2.body.errors.appearance_importance).toMatch(/cannot be a non-negotiable/);
  });

  it("limits non-negotiables, and needs a country on the profile for a location filter", async () => {
    const cookie = await newUser("a@example.com");
    const many = Object.fromEntries(["prayer", "quran", "wants_children", "living", "debt", "career", "travel"].map((k) => [k, { accept: [QUESTIONS.find((q) => q.key === k)!.options[0].value], level: "NON_NEGOTIABLE" }]));
    const r = await as(cookie).put("/preferences", form({ seek: many })).expect(400);
    expect(r.body.errors.form).toMatch(/at most 6/);

    const loc = await as(cookie).put("/preferences", form({ filters: { locationScope: "SAME_COUNTRY" } })).expect(400);
    expect(loc.body.errors.filters).toMatch(/country/);
    await as(cookie).patch("/profile", { country: "Nigeria" }).expect(200);
    await as(cookie).put("/preferences", form({ filters: { locationScope: "SAME_COUNTRY" } })).expect(200);
  });

  it("saves, reads back, and keeps the original submission time when edited", async () => {
    const cookie = await newUser("a@example.com");
    const first = await as(cookie).put("/preferences", form({ seek: { prayer: { accept: ["five_daily", "most_days"], level: "NON_NEGOTIABLE", note: "Important to me" } } })).expect(200);
    expect(db.prefItems.rows).toHaveLength(QUESTIONS.length);
    expect(first.body.answers.seek.prayer).toEqual({ accept: ["five_daily", "most_days"], level: "NON_NEGOTIABLE", note: "Important to me" });
    expect(first.body.answers.self.prayer).toBe("five_daily");
    expect(first.body.submittedAt).toBeTruthy();

    const submittedAt = db.prefSets.rows[0].submittedAt;
    await as(cookie).put("/preferences", form({ seek: { prayer: { accept: ["five_daily"], level: "PREFERENCE" } } })).expect(200);
    expect(db.prefItems.rows).toHaveLength(QUESTIONS.length); // replaced, not duplicated
    expect(db.prefSets.rows[0].submittedAt).toEqual(submittedAt);
    expect(db.prefItems.rows.find((i: { key: string }) => i.key === "prayer").level).toBe("PREFERENCE");
  });

  it("lets a person pause and resume, but only once the form is done", async () => {
    const cookie = await newUser("a@example.com");
    await as(cookie).patch("/preferences/availability", { availability: "PAUSED" }).expect(409);
    await prefsFor("a@example.com", cookie);
    const paused = await as(cookie).patch("/preferences/availability", { availability: "PAUSED" }).expect(200);
    expect(paused.body.availability).toBe("PAUSED");
    await as(cookie).patch("/preferences/availability", { availability: "SOMETIMES" }).expect(400);
  });

  // ───────────────────────── Running matchmaking ─────────────────────────

  async function pair() {
    const m = await newUser("m@example.com", "MALE");
    const w = await newUser("w@example.com", "FEMALE");
    const admin = await newUser("admin@example.com", "MALE");
    makeAdmin("admin@example.com");
    await prefsFor("m@example.com", m);
    await prefsFor("w@example.com", w);
    return { m, w, admin };
  }

  it("keeps matchmaking to administrators", async () => {
    const m = await newUser("m@example.com");
    await run(m).expect(403);
    await as(m).post("/admin/matchmaking/exclusions", { emailA: "a@example.com", emailB: "b@example.com" }).expect(403);
  });

  it("previews a round without creating anything, and without revealing who", async () => {
    const { admin } = await pair();
    const r = await run(admin, true).expect(200);
    expect(r.body.dryRun).toBe(true);
    expect(r.body.created).toBe(0);
    expect(r.body.proposed).toHaveLength(1);
    expect(JSON.stringify(r.body)).not.toMatch(/@example\.com|Person/);
    expect(db.matches.rows).toHaveLength(0);
  });

  it("matches a compatible man and woman, tells both, and records it", async () => {
    const { m, w, admin } = await pair();
    const r = await run(admin).expect(200);
    expect(r.body.created).toBe(1);
    expect(db.matches.rows).toHaveLength(1);
    expect(db.matches.rows[0].status).toBe("ACTIVE");
    expect(db.matches.rows[0].stage).toBe("EXPECTATIONS_PENDING");
    expect(notes("MATCH_CREATED")).toHaveLength(2);
    expect(db.audit.rows.some((a: { action: string }) => a.action === "MATCH_CREATED")).toBe(true);

    const forMan = await as(m).get("/matches").expect(200);
    expect(forMan.body.current.introduction.name).toBe("w");
    expect(forMan.body.current.introduction.age).toBeGreaterThan(18);
    const forWoman = await as(w).get("/matches").expect(200);
    expect(forWoman.body.current.introduction.name).toBe("m");
  });

  it("shows only a basic introduction: no contact details, birth date, photo or scores", async () => {
    const { m, admin } = await pair();
    await run(admin).expect(200);
    const intro = JSON.stringify((await as(m).get("/matches").expect(200)).body);
    expect(intro).not.toMatch(/@example\.com|dateOfBirth|phone|photo|score|1994/i);
  });

  it("does not match people whose non-negotiables are not met, or who are the same sex", async () => {
    const m = await newUser("m@example.com", "MALE");
    const w = await newUser("w@example.com", "FEMALE");
    const m2 = await newUser("m2@example.com", "MALE");
    const admin = await newUser("admin@example.com", "MALE");
    makeAdmin("admin@example.com");
    // Her answer to prayer is not one he will accept
    await prefsFor("m@example.com", m, { seek: { prayer: { accept: ["five_daily"], level: "NON_NEGOTIABLE" } } });
    await prefsFor("w@example.com", w, { self: { prayer: "rarely" } });
    await prefsFor("m2@example.com", m2);
    const r = await run(admin).expect(200);
    // m cannot match w; m2 can match w, and the two men are never paired
    expect(r.body.created).toBe(1);
    const pairs = db.matches.rows.map((x: { userAId: string; userBId: string }) => [x.userAId, x.userBId].sort());
    expect(pairs).toEqual([[userId("m2@example.com"), userId("w@example.com")].sort()]);
    expect(r.body.stats.rejected.NON_NEGOTIABLE).toBe(1);
    expect(r.body.stats.rejected.SAME_GENDER).toBeGreaterThan(0);
  });

  it("applies hard filters in both directions", async () => {
    const m = await newUser("m@example.com", "MALE", "1994-06-01"); // about 32
    const w = await newUser("w@example.com", "FEMALE");
    const admin = await newUser("admin@example.com", "MALE");
    makeAdmin("admin@example.com");
    await prefsFor("m@example.com", m);
    await prefsFor("w@example.com", w, { filters: { ageMin: 18, ageMax: 25 } }); // she wants someone 25 or under
    const r = await run(admin).expect(200);
    expect(r.body.created).toBe(0);
    expect(r.body.stats.rejected.FILTER_AGE).toBe(1);
  });

  it("leaves people with a current match alone, and does not match anyone twice", async () => {
    const { admin } = await pair();
    await run(admin).expect(200);
    const again = await run(admin).expect(200);
    expect(again.body.created).toBe(0);
    expect(again.body.stats.candidates).toBe(0); // both are busy
    expect(db.matches.rows).toHaveLength(1);
  });

  it("skips people who are paused, unfinished, unverified or suspended", async () => {
    const m = await newUser("m@example.com", "MALE");
    const w = await newUser("w@example.com", "FEMALE");
    const admin = await newUser("admin@example.com", "MALE");
    makeAdmin("admin@example.com");
    await prefsFor("m@example.com", m);
    await prefsFor("w@example.com", w);

    await as(w).patch("/preferences/availability", { availability: "PAUSED" }).expect(200);
    expect((await run(admin, true).expect(200)).body.stats.candidates).toBe(1);
    await as(w).patch("/preferences/availability", { availability: "AVAILABLE" }).expect(200);

    db.users.rows.find((u: { email: string }) => u.email === "w@example.com").status = "SUSPENDED";
    expect((await run(admin, true).expect(200)).body.stats.candidates).toBe(1);
    db.users.rows.find((u: { email: string }) => u.email === "w@example.com").status = "ACTIVE";
    expect((await run(admin, true).expect(200)).body.proposed).toHaveLength(1);

    db.prefItems.rows.splice(0, 3); // a half-saved form must never be matchable
    expect((await run(admin, true).expect(200)).body.stats.candidates).toBe(1);
  });

  it("requires the programme to be finished when that rule is on", async () => {
    const { admin } = await pair();
    await setSetting("matching.requireProgramme", 1);
    expect((await run(admin, true).expect(200)).body.stats.candidates).toBe(0);
    await db.enrollments.create({ data: { userId: userId("m@example.com"), programmeId: "p", status: "COMPLETED" } });
    await db.enrollments.create({ data: { userId: userId("w@example.com"), programmeId: "p", status: "COMPLETED" } });
    expect((await run(admin, true).expect(200)).body.proposed).toHaveLength(1);
  });

  it("will not let someone change their preferences while a match is current", async () => {
    const { m, admin } = await pair();
    await run(admin).expect(200);
    const r = await as(m).put("/preferences", form()).expect(409);
    expect(r.body.code).toBe("HAS_ACTIVE_MATCH");
  });

  // ───────────────────────── Closing a pairing ─────────────────────────

  async function matched() {
    const m = await newUser("m@example.com", "MALE");
    const w = await newUser("w@example.com", "FEMALE");
    const w2 = await newUser("w2@example.com", "FEMALE");
    const admin = await newUser("admin@example.com", "MALE");
    makeAdmin("admin@example.com");
    await prefsFor("m@example.com", m);
    await prefsFor("w@example.com", w);
    await run(admin).expect(200);
    return { m, w, w2, admin, matchId: db.matches.rows[0].id as string };
  }

  it("closing a pairing is permanent for that pair, neutral to the other person, and gives a rest to the one who closed it", async () => {
    const { m, w, w2, admin, matchId } = await matched();
    const r = await as(m).post(`/matches/${matchId}/withdraw`, { reason: "Not the right fit" }).expect(200);
    expect(r.body.availableAfter).toBeTruthy();

    expect(db.matches.rows[0].status).toBe("CLOSED");
    expect(db.matches.rows[0].closureNote).toBe("This pairing has been closed.");
    expect(db.exclusions.rows).toHaveLength(1);
    const [low, high] = [userId("m@example.com"), userId("w@example.com")].sort();
    expect(db.exclusions.rows[0]).toMatchObject({ userLowId: low, userHighId: high });

    // The other person is told neutrally, with nothing about who closed it or why
    const told = notes("MATCH_CLOSED")[0];
    expect(told.userId).toBe(userId("w@example.com"));
    expect(told.body).not.toMatch(/withdr|reject|fail|not the right fit/i);
    expect(db.audit.rows.find((a: { action: string }) => a.action === "MATCH_WITHDRAWN").reason).toBe("Not the right fit");

    // Closed pairings reveal nothing about the other person
    const history = (await as(m).get("/matches").expect(200)).body;
    expect(history.current).toBeNull();
    expect(history.history).toHaveLength(1);
    expect(JSON.stringify(history)).not.toMatch(/introduction|"name"|"age"|occupation|education|location/);

    // The one who closed it rests; the other is free straight away
    const m2 = await newUser("m2@example.com", "MALE");
    await prefsFor("m2@example.com", m2);
    const next = await run(admin).expect(200);
    expect(next.body.created).toBe(1);
    const second = db.matches.rows[1];
    expect([second.userAId, second.userBId].sort()).toEqual([userId("m2@example.com"), userId("w@example.com")].sort());
    expect([second.userAId, second.userBId]).not.toContain(userId("m@example.com")); // still resting, and excluded from her anyway
    void w;
    void w2;
  });

  it("never matches a closed pair again, even after the rest period and with nobody else about", async () => {
    const { m, admin, matchId } = await matched();
    await as(m).post(`/matches/${matchId}/withdraw`).expect(200);
    const set = db.prefSets.rows.find((s: { userId: string }) => s.userId === userId("m@example.com"));
    expect(set.availableAfter.getTime()).toBeGreaterThan(Date.now());
    set.availableAfter = new Date(Date.now() - 1000);
    const r = await run(admin).expect(200);
    expect(r.body.created).toBe(0);
    expect(r.body.stats.excluded).toBe(1);
  });

  it("only participants can close a pairing, and only once", async () => {
    const { m, w2, matchId } = await matched();
    await as(w2).post(`/matches/${matchId}/withdraw`).expect(404);
    await as(m).post(`/matches/${matchId}/withdraw`).expect(200);
    const again = await as(m).post(`/matches/${matchId}/withdraw`).expect(409);
    expect(again.body.code).toBe("ALREADY_CLOSED");
  });

  it("lets an administrator stop two people ever being matched", async () => {
    const m = await newUser("m@example.com", "MALE");
    const w = await newUser("w@example.com", "FEMALE");
    const admin = await newUser("admin@example.com", "MALE");
    makeAdmin("admin@example.com");
    await prefsFor("m@example.com", m);
    await prefsFor("w@example.com", w);

    await as(admin).post("/admin/matchmaking/exclusions", { emailA: "w@example.com", emailB: "m@example.com", reason: "Known to each other" }).expect(200);
    const r = await run(admin).expect(200);
    expect(r.body.created).toBe(0);
    expect(r.body.stats.excluded).toBe(1);
    expect(db.audit.rows.find((a: { action: string }) => a.action === "MATCH_EXCLUDED").reason).toBe("Known to each other");

    await as(admin).post("/admin/matchmaking/exclusions", { emailA: "m@example.com", emailB: "m@example.com" }).expect(400);
    await as(admin).post("/admin/matchmaking/exclusions", { emailA: "nobody@example.com", emailB: "m@example.com" }).expect(404);
  });

  it("closing an exclusion on a current pairing closes that pairing too", async () => {
    const { admin, matchId } = await matched();
    const r = await as(admin).post("/admin/matchmaking/exclusions", { emailA: "m@example.com", emailB: "w@example.com" }).expect(200);
    expect(r.body.closedActiveMatch).toBe(true);
    expect(db.matches.rows.find((x: { id: string }) => x.id === matchId).status).toBe("CLOSED");
    expect(notes("MATCH_CLOSED")).toHaveLength(2);
  });

  // ───────────────────────── Notifications ─────────────────────────

  it("shows each person their own notifications, and lets them mark them read", async () => {
    const { m, w, admin } = await pair();
    await run(admin).expect(200);

    const mine = await as(m).get("/notifications").expect(200);
    expect(mine.body.unread).toBe(1);
    expect(mine.body.items[0]).toMatchObject({ type: "MATCH_CREATED", title: "You have a new match", readAt: null });
    expect(JSON.stringify(mine.body)).not.toMatch(/score|@example\.com/);

    await as(m).post("/notifications/read").expect(200);
    expect((await as(m).get("/notifications").expect(200)).body.unread).toBe(0);
    // Reading mine does not touch hers
    expect((await as(w).get("/notifications").expect(200)).body.unread).toBe(1);
    await http().get("/api/v1/notifications").expect(401);
  });
});

