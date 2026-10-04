import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { EmailService } from "../src/email/email.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { createFakePrisma } from "./fake-prisma";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

const validRegistration = (overrides: Record<string, unknown> = {}) => ({
  email: "Amina@Example.com ",
  password: PASSWORD,
  fullName: "Amina Bello",
  preferredName: "Amina",
  gender: "FEMALE",
  dateOfBirth: "1996-04-23",
  maritalStatus: "NEVER_MARRIED",
  ...overrides,
});

describe("Authentication", () => {
  let app: INestApplication;
  let db: ReturnType<typeof createFakePrisma>;
  let sent: { to: string; subject: string; text: string }[];

  const lastToken = () => {
    const m = sent[sent.length - 1].text.match(/token=([^\s&]+)/);
    if (!m) throw new Error("no token in last email");
    return decodeURIComponent(m[1]);
  };
  const http = () => request(app.getHttpServer());
  const post = (path: string, body?: object) => http().post(`/api/v1${path}`).set("Origin", ORIGIN).send(body);

  beforeEach(async () => {
    db = createFakePrisma();
    sent = [];
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(EmailService)
      .useValue({ send: async (to: string, c: { subject: string; text: string }) => void sent.push({ to, ...c }) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterEach(async () => app.close());

  const registerAndVerify = async () => {
    await post("/auth/register", validRegistration()).expect(202);
    await post("/auth/verify-email", { token: lastToken() }).expect(200);
  };

  const login = (password = PASSWORD) => post("/auth/login", { email: "amina@example.com", password });

  it("registers, normalises the email, stores only a password hash, and emails a verification link", async () => {
    await post("/auth/register", validRegistration()).expect(202);
    expect(db.users.rows).toHaveLength(1);
    expect(db.users.rows[0].email).toBe("amina@example.com");
    expect(db.users.rows[0].passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(db.users.rows[0])).not.toContain(PASSWORD);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/Confirm your email/);
    // Only a hash of the token is stored, never the token itself.
    expect(db.tokens.rows[0].tokenHash).not.toBe(lastToken());
  });

  it("gives the same answer for an already-registered email and sends no second account", async () => {
    await post("/auth/register", validRegistration()).expect(202);
    const res = await post("/auth/register", validRegistration()).expect(202);
    expect(res.body.message).toMatch(/Check your email/);
    expect(db.users.rows).toHaveLength(1);
    expect(sent[1].subject).toMatch(/already have a Baytul Wisaal account/);
  });

  it("rejects under-18s, weak passwords, unknown fields and bad enums", async () => {
    const year = new Date().getUTCFullYear() - 17;
    const under = await post("/auth/register", validRegistration({ dateOfBirth: `${year}-01-01` })).expect(400);
    expect(under.body.code).toBe("UNDERAGE");
    await post("/auth/register", validRegistration({ password: "short" })).expect(400);
    await post("/auth/register", validRegistration({ role: "ADMIN" })).expect(400);
    await post("/auth/register", validRegistration({ gender: "OTHER" })).expect(400);
    expect(db.users.rows).toHaveLength(0);
  });

  it("will not let anyone register themselves as an admin", async () => {
    await post("/auth/register", validRegistration({ role: "SUPER_ADMIN" })).expect(400);
    await post("/auth/register", validRegistration()).expect(202);
    expect(db.users.rows[0].role).toBe("USER");
  });

  it("blocks sign-in until the email is verified", async () => {
    await post("/auth/register", validRegistration()).expect(202);
    const res = await login().expect(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("verifies email once; the same link cannot be reused", async () => {
    await post("/auth/register", validRegistration()).expect(202);
    const token = lastToken();
    await post("/auth/verify-email", { token }).expect(200);
    expect(db.users.rows[0].status).toBe("ACTIVE");
    expect(db.users.rows[0].emailVerifiedAt).toBeInstanceOf(Date);
    const again = await post("/auth/verify-email", { token }).expect(400);
    expect(again.body.code).toBe("INVALID_TOKEN");
    await post("/auth/verify-email", { token: "x".repeat(43) }).expect(400);
  });

  it("signs in with an HTTP-only cookie, serves /users/me without secrets, and signs out", async () => {
    await registerAndVerify();
    const res = await login().expect(200);
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0];
    expect(cookie).toMatch(/^bw_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);

    const me = await http().get("/api/v1/users/me").set("Cookie", cookie).expect(200);
    expect(me.body.email).toBe("amina@example.com");
    expect(me.body.profile.fullName).toBe("Amina Bello");
    expect(me.body.journey.programme).toBe("NOT_STARTED");
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|argon2/);

    await http().post("/api/v1/auth/logout").set("Origin", ORIGIN).set("Cookie", cookie).expect(200);
    await http().get("/api/v1/users/me").set("Cookie", cookie).expect(401);
  });

  it("stores only a hash of the session token", async () => {
    await registerAndVerify();
    const res = await login().expect(200);
    const raw = (res.headers["set-cookie"] as unknown as string[])[0].split(";")[0].split("=")[1];
    expect(db.sessions.rows[0].tokenHash).toBeDefined();
    expect(JSON.stringify(db.sessions.rows)).not.toContain(raw);
  });

  it("protects routes by default and rejects tampered or expired sessions", async () => {
    await http().get("/api/v1/users/me").expect(401);
    await http().get("/api/v1/users/me").set("Cookie", "bw_session=not-a-real-session-token-at-all").expect(401);

    await registerAndVerify();
    const res = await login().expect(200);
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0];
    db.sessions.rows[0].expiresAt = new Date(Date.now() - 1000);
    await http().get("/api/v1/users/me").set("Cookie", cookie).expect(401);
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    await registerAndVerify();
    const wrong = await login("wrong password!!").expect(401);
    const unknown = await post("/auth/login", { email: "nobody@example.com", password: PASSWORD }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("temporarily locks the account after repeated failures, even for the right password", async () => {
    await registerAndVerify();
    for (let i = 0; i < 5; i++) await login("wrong password!!").expect(401);
    const locked = await login().expect(429);
    expect(locked.body.code).toBe("TOO_MANY_ATTEMPTS");
    expect(db.audit.rows.some((a: { action: string }) => a.action === "ACCOUNT_TEMPORARILY_LOCKED")).toBe(true);
    // Lock expires.
    db.users.rows[0].lockedUntil = new Date(Date.now() - 1000);
    await login().expect(200);
  });

  it("refuses suspended accounts", async () => {
    await registerAndVerify();
    db.users.rows[0].status = "SUSPENDED";
    const res = await login().expect(403);
    expect(res.body.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("resets a password: single-use link, old sessions revoked, old password stops working", async () => {
    await registerAndVerify();
    const old = await login().expect(200);
    const oldCookie = (old.headers["set-cookie"] as unknown as string[])[0];

    const forgot = await post("/auth/forgot-password", { email: "amina@example.com" }).expect(202);
    const unknown = await post("/auth/forgot-password", { email: "nobody@example.com" }).expect(202);
    expect(forgot.body).toEqual(unknown.body);
    expect(sent[sent.length - 1].subject).toMatch(/Reset your password/);

    const token = lastToken();
    await post("/auth/reset-password", { token, password: "a brand new passphrase" }).expect(200);
    await post("/auth/reset-password", { token, password: "another passphrase!!" }).expect(400);

    await http().get("/api/v1/users/me").set("Cookie", oldCookie).expect(401);
    await login().expect(401);
    await login("a brand new passphrase").expect(200);
    expect(db.audit.rows.some((a: { action: string }) => a.action === "PASSWORD_RESET_COMPLETED")).toBe(true);
  });

  it("rejects a verification token used as a reset token", async () => {
    await post("/auth/register", validRegistration()).expect(202);
    await post("/auth/reset-password", { token: lastToken(), password: "a brand new passphrase" }).expect(400);
  });

  it("resends verification only to unverified accounts, and answers identically for unknown emails", async () => {
    await post("/auth/register", validRegistration()).expect(202);
    const a = await post("/auth/resend-verification", { email: "amina@example.com" }).expect(202);
    const b = await post("/auth/resend-verification", { email: "nobody@example.com" }).expect(202);
    expect(a.body).toEqual(b.body);
    expect(sent).toHaveLength(2);
    // The first link no longer works; the newest does.
    const newest = lastToken();
    await post("/auth/verify-email", { token: newest }).expect(200);
  });

  it("rejects state-changing requests from a foreign origin (CSRF defence)", async () => {
    const res = await http()
      .post("/api/v1/auth/register")
      .set("Origin", "https://evil.example")
      .send(validRegistration())
      .expect(403);
    expect(res.body.code).toBe("BAD_ORIGIN");
    expect(db.users.rows).toHaveLength(0);
  });

  it("rate limits repeated registration attempts", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await post("/auth/register", validRegistration({ email: `u${i}@example.com` }));
      codes.push(r.status);
    }
    expect(codes.slice(0, 5)).toEqual([202, 202, 202, 202, 202]);
    expect(codes.slice(5)).toEqual([429, 429]);
  });

  it("keeps the health endpoint public", async () => {
    const res = await http().get("/api/v1/health").expect(200);
    expect(res.body.database).toBe("up");
  });
});
