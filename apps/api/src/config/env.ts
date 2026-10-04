/**
 * Runtime configuration, read lazily so values from .env (loaded by ConfigModule) are visible.
 * Nothing security-relevant is hard-coded (PRD section 15 principle).
 */
const list = (v?: string) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  /** Browser origins allowed to call this API (user web app, admin app). */
  get webOrigins(): string[] {
    const o = list(process.env.WEB_ORIGIN);
    return o.length ? o : ["http://localhost:3000"];
  },
  /** Base URL used in links inside emails. */
  get appWebUrl(): string {
    return (process.env.APP_WEB_URL ?? this.webOrigins[0]).replace(/\/$/, "");
  },
  get cookieName(): string {
    return process.env.COOKIE_NAME ?? "bw_session";
  },
  get cookieSecure(): boolean {
    return (process.env.COOKIE_SECURE ?? String(process.env.NODE_ENV === "production")) === "true";
  },
  get cookieSameSite(): "lax" | "strict" | "none" {
    const v = (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase();
    return v === "none" || v === "strict" ? v : "lax";
  },
  get cookieDomain(): string | undefined {
    return process.env.COOKIE_DOMAIN || undefined;
  },
  sessionTtlDays: 14,
  sessionIdleDays: 7,
  maxFailedLogins: 5,
  lockMinutes: 15,
  verifyTokenHours: 24,
  resetTokenHours: 1,
};
