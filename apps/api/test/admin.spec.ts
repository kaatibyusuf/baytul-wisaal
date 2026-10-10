import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "@node-rs/argon2";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AuditService } from "../src/audit/audit.service";
import { EmailService } from "../src/email/email.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { SettingsService } from "../src/settings/settings.service";
import { createFakePrisma } from "./fake-prisma";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const REASON = "Following up on a report from support";

describe("Administration", () => {
  let app: INestApplication;
  let db: ReturnType<typeof createFakePrisma>;
  let passwordHash: string;

  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (p: string) => http().get(`/api/v1${p}`).set("Cookie", cookie),
    post: (p: string, body: object = {}) => http().post(`/api/v1${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
    put: (p: string, body: object = {}) => http().put(`/api/v1${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
    delete: (p: string) => http().delete(`/api/v1${p}`).set("Origin", ORIGIN).set("Cookie", cookie),
  });

  /** Creates an account directly, so tests are not limited by the sign-up rate limit. */
  async function account(email: string, over: Record<string, unknown> = {}, gender: "MALE" | "FEMALE" = "MALE") {
    const user = await db.users.create({ data: { email, passwordHash, role: "USER", status: "ACTIVE", emailVerifiedAt: new Date(), ...over } });
    await db.profiles.create({
      data: { userId: user.id, fullName: `${email.split("@")[0]} Person`, gender, dateOfBirth: new Date("1994-06-01"), maritalStatus: "NEVER_MARRIED", phone: "+2348012345678", country: "Nigeria", region: "Lagos" },
    });
    return user.id as string;
  }
  async function signIn(email: string): Promise<string> {
    const res = await http().post("/api/v1/auth/login").set("Origin", ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return (res.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
  }
  async function actor(email: string, role: string) {
    const id = await account(email, { role });
    return { id, cookie: await signIn(email) };
  }

  beforeAll(async () => {
    passwordHash = await hash(PASSWORD);
  });

  beforeEach(async () => {
    db = createFakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db)
      .overrideProvider(EmailService).useValue({ send: async () => undefined })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterEach(async () => app.close());

  const audit = (action: string) => db.audit.rows.filter((a: { action: string }) => a.action === action);

  // ───────────────────────── Access ─────────────────────────

  it("keeps every admin endpoint to administrators", async () => {
    const member = await actor("member@example.com", "USER");
    const mod = await actor("mod@example.com", "MODERATOR");
    const targetId = await account("target@example.com");
    const calls: [string, string, object?][] = [
      ["get", "/admin/users"], ["get", `/admin/users/${targetId}`], ["post", `/admin/users/${targetId}/status`, { status: "SUSPENDED", reason: REASON }],
      ["get", "/admin/audit"], ["get", "/admin/settings"], ["put", "/admin/settings/compat.minItems", { value: 6, reason: REASON }],
      ["get", "/admin/programme/export"], ["post", "/admin/programme/import", { curriculum: {}, dryRun: true }],
    ];
    for (const who of [member, mod]) {
      for (const [method, path, body] of calls) {
        const r = await (as(who.cookie) as any)[method](path, body);
        expect([path, r.status]).toEqual([path, 403]);
      }
    }
    for (const [method, path, body] of calls) {
      const r = await (http() as any)[method](`/api/v1${path}`).set("Origin", ORIGIN).send(body);
      expect([path, r.status]).toEqual([path, 401]);
    }
  });

  // ───────────────────────── Finding people ─────────────────────────

  it("searches, filters and pages through members", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    for (let i = 0; i < 30; i++) await account(`member${String(i).padStart(2, "0")}@example.com`);
    await account("suspended.sam@example.com", { status: "SUSPENDED" });

    const first = await as(admin.cookie).get("/admin/users").expect(200);
    expect(first.body).toMatchObject({ page: 1, pageSize: 25, total: 32 });
    expect(first.body.items).toHaveLength(25);
    expect((await as(admin.cookie).get("/admin/users?page=2").expect(200)).body.items).toHaveLength(7);

    const byEmail = await as(admin.cookie).get("/admin/users?q=member07").expect(200);
    expect(byEmail.body.items.map((u: { email: string }) => u.email)).toEqual(["member07@example.com"]);
    const byName = await as(admin.cookie).get("/admin/users?q=SAM%20PERSON").expect(200);
    expect(byName.body.items.map((u: { email: string }) => u.email)).toEqual(["suspended.sam@example.com"]);
    const bySuspended = await as(admin.cookie).get("/admin/users?status=SUSPENDED").expect(200);
    expect(bySuspended.body.total).toBe(1);
    expect((await as(admin.cookie).get("/admin/users?role=ADMIN").expect(200)).body.total).toBe(1);
    expect((await as(admin.cookie).get("/admin/users?q=nobody-here").expect(200)).body.items).toEqual([]);
    expect(JSON.stringify(first.body)).not.toMatch(/passwordHash|argon2/);
  });

  it("shows what is needed to look after an account, and nothing private", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const id = await account("member@example.com");
    const d = await as(admin.cookie).get(`/admin/users/${id}`).expect(200);
    expect(d.body).toMatchObject({ email: "member@example.com", role: "USER", status: "ACTIVE", emailVerified: true, hasActiveMatch: false });
    expect(d.body.profile).toMatchObject({ fullName: "member Person", gender: "MALE", location: "Lagos, Nigeria" });
    expect(d.body.profile.age).toBeGreaterThan(18);
    expect(d.body.preferences).toEqual({ submitted: false, availability: null });
    expect(d.body.programme).toBeNull(); // no programme has been imported yet, and the account still opens
    const text = JSON.stringify(d.body);
    expect(text).not.toMatch(/passwordHash|argon2|1994|dateOfBirth|selfAnswers|originalText/);
    await as(admin.cookie).get("/admin/users/c000000000000000000000999").expect(404);
  });

  // ───────────────────────── Changing an account ─────────────────────────

  it("needs a reason for every change, and records it", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const id = await account("member@example.com");
    await as(admin.cookie).post(`/admin/users/${id}/status`, { status: "RESTRICTED" }).expect(400);
    await as(admin.cookie).post(`/admin/users/${id}/status`, { status: "RESTRICTED", reason: "no" }).expect(400);
    await as(admin.cookie).post(`/admin/users/${id}/status`, { status: "BANNED", reason: REASON }).expect(400);
    expect(db.users.rows.find((u: { id: string }) => u.id === id).status).toBe("ACTIVE");

    await as(admin.cookie).post(`/admin/users/${id}/status`, { status: "RESTRICTED", reason: REASON }).expect(200);
    const log = audit("USER_STATUS_CHANGED")[0];
    expect(log).toMatchObject({ actorId: admin.id, targetId: id, reason: REASON });
    expect(log.metadata).toMatchObject({ from: "ACTIVE", to: "RESTRICTED" });
    // The person is told, and can still sign in
    expect(db.notifications.rows.find((n: { type: string }) => n.type === "ACCOUNT_RESTRICTED").userId).toBe(id);
    await signIn("member@example.com");
    await as(admin.cookie).post(`/admin/users/${id}/status`, { status: "RESTRICTED", reason: REASON }).expect(409); // no change
  });

  it("suspending signs the person out everywhere and closes their pairing neutrally", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const memberId = await account("member@example.com");
    const otherId = await account("other@example.com", {}, "FEMALE");
    const member = await signIn("member@example.com");
    await as(member).get("/users/me").expect(200);
    const match = await db.matches.create({ data: { userAId: memberId, userBId: otherId } });

    const r = await as(admin.cookie).post(`/admin/users/${memberId}/status`, { status: "SUSPENDED", reason: REASON }).expect(200);
    expect(r.body.closedMatch).toBe(true);

    await as(member).get("/users/me").expect(401); // the old session no longer works
    await http().post("/api/v1/auth/login").set("Origin", ORIGIN).send({ email: "member@example.com", password: PASSWORD }).expect(403);
    expect(db.matches.rows.find((m: { id: string }) => m.id === match.id).status).toBe("CLOSED");
    expect(db.exclusions.rows).toHaveLength(1);
    const told = db.notifications.rows.find((n: { type: string }) => n.type === "MATCH_CLOSED");
    expect(told.userId).toBe(otherId);
    expect(told.body).not.toMatch(/suspend|banned|report|reason/i);
  });

  it("restores an account, but not one whose email was never verified", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const id = await account("member@example.com", { status: "SUSPENDED" });
    await as(admin.cookie).post(`/admin/users/${id}/status`, { status: "ACTIVE", reason: REASON }).expect(200);
    await signIn("member@example.com");

    const unverified = await account("new@example.com", { status: "PENDING_VERIFICATION", emailVerifiedAt: null });
    const r = await as(admin.cookie).post(`/admin/users/${unverified}/status`, { status: "ACTIVE", reason: REASON }).expect(409);
    expect(r.body.code).toBe("NOT_VERIFIED");
  });

  it("can verify an email by hand, once", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const id = await account("new@example.com", { status: "PENDING_VERIFICATION", emailVerifiedAt: null });
    await as(admin.cookie).post(`/admin/users/${id}/verify-email`, {}).expect(400); // reason needed
    await as(admin.cookie).post(`/admin/users/${id}/verify-email`, { reason: "Confirmed by phone" }).expect(200);
    expect(db.users.rows.find((u: { id: string }) => u.id === id)).toMatchObject({ status: "ACTIVE" });
    expect(audit("USER_EMAIL_VERIFIED_MANUALLY")[0].reason).toBe("Confirmed by phone");
    await as(admin.cookie).post(`/admin/users/${id}/verify-email`, { reason: "Again please" }).expect(409);
  });

  it("nobody can change their own account, and administrators cannot manage each other", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const other = await actor("admin2@example.com", "ADMIN");
    const sup = await actor("super@example.com", "SUPER_ADMIN");
    const mod = await account("mod@example.com", { role: "MODERATOR" });

    const own = await as(admin.cookie).post(`/admin/users/${admin.id}/status`, { status: "SUSPENDED", reason: REASON }).expect(403);
    expect(own.body.code).toBe("OWN_ACCOUNT");
    const peer = await as(admin.cookie).post(`/admin/users/${other.id}/status`, { status: "SUSPENDED", reason: REASON }).expect(403);
    expect(peer.body.code).toBe("NOT_PERMITTED");
    await as(admin.cookie).post(`/admin/users/${sup.id}/status`, { status: "SUSPENDED", reason: REASON }).expect(403);

    // An administrator can look after moderators, and a super administrator after administrators
    await as(admin.cookie).post(`/admin/users/${mod}/status`, { status: "RESTRICTED", reason: REASON }).expect(200);
    await as(sup.cookie).post(`/admin/users/${other.id}/status`, { status: "RESTRICTED", reason: REASON }).expect(200);
  });

  it("only a super administrator can change roles, and never their own", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const sup = await actor("super@example.com", "SUPER_ADMIN");
    const id = await account("member@example.com");

    await as(admin.cookie).post(`/admin/users/${id}/role`, { role: "MODERATOR", reason: REASON }).expect(403);
    await as(sup.cookie).post(`/admin/users/${id}/role`, { role: "KING", reason: REASON }).expect(400);
    await as(sup.cookie).post(`/admin/users/${id}/role`, { role: "MODERATOR" }).expect(400);
    await as(sup.cookie).post(`/admin/users/${id}/role`, { role: "MODERATOR", reason: REASON }).expect(200);
    expect(db.users.rows.find((u: { id: string }) => u.id === id).role).toBe("MODERATOR");
    expect(audit("USER_ROLE_CHANGED")[0].metadata).toMatchObject({ from: "USER", to: "MODERATOR" });
    await as(sup.cookie).post(`/admin/users/${sup.id}/role`, { role: "USER", reason: REASON }).expect(403);
    await as(sup.cookie).post(`/admin/users/${id}/role`, { role: "MODERATOR", reason: REASON }).expect(409);
  });

  it("can give extra time to someone whose programme ran out", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const id = await account("member@example.com");
    await as(admin.cookie).post(`/admin/users/${id}/programme/extend`, { days: 7, reason: REASON }).expect(409); // not started
    const e = await db.enrollments.create({ data: { userId: id, programmeId: "p", status: "EXPIRED", dueAt: new Date(Date.now() - 86400000) } });

    await as(admin.cookie).post(`/admin/users/${id}/programme/extend`, { days: 0, reason: REASON }).expect(400);
    await as(admin.cookie).post(`/admin/users/${id}/programme/extend`, { days: 91, reason: REASON }).expect(400);
    const r = await as(admin.cookie).post(`/admin/users/${id}/programme/extend`, { days: 7, reason: REASON }).expect(200);
    const row = db.enrollments.rows.find((x: { id: string }) => x.id === e.id);
    expect(row.status).toBe("IN_PROGRESS");
    expect(new Date(r.body.dueAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86400000);

    row.status = "COMPLETED";
    await as(admin.cookie).post(`/admin/users/${id}/programme/extend`, { days: 7, reason: REASON }).expect(409);
  });

  // ───────────────────────── Audit log ─────────────────────────

  it("shows who did what, can be filtered, and cannot be changed", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const id = await account("member@example.com");
    await as(admin.cookie).post(`/admin/users/${id}/status`, { status: "RESTRICTED", reason: REASON }).expect(200);
    await db.audit.create({ data: { actorId: "system", action: "ASSESSMENT_EVALUATED", targetType: "AssessmentSession", targetId: "s1" } });

    const all = await as(admin.cookie).get("/admin/audit").expect(200);
    expect(all.body.total).toBe(2);
    const mine = all.body.items.find((i: { action: string }) => i.action === "USER_STATUS_CHANGED");
    expect(mine).toMatchObject({ actor: "admin@example.com", reason: REASON, targetId: id });
    expect(all.body.items.find((i: { action: string }) => i.action === "ASSESSMENT_EVALUATED").actor).toBe("System");

    expect((await as(admin.cookie).get("/admin/audit?action=USER_STATUS_CHANGED").expect(200)).body.total).toBe(1);
    expect((await as(admin.cookie).get(`/admin/audit?targetId=${id}`).expect(200)).body.total).toBe(1);
    expect((await as(admin.cookie).get("/admin/audit?action=NOTHING").expect(200)).body.items).toEqual([]);

    // Append-only: there is no route that edits or removes an entry
    const entryId = mine.id;
    for (const r of [await as(admin.cookie).put(`/admin/audit/${entryId}`, {}), await as(admin.cookie).delete(`/admin/audit/${entryId}`), await as(admin.cookie).post("/admin/audit", {})]) {
      expect(r.status).toBe(404);
    }
    const svc = app.get(AuditService) as unknown as Record<string, unknown>;
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(svc)).filter((n) => /update|delete|remove|edit/i.test(n))).toEqual([]);
  });

  it("pages through a long log", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    for (let i = 0; i < 60; i++) await db.audit.create({ data: { actorId: "system", action: "TEST_EVENT", targetType: "T", targetId: `t${i}` } });
    const p1 = await as(admin.cookie).get("/admin/audit?action=TEST_EVENT").expect(200);
    expect(p1.body).toMatchObject({ total: 60, page: 1, pageSize: 50 });
    expect(p1.body.items).toHaveLength(50);
    expect((await as(admin.cookie).get("/admin/audit?action=TEST_EVENT&page=2").expect(200)).body.items).toHaveLength(10);
  });

  // ───────────────────────── Settings ─────────────────────────

  it("lists every setting with its limits and current value", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const list = (await as(admin.cookie).get("/admin/settings").expect(200)).body;
    expect(list.length).toBeGreaterThan(20);
    const s = list.find((x: { key: string }) => x.key === "compat.maxNeedsDiscussion");
    expect(s).toMatchObject({ value: 10, default: 10, isDefault: true, min: 0, group: "Compatibility" });
    expect(list.find((x: { key: string }) => x.key === "matching.requireProgramme")).toMatchObject({ boolean: true, sensitive: true });
  });

  it("changes a setting with a reason, within limits, and it takes effect straight away", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const put = (key: string, body: object) => as(admin.cookie).put(`/admin/settings/${key}`, body);

    await put("compat.maxNeedsDiscussion", { value: 5 }).then((r) => expect(r.status).toBe(400)); // reason needed
    await put("compat.maxNeedsDiscussion", { value: 999, reason: REASON }).then((r) => expect(r.status).toBe(400));
    await put("compat.maxNeedsDiscussion", { value: 2.5, reason: REASON }).then((r) => expect(r.status).toBe(400));
    await put("compat.maxNeedsDiscussion", { value: "lots", reason: REASON }).then((r) => expect(r.status).toBe(400));
    await put("not.a.setting", { value: 1, reason: REASON }).then((r) => expect(r.status).toBe(404));
    expect(db.settings.rows).toHaveLength(0);

    const r = await put("compat.maxNeedsDiscussion", { value: 5, reason: REASON });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ key: "compat.maxNeedsDiscussion", value: 5, previous: 10 });
    expect(await app.get(SettingsService).get("compat.maxNeedsDiscussion", 10)).toBe(5);
    expect(audit("SETTING_CHANGED")[0]).toMatchObject({ actorId: admin.id, targetId: "compat.maxNeedsDiscussion", reason: REASON });
    expect(audit("SETTING_CHANGED")[0].metadata).toEqual({ from: 10, to: 5 });

    const list = (await as(admin.cookie).get("/admin/settings").expect(200)).body;
    expect(list.find((x: { key: string }) => x.key === "compat.maxNeedsDiscussion")).toMatchObject({ value: 5, isDefault: false });
  });

  it("keeps related settings consistent with each other", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const put = (key: string, value: number) => as(admin.cookie).put(`/admin/settings/${key}`, { value, reason: REASON });
    expect((await put("programme.lessonMinSeconds", 500)).status).toBe(400); // more than the longest (120)
    expect((await put("programme.lessonMaxSeconds", 5)).status).toBe(400); // less than the shortest (10)
    expect((await put("compat.minItems", 30)).status).toBe(400); // more than the most (25)
    expect((await put("programme.lessonMaxSeconds", 200)).status).toBe(200);
    expect((await put("programme.lessonMinSeconds", 150)).status).toBe(200);
    expect((await put("matching.requireProgramme", 2)).status).toBe(400);
  });

  // ───────────────────────── Curriculum ─────────────────────────

  const curriculum = () => ({
    programme: { slug: "marriage-readiness", title: "Marriage Readiness Programme", totalDays: 2 },
    days: [
      { day: 1, title: "Welcome", activities: [{ type: "LESSON", title: "Start", body: "## Hello\n\nWelcome to the programme." }] },
      { day: 2, title: "Next", activities: [{ type: "REFLECTION", title: "Think", prompt: "What do you hope for?" }] },
    ],
  });

  it("previews an import without writing, then imports, records it, and does nothing the second time", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    await as(admin.cookie).get("/admin/programme/export").expect(404); // nothing yet

    const preview = await as(admin.cookie).post("/admin/programme/import", { curriculum: curriculum(), dryRun: true }).expect(200);
    expect(preview.body).toMatchObject({ dryRun: true, programme: "created", days: { created: 2 }, activities: { created: 2 } });
    expect(db.programme.rows).toHaveLength(0);
    expect(audit("CURRICULUM_IMPORTED")).toHaveLength(0);

    const real = await as(admin.cookie).post("/admin/programme/import", { curriculum: curriculum() }).expect(200);
    expect(real.body.dryRun).toBe(false);
    expect(db.programme.rows).toHaveLength(1);
    expect(db.activities.rows).toHaveLength(2);
    expect(audit("CURRICULUM_IMPORTED")[0]).toMatchObject({ actorId: admin.id, targetId: "marriage-readiness" });

    const again = await as(admin.cookie).post("/admin/programme/import", { curriculum: curriculum() }).expect(200);
    expect(again.body).toMatchObject({ programme: "unchanged", days: { unchanged: 2 }, activities: { unchanged: 2 } });

    const exported = (await as(admin.cookie).get("/admin/programme/export").expect(200)).body;
    expect(exported.days).toHaveLength(2);
    const roundTrip = await as(admin.cookie).post("/admin/programme/import", { curriculum: exported, dryRun: true }).expect(200);
    expect(roundTrip.body).toMatchObject({ programme: "unchanged", activities: { unchanged: 2 }, warnings: [] });
  });

  it("rejects a bad file with every problem and where it is, and writes nothing", async () => {
    const admin = await actor("admin@example.com", "ADMIN");
    const bad = curriculum() as any;
    bad.days[0].activities[0].titel = "typo";
    bad.days[1].activities[0].minWords = 1;
    const r = await as(admin.cookie).post("/admin/programme/import", { curriculum: bad }).expect(400);
    expect(r.body.code).toBe("CURRICULUM_INVALID");
    expect(r.body.problems.length).toBeGreaterThanOrEqual(2);
    expect(r.body.problems[0]).toHaveProperty("path");
    expect(db.programme.rows).toHaveLength(0);
    expect(audit("CURRICULUM_IMPORTED")).toHaveLength(0);
    await as(admin.cookie).post("/admin/programme/import", { curriculum: "not an object" }).expect(400);
  });
});
