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
const EXPLAIN = "This is how I honestly feel, and here is why it matters to me";

const firstOption = () => Object.fromEntries(QUESTIONS.map((q) => [q.key, q.options[0].value]));
const acceptAll = () => Object.fromEntries(QUESTIONS.map((q) => [q.key, { accept: q.options.map((o) => o.value), level: "PREFERENCE" }]));
const prefs = () => ({
  self: firstOption(),
  seek: acceptAll(),
  filters: { ageMin: 18, ageMax: 99, maritalStatuses: ["NEVER_MARRIED", "DIVORCED", "WIDOWED"], locationScope: "ANYWHERE" },
});

const list = (n: number, tag: string, over: object = {}) =>
  Array.from({ length: n }, (_, i) => ({ category: "religion", statement: `${tag} expectation number ${i} about our life together`, level: "PREFERENCE", ...over }));

describe("Post-match flow", () => {
  let app: INestApplication;
  let db: ReturnType<typeof createFakePrisma>;
  let sent: { text: string }[];

  const http = () => request(app.getHttpServer());
  const as = (cookie: string) => ({
    get: (p: string) => http().get(`/api/v1${p}`).set("Cookie", cookie),
    post: (p: string, body: object = {}) => http().post(`/api/v1${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
    put: (p: string, body: object = {}) => http().put(`/api/v1${p}`).set("Origin", ORIGIN).set("Cookie", cookie).send(body),
  });

  async function newUser(email: string, gender: "MALE" | "FEMALE"): Promise<string> {
    await http().post("/api/v1/auth/register").set("Origin", ORIGIN).send({
      email, password: PASSWORD, fullName: `${email.split("@")[0]} Person`, preferredName: email.split("@")[0], gender, dateOfBirth: "1994-06-01", maritalStatus: "NEVER_MARRIED",
    }).expect(202);
    const token = decodeURIComponent(sent[sent.length - 1].text.match(/token=([^\s&]+)/)![1]);
    await http().post("/api/v1/auth/verify-email").set("Origin", ORIGIN).send({ token }).expect(200);
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
  const notes = (type: string) => db.notifications.rows.filter((n: { type: string }) => n.type === type);
  const userId = (email: string) => db.users.rows.find((u: { email: string }) => u.email === email).id as string;

  /** A man and a woman who have been matched, plus an administrator. */
  async function matched() {
    const m = await newUser("m@example.com", "MALE");
    const w = await newUser("w@example.com", "FEMALE");
    const admin = await newUser("admin@example.com", "MALE");
    db.users.rows.find((u: { email: string }) => u.email === "admin@example.com").role = "ADMIN";
    await as(m).put("/preferences", prefs()).expect(200);
    await as(w).put("/preferences", prefs()).expect(200);
    await as(admin).post("/admin/matchmaking/run", { dryRun: false }).expect(200);
    return { m, w, admin, matchId: db.matches.rows[0].id as string };
  }

  const submitExpectations = (cookie: string, matchId: string, items: object[], submit = true) =>
    as(cookie).put(`/matches/${matchId}/expectations`, { items, submit });

  /** Both people write and submit their expectations. */
  async function bothSubmitted(over: { m?: object[]; w?: object[] } = {}) {
    const base = await matched();
    await submitExpectations(base.m, base.matchId, over.m ?? list(5, "His")).then((r) => expect(r.status).toBe(200));
    await submitExpectations(base.w, base.matchId, over.w ?? list(5, "Her")).then((r) => expect(r.status).toBe(200));
    return base;
  }

  const responsesFor = async (cookie: string, matchId: string, type: string | ((i: number) => string) = "AGREE") => {
    const v = await as(cookie).get(`/matches/${matchId}`).expect(200);
    return v.body.theirExpectations.map((it: { id: string }, i: number) => ({
      itemId: it.id,
      type: typeof type === "function" ? type(i) : type,
      explanation: EXPLAIN,
    }));
  };
  const respond = async (cookie: string, matchId: string, type: string | ((i: number) => string) = "AGREE") =>
    as(cookie).put(`/matches/${matchId}/responses`, { responses: await responsesFor(cookie, matchId, type), submit: true });

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
    await setSettings({ "matching.requireProgramme": 0 });
  });

  afterEach(async () => app.close());

  // ───────────────────────── Access ─────────────────────────

  it("needs a signed-in participant", async () => {
    const { matchId } = await matched();
    await http().get(`/api/v1/matches/${matchId}`).expect(401);
    const stranger = await newUser("x@example.com", "MALE");
    await as(stranger).get(`/matches/${matchId}`).expect(404);
    await submitExpectations(stranger, matchId, list(5, "Mine")).then((r) => expect(r.status).toBe(404));
    await as(stranger).put(`/matches/${matchId}/responses`, { responses: [], submit: false }).then((r) => expect(r.status).toBe(404));
  });

  // ───────────────────────── Expectations ─────────────────────────

  it("starts empty, and tells the screen the rules", async () => {
    const { m, matchId } = await matched();
    const v = await as(m).get(`/matches/${matchId}`).expect(200);
    expect(v.body.stage).toBe("EXPECTATIONS_PENDING");
    expect(v.body.myExpectations).toEqual([]);
    expect(v.body.theirExpectations).toBeNull();
    expect(v.body.progress).toEqual({ you: { expectationsSubmitted: false, responsesSubmitted: false }, other: { expectationsSubmitted: false, responsesSubmitted: false } });
    expect(v.body.rules).toMatchObject({ minItems: 5, maxItems: 25, maxPhysicalItems: 2, maxNonNegotiable: 6, minExplanationWords: 8 });
    expect(v.body.rules.categories.length).toBeGreaterThan(5);
  });

  it("saves a draft, replaces it on the next save, and keeps it private", async () => {
    const { m, w, matchId } = await matched();
    await submitExpectations(m, matchId, list(2, "Draft"), false).then((r) => expect(r.status).toBe(200));
    expect(db.expectations.rows[0].submittedAt).toBeNull();
    await submitExpectations(m, matchId, list(3, "Second"), false).then((r) => expect(r.status).toBe(200));
    expect(db.expItems.rows).toHaveLength(3);
    const mine = await as(m).get(`/matches/${matchId}`).expect(200);
    expect(mine.body.myExpectations.map((x: { statement: string }) => x.statement)[0]).toMatch(/^Second expectation number 0/);
    const hers = await as(w).get(`/matches/${matchId}`).expect(200);
    expect(JSON.stringify(hers.body)).not.toMatch(/Second expectation/);
    expect(hers.body.progress.other.expectationsSubmitted).toBe(false);
  });

  it("will not submit an incomplete or over-limit form, and says which expectation has the problem", async () => {
    const { m, matchId } = await matched();
    const few = await submitExpectations(m, matchId, list(3, "A")).then((r) => r);
    expect(few.status).toBe(400);
    expect(few.body.code).toBe("FORM_INVALID");
    expect(few.body.errors.form).toMatch(/at least 5/);

    const items = [...list(5, "B"), { category: "religion", statement: "no", level: "PREFERENCE" }];
    const bad = await submitExpectations(m, matchId, items);
    expect(bad.body.errors.item5).toMatch(/a little more/);

    const six = list(7, "C", { level: "NON_NEGOTIABLE" });
    expect((await submitExpectations(m, matchId, six)).body.errors.form).toMatch(/at most 6/);

    const physical = [...list(5, "D"), { category: "physical", statement: "I would like us both to stay fit", level: "NON_NEGOTIABLE" }];
    expect((await submitExpectations(m, matchId, physical)).body.errors.item5).toMatch(/cannot be non-negotiable/);
    expect(db.expectations.rows.every((e: { submittedAt: unknown }) => e.submittedAt === null)).toBe(true);
  });

  it("records firmness, marks non-negotiables as deal-breakers, and keeps the order", async () => {
    const { m, matchId } = await matched();
    const items = [
      { category: "family", statement: "I want to live separately from both families", level: "NON_NEGOTIABLE" },
      ...list(4, "More", { compromiseNote: "Open to a middle way" }),
    ];
    await submitExpectations(m, matchId, items).then((r) => expect(r.status).toBe(200));
    const rows = db.expItems.rows.slice().sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    expect(rows[0]).toMatchObject({ statement: "I want to live separately from both families", level: "NON_NEGOTIABLE", isDealBreaker: true, position: 0 });
    expect(rows[1]).toMatchObject({ isDealBreaker: false, compromiseNote: "Open to a middle way", position: 1 });
  });

  it("shows neither person the other's expectations until both have submitted", async () => {
    const { m, w, matchId } = await matched();
    await submitExpectations(m, matchId, list(5, "His")).then((r) => expect(r.status).toBe(200));

    const hers = await as(w).get(`/matches/${matchId}`).expect(200);
    expect(hers.body.progress.other.expectationsSubmitted).toBe(true);
    expect(hers.body.theirExpectations).toBeNull();
    expect(hers.body.stage).toBe("EXPECTATIONS_PENDING");
    expect(JSON.stringify(hers.body)).not.toMatch(/His expectation/);

    await submitExpectations(w, matchId, list(5, "Her")).then((r) => expect(r.status).toBe(200));
    const after = await as(w).get(`/matches/${matchId}`).expect(200);
    expect(after.body.stage).toBe("RESPONSE_PENDING");
    expect(after.body.theirExpectations).toHaveLength(5);
    expect(after.body.theirExpectations[0]).toMatchObject({ category: "religion", level: "PREFERENCE", myResponse: null });
    expect(JSON.stringify(after.body)).not.toMatch(/isDealBreaker/);
    expect(notes("MATCH_EXPECTATIONS_IN")).toHaveLength(2);
  });

  it("locks expectations once submitted, and once the stage has moved on", async () => {
    const { m, matchId } = await bothSubmitted();
    // After both submitted the stage has moved on
    const late = await submitExpectations(m, matchId, list(5, "Edit")).then((r) => r);
    expect(late.status).toBe(409);
    expect(["ALREADY_SUBMITTED", "STAGE_CLOSED"]).toContain(late.body.code);
  });

  it("will not accept a second submission from someone who has already submitted", async () => {
    const { m, matchId } = await matched();
    await submitExpectations(m, matchId, list(5, "His")).then((r) => expect(r.status).toBe(200));
    const again = await submitExpectations(m, matchId, list(5, "Changed"));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ALREADY_SUBMITTED");
    expect(db.expItems.rows.every((i: { statement: string }) => i.statement.startsWith("His"))).toBe(true);
  });

  // ───────────────────────── Responses ─────────────────────────

  it("is not time to respond until both expectations are in", async () => {
    const { m, matchId } = await matched();
    await submitExpectations(m, matchId, list(5, "His")).then((r) => expect(r.status).toBe(200));
    const r = await as(m).put(`/matches/${matchId}/responses`, { responses: [], submit: true });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("NOT_READY");
  });

  it("will not take a bare yes: every response needs a real explanation", async () => {
    const { w, matchId } = await bothSubmitted();
    const base = await responsesFor(w, matchId);
    const weak = base.map((r: object, i: number) => (i === 0 ? { ...r, explanation: "yes" } : r));
    const r = await as(w).put(`/matches/${matchId}/responses`, { responses: weak, submit: true });
    expect(r.status).toBe(400);
    expect(r.body.errors[base[0].itemId]).toMatch(/at least 8 words/);
    expect(db.expectations.rows.every((e: { responsesSubmittedAt: unknown }) => e.responsesSubmittedAt === null)).toBe(true);
  });

  it("requires every expectation to be answered before submitting, but lets a draft be partial", async () => {
    const { w, matchId } = await bothSubmitted();
    const all = await responsesFor(w, matchId);
    const partial = await as(w).put(`/matches/${matchId}/responses`, { responses: all.slice(0, 2), submit: false });
    expect(partial.status).toBe(200);
    expect(partial.body.theirExpectations.filter((x: { myResponse: unknown }) => x.myResponse).length).toBe(2);

    const tooFew = await as(w).put(`/matches/${matchId}/responses`, { responses: all.slice(0, 2), submit: true });
    expect(tooFew.status).toBe(400);
    expect(tooFew.body.errors[all[4].itemId]).toMatch(/respond to this/);
  });

  it("does not need an explanation for 'not applicable'", async () => {
    const { w, matchId } = await bothSubmitted();
    const all = (await responsesFor(w, matchId)).map((r: object, i: number) => (i === 0 ? { ...r, type: "NOT_APPLICABLE", explanation: "" } : r));
    await as(w).put(`/matches/${matchId}/responses`, { responses: all, submit: true }).then((r) => expect(r.status).toBe(200));
  });

  it("will not accept a response to an expectation from somewhere else", async () => {
    const { w, matchId } = await bothSubmitted();
    const all = await responsesFor(w, matchId);
    const r = await as(w).put(`/matches/${matchId}/responses`, { responses: [...all, { itemId: "c000000000000000000000999", type: "AGREE", explanation: EXPLAIN }], submit: true });
    expect(r.status).toBe(400);
  });

  it("keeps responses private until the result is known", async () => {
    const { m, w, matchId } = await bothSubmitted();
    await as(w).put(`/matches/${matchId}/responses`, { responses: (await responsesFor(w, matchId)).map((r: object) => ({ ...r, explanation: "Her private reason for answering about his item" })), submit: true }).then((r) => expect(r.status).toBe(200));

    const his = await as(m).get(`/matches/${matchId}`).expect(200);
    expect(his.body.stage).toBe("RESPONSE_PENDING");
    expect(his.body.result).toBeNull();
    expect(JSON.stringify(his.body)).not.toMatch(/Her private reason/);
    expect(his.body.progress.other.responsesSubmitted).toBe(true);
    expect(his.body.progress.you.responsesSubmitted).toBe(false);

    await as(w).put(`/matches/${matchId}/responses`, { responses: [], submit: true }).then((r) => expect(r.status).toBe(409)); // already submitted
  });

  // ───────────────────────── The result ─────────────────────────

  it("moves a compatible pairing to the next stage, tells both, and then shows how they compare", async () => {
    const { m, w, matchId } = await bothSubmitted();
    await respond(w, matchId).then((r) => expect(r.status).toBe(200));
    expect(db.compat.rows).toHaveLength(0); // not until both have responded
    await respond(m, matchId).then((r) => expect(r.status).toBe(200));

    expect(db.matches.rows[0].stage).toBe("NEXT_STAGE");
    expect(db.compat.rows[0]).toMatchObject({ passed: true, decidedBy: "system" });
    expect(notes("MATCH_NEXT_STAGE")).toHaveLength(2);
    const log = db.audit.rows.find((a: { action: string }) => a.action === "COMPATIBILITY_EVALUATED");
    expect(log.metadata.outcome).toBe("PASSED");
    expect(JSON.stringify(log)).not.toMatch(/expectation number/); // the audit trail holds counts, never the words

    const v = await as(m).get(`/matches/${matchId}`).expect(200);
    expect(v.body.result.counts).toEqual({ aligned: 10, needsDiscussion: 0, conflict: 0, preferenceDisagreements: 0 });
    expect(v.body.result.items).toHaveLength(10);
    const yours = v.body.result.items.filter((i: { direction: string }) => i.direction === "YOURS");
    expect(yours[0]).toMatchObject({ statement: expect.stringMatching(/^His expectation/), classification: "ALIGNED", response: { type: "AGREE", explanation: EXPLAIN } });
    expect(v.body.result.items.filter((i: { direction: string }) => i.direction === "THEIRS")[0].statement).toMatch(/^Her expectation/);
  });

  it("a conflict on something non-negotiable goes to a person, with neutral words for both", async () => {
    const hisItems = [{ category: "family", statement: "I want to live separately from both families", level: "NON_NEGOTIABLE" }, ...list(4, "His")];
    const { m, w, matchId } = await bothSubmitted({ m: hisItems });
    await respond(m, matchId).then((r) => expect(r.status).toBe(200));
    // She disagrees with his non-negotiable
    const r = await respond(w, matchId, (i) => (i === 0 ? "DISAGREE" : "AGREE"));
    expect(r.status).toBe(200);

    expect(db.matches.rows[0]).toMatchObject({ stage: "COMPATIBILITY_REVIEW", status: "ACTIVE" });
    expect(db.compat.rows[0]).toMatchObject({ passed: null, reasons: ["CONFLICT"] });
    const told = notes("MATCH_UNDER_REVIEW");
    expect(told).toHaveLength(2);
    expect(JSON.stringify(told)).not.toMatch(/fail|conflict|disagree|reject/i);

    for (const c of [m, w]) {
      const v = await as(c).get(`/matches/${matchId}`).expect(200);
      expect(v.body.result).toBeNull();
      expect(JSON.stringify(v.body.result)).not.toMatch(/CONFLICT/);
    }
  });

  it("a reviewer sees both sides without names, and closing the pairing is permanent, neutral and rests nobody", async () => {
    const hisItems = [{ category: "family", statement: "I want to live separately from both families", level: "NON_NEGOTIABLE" }, ...list(4, "His")];
    const { m, w, admin, matchId } = await bothSubmitted({ m: hisItems });
    await respond(m, matchId);
    await respond(w, matchId, (i) => (i === 0 ? "DISAGREE" : "AGREE"));

    await as(m).get("/admin/compatibility").then((r) => expect(r.status).toBe(403));
    const queue = await as(admin).get("/admin/compatibility").expect(200);
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0].reasons).toEqual(["CONFLICT"]);

    const d = await as(admin).get(`/admin/compatibility/${matchId}`).expect(200);
    expect(d.body.items.some((i: { author: string }) => i.author === "Person A")).toBe(true);
    expect(d.body.items.some((i: { author: string }) => i.author === "Person B")).toBe(true);
    expect(d.body.items.find((i: { classification: string }) => i.classification === "CONFLICT").response.type).toBe("DISAGREE");
    expect(JSON.stringify(d.body)).not.toMatch(/@example\.com|m Person|w Person/);

    await as(admin).post(`/admin/compatibility/${matchId}/decision`, { decision: "CLOSE", notes: "Genuinely incompatible on living arrangements" }).then((r) => expect(r.status).toBe(200));

    expect(db.matches.rows[0]).toMatchObject({ status: "CLOSED", closureNote: "This pairing did not meet the requirements for the next stage." });
    expect(db.compat.rows[0]).toMatchObject({ passed: false, decidedBy: userId("admin@example.com") });
    expect(db.exclusions.rows).toHaveLength(1);
    const told = notes("MATCH_CLOSED");
    expect(told).toHaveLength(2);
    for (const n of told) {
      expect(n.body).toContain("did not meet the requirements for the next stage");
      expect(n.body).not.toMatch(/fail|you were/i);
    }
    // Neither person rests: this was not a withdrawal
    expect(db.prefSets.rows.every((s: { availableAfter: unknown }) => s.availableAfter === null)).toBe(true);
    expect(db.audit.rows.find((a: { action: string }) => a.action === "COMPATIBILITY_REVIEW_DECIDED").reason).toBe("Genuinely incompatible on living arrangements");

    // A closed pairing shows nothing about what was written
    const v = await as(m).get(`/matches/${matchId}`).expect(200);
    expect(v.body.status).toBe("CLOSED");
    expect(JSON.stringify(v.body)).not.toMatch(/His expectation|separately|myExpectations|theirExpectations/);

    await as(admin).post(`/admin/compatibility/${matchId}/decision`, { decision: "PASS" }).then((r) => expect(r.status).toBe(409));
  });

  it("a reviewer can let a pairing through", async () => {
    const hisItems = [{ category: "family", statement: "I want to live separately from both families", level: "NON_NEGOTIABLE" }, ...list(4, "His")];
    const { m, w, admin, matchId } = await bothSubmitted({ m: hisItems });
    await respond(m, matchId);
    await respond(w, matchId, (i) => (i === 0 ? "DISAGREE" : "AGREE"));
    await as(admin).post(`/admin/compatibility/${matchId}/decision`, { decision: "PASS" }).then((r) => expect(r.status).toBe(200));
    expect(db.matches.rows[0].stage).toBe("NEXT_STAGE");
    expect(db.compat.rows[0].passed).toBe(true);
    expect(notes("MATCH_NEXT_STAGE")).toHaveLength(2);
    const v = await as(w).get(`/matches/${matchId}`).expect(200);
    expect(v.body.result.counts.conflict).toBe(1); // honest about what was found
  });

  it("nobody can review their own pairing, and decisions are validated", async () => {
    const hisItems = [{ category: "family", statement: "I want to live separately from both families", level: "NON_NEGOTIABLE" }, ...list(4, "His")];
    const { m, w, admin, matchId } = await bothSubmitted({ m: hisItems });
    await respond(m, matchId);
    await respond(w, matchId, (i) => (i === 0 ? "DISAGREE" : "AGREE"));
    db.users.rows.find((u: { email: string }) => u.email === "m@example.com").role = "MODERATOR";
    const own = await as(m).post(`/admin/compatibility/${matchId}/decision`, { decision: "PASS" });
    expect(own.status).toBe(403);
    expect(own.body.code).toBe("OWN_REVIEW");
    await as(admin).post(`/admin/compatibility/${matchId}/decision`, { decision: "MAYBE" }).then((r) => expect(r.status).toBe(400));
  });

  it("closes automatically with the PRD wording when review is switched off", async () => {
    await setSettings({ "compat.requireReviewOnFail": 0 });
    const hisItems = [{ category: "family", statement: "I want to live separately from both families", level: "NON_NEGOTIABLE" }, ...list(4, "His")];
    const { m, w, matchId } = await bothSubmitted({ m: hisItems });
    await respond(m, matchId);
    await respond(w, matchId, (i) => (i === 0 ? "DISAGREE" : "AGREE"));
    expect(db.matches.rows[0]).toMatchObject({ status: "CLOSED", closureNote: "This pairing did not meet the requirements for the next stage." });
    expect(db.exclusions.rows).toHaveLength(1);
    expect(db.compat.rows[0]).toMatchObject({ passed: false, decidedBy: "system" });
  });

  it("uses the configured thresholds, not fixed numbers", async () => {
    await setSettings({ "compat.maxNeedsDiscussion": 1 });
    const { m, w, matchId } = await bothSubmitted();
    await respond(m, matchId);
    await respond(w, matchId, (i) => (i < 2 ? "WILLING_TO_DISCUSS" : "AGREE"));
    expect(db.compat.rows[0]).toMatchObject({ passed: null, reasons: ["TOO_MANY_DISCUSSION_POINTS"] });
    expect(db.matches.rows[0].stage).toBe("COMPATIBILITY_REVIEW");
  });

  it("a few things to discuss still pass", async () => {
    const { m, w, matchId } = await bothSubmitted();
    await respond(m, matchId, (i) => (i === 0 ? "PARTIALLY_AGREE" : "AGREE"));
    await respond(w, matchId, (i) => (i === 1 ? "WILLING_TO_DISCUSS" : "AGREE"));
    expect(db.matches.rows[0].stage).toBe("NEXT_STAGE");
    const v = await as(m).get(`/matches/${matchId}`).expect(200);
    expect(v.body.result.counts).toMatchObject({ aligned: 8, needsDiscussion: 2, conflict: 0 });
  });

  it("closing a pairing during this stage still works, and the details vanish", async () => {
    const { m, w, matchId } = await bothSubmitted();
    await as(m).post(`/matches/${matchId}/withdraw`).expect(200);
    const v = await as(w).get(`/matches/${matchId}`).expect(200);
    expect(v.body.status).toBe("CLOSED");
    expect(JSON.stringify(v.body)).not.toMatch(/Her expectation|His expectation/);
    await submitExpectations(w, matchId, list(5, "Late")).then((r) => expect(r.status).toBe(409));
  });
});
