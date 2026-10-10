/**
 * In-memory stand-in for PrismaService, covering what the app uses. It lets business logic be
 * tested without a database. Database-level behaviour (real unique indexes, transactions) is
 * verified separately against real Postgres.
 */
let counter = 0;
/** Real ids are 25-character cuids, so the fake makes ids of the same length. */
const newId = () => `c${String(++counter).padStart(24, "0")}`;

type Row = Record<string, any>;
type Where = Record<string, any>;

const isPlainObject = (v: unknown): v is Row => !!v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Where[]).some((w) => matches(row, w));
    // Composite unique keys like { userId_programmeId: { userId, programmeId } }
    if (k.includes("_") && isPlainObject(v) && !(k in row)) return matches(row, v);
    if (isPlainObject(v)) {
      if ("contains" in v) return String(row[k] ?? "").toLowerCase().includes(String(v.contains).toLowerCase());
      if ("in" in v) return (v.in as unknown[]).includes(row[k]);
      if ("not" in v) return row[k] !== v.not;
      if ("lt" in v) return row[k] < v.lt;
      if ("lte" in v) return row[k] <= v.lte;
      if ("gt" in v) return row[k] > v.gt;
      if ("gte" in v) return row[k] >= v.gte;
    }
    if (v === null) return row[k] == null;
    return row[k] === v;
  });
}

function flattenComposite(where: Where): Where {
  const out: Where = {};
  for (const [k, v] of Object.entries(where)) {
    if (k.includes("_") && isPlainObject(v)) Object.assign(out, v);
    else out[k] = v;
  }
  return out;
}

function sortRows(rows: Row[], orderBy?: Row | Row[]) {
  if (!orderBy) return rows;
  const [[field, dir]] = Object.entries(Array.isArray(orderBy) ? orderBy[0] : orderBy);
  return [...rows].sort((a, b) => {
    const x = a[field] instanceof Date ? a[field].getTime() : a[field];
    const y = b[field] instanceof Date ? b[field].getTime() : b[field];
    return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
  });
}

/** Real Prisma returns fresh objects. Returning copies stops the fake from aliasing stored rows. */
const copy = <T extends Row | null | undefined>(r: T): T => (r ? ({ ...r } as T) : r);

function table(name: string, opts: { uniques?: string[][]; defaults?: () => Row } = {}) {
  const rows: Row[] = [];
  const uniques = opts.uniques ?? [];
  const checkUnique = (data: Row) => {
    for (const cols of uniques) {
      if (rows.some((r) => cols.every((c) => r[c] === data[c]))) {
        throw Object.assign(new Error(`Unique constraint on ${name}(${cols.join(",")})`), { code: "P2002" });
      }
    }
  };
  const api = {
    rows,
    async create({ data }: { data: Row }) {
      const row = { id: newId(), createdAt: new Date(), ...(opts.defaults?.() ?? {}), ...data };
      checkUnique(row);
      rows.push(row);
      return copy(row);
    },
    async findUnique({ where }: { where: Where }) {
      return copy(rows.find((r) => matches(r, where))) ?? null;
    },
    async findFirst({ where, orderBy }: { where?: Where; orderBy?: Row } = {}) {
      return copy(sortRows(rows.filter((r) => matches(r, where)), orderBy)[0]) ?? null;
    },
    async findMany({ where, orderBy, skip, take }: { where?: Where; orderBy?: Row; skip?: number; take?: number } = {}) {
      const all = sortRows(rows.filter((r) => matches(r, where)), orderBy);
      return all.slice(skip ?? 0, take === undefined ? undefined : (skip ?? 0) + take).map(copy);
    },
    async count({ where }: { where?: Where } = {}) {
      return rows.filter((r) => matches(r, where)).length;
    },
    async update({ where, data }: { where: Where; data: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error(`${name}: record to update not found`);
      Object.assign(row, data);
      return copy(row);
    },
    async updateMany({ where, data }: { where: Where; data: Row }) {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    async deleteMany({ where }: { where?: Where } = {}) {
      const keep = rows.filter((r) => !matches(r, where));
      const count = rows.length - keep.length;
      rows.length = 0;
      rows.push(...keep);
      return { count };
    },
    async createMany({ data }: { data: Row[] }) {
      for (const d of data) await api.create({ data: d });
      return { count: data.length };
    },
    async upsert({ where, create, update }: { where: Where; create: Row; update: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (row) return copy(Object.assign(row, update));
      return api.create({ data: { ...flattenComposite(where), ...create } });
    },
  };
  return api;
}

export function createFakePrisma() {
  const users = table("user", {
    uniques: [["email"]],
    defaults: () => ({ role: "USER", status: "PENDING_VERIFICATION", emailVerifiedAt: null, failedLoginCount: 0, lockedUntil: null }),
  });
  const profiles = table("profile", { uniques: [["userId"]] });
  const sessions = table("authSession", { uniques: [["tokenHash"]], defaults: () => ({ lastSeenAt: new Date(), revokedAt: null }) });
  const tokens = table("authToken", { uniques: [["tokenHash"]], defaults: () => ({ usedAt: null }) });
  const audit = table("auditLog");
  const settings = table("systemSetting");
  const programme = table("programme", { defaults: () => ({ isActive: true, totalDays: 30 }) });
  const days = table("programmeDay", { uniques: [["programmeId", "dayNumber"]] });
  const activities = table("activity", { defaults: () => ({ required: true, position: 0, scenarioId: null }) });
  const enrollments = table("enrollment", {
    uniques: [["userId", "programmeId"]],
    defaults: () => ({ status: "IN_PROGRESS", startedAt: new Date(), completedAt: null, dueAt: null }),
  });
  const progress = table("activityProgress", {
    uniques: [["enrollmentId", "activityId"]],
    defaults: () => ({ status: "NOT_STARTED", attempts: 0, startedAt: null, completedAt: null }),
  });
  const submissions = table("activitySubmission", { uniques: [["progressId", "attempt"]] });
  const notifications = table("notification", { defaults: () => ({ readAt: null }) });
  const scenarios = table("scenario", { uniques: [["key"]], defaults: () => ({ competency: null }) });
  const scenarioVersions = table("scenarioVersion", { defaults: () => ({ isActive: true }) });
  const rubrics = table("rubric", { defaults: () => ({ criticalCriteria: null, passThreshold: null }) });
  const sessionsA = table("assessmentSession", {
    uniques: [["watermarkCode"]],
    defaults: () => ({
      status: "ACTIVE", evalState: "NONE", evalAttempts: 0, evalError: null, evaluatedAt: null,
      integrityScore: null, startedAt: new Date(), submittedAt: null, lastSeenAt: null,
    }),
  });
  const answers = table("assessmentAnswer", { uniques: [["sessionId", "sequence"]] });
  const evaluations = table("aIEvaluation");
  const reviews = table("humanReview", { defaults: () => ({ status: "PENDING", triggers: [], notes: null, reviewerId: null, decidedAt: null }) });
  const events = table("integrityEvent", { defaults: () => ({ at: new Date(), metadata: null }) });
  const prefSets = table("preferenceSet", {
    uniques: [["userId"]],
    defaults: () => ({ selfAnswers: null, hardFilters: null, questionnaireVersion: null, submittedAt: null, availability: "AVAILABLE", availableAfter: null }),
  });
  const prefItems = table("preferenceItem", { uniques: [["setId", "key"]], defaults: () => ({ note: null }) });
  const matches = table("match", { defaults: () => ({ status: "ACTIVE", stage: "EXPECTATIONS_PENDING", closedAt: null, closureNote: null }) });
  const exclusions = table("matchExclusion", { uniques: [["userLowId", "userHighId"]] });
  const expectations = table("matchExpectation", { uniques: [["matchId", "authorId"]], defaults: () => ({ submittedAt: null, responsesSubmittedAt: null }) });
  const expItems = table("matchExpectationItem", { defaults: () => ({ isDealBreaker: false, compromiseNote: null, position: 0 }) });
  const responses = table("matchResponse", { uniques: [["itemId"]], defaults: () => ({ explanation: null }) });
  const compat = table("compatibility", { uniques: [["matchId"]], defaults: () => ({ passed: null, reasons: [], summary: null, decidedBy: null, decidedAt: null }) });

  const withProfile = (u: Row | null, include?: Row) =>
    u && include?.profile ? { ...u, profile: profiles.rows.find((p) => p.userId === u.id) ?? null } : u;

  const fake: Row = {
    // Direct access for assertions in tests
    users, profiles, sessions, tokens, audit, settings, programme, days, activities, enrollments, progress, submissions, notifications,
    scenarios, scenarioVersions, rubrics, assessmentSessions: sessionsA, answers, evaluations, reviews, events,
    prefSets, prefItems, matches, exclusions, expectations, expItems, responses, compat,

    user: {
      async create({ data }: { data: Row }) {
        const { profile, ...rest } = data;
        const u = await users.create({ data: rest });
        if (profile?.create) await profiles.create({ data: { userId: u.id, ...profile.create } });
        return u;
      },
      async findUnique({ where, include }: { where: Where; include?: Row }) {
        return withProfile(await users.findUnique({ where }), include);
      },
      findMany: users.findMany,
      count: users.count,
      update: users.update,
    },
    profile: { findUnique: profiles.findUnique, findMany: profiles.findMany, update: profiles.update },
    authSession: {
      create: sessions.create,
      update: sessions.update,
      updateMany: sessions.updateMany,
      async findUnique({ where, include }: { where: Where; include?: Row }) {
        const s = await sessions.findUnique({ where });
        return s && include?.user ? { ...s, user: users.rows.find((u) => u.id === s.userId) } : s;
      },
    },
    authToken: { create: tokens.create, findUnique: tokens.findUnique, update: tokens.update, updateMany: tokens.updateMany },
    auditLog: { create: audit.create, findMany: audit.findMany, count: audit.count },
    systemSetting: { findUnique: settings.findUnique, upsert: settings.upsert },
    programmeDay: { findMany: days.findMany, findUnique: days.findUnique, findFirst: days.findFirst, create: days.create, update: days.update },
    activity: { findMany: activities.findMany, findUnique: activities.findUnique, findFirst: activities.findFirst, create: activities.create, update: activities.update, count: activities.count },
    enrollment: { create: enrollments.create, findUnique: enrollments.findUnique, findFirst: enrollments.findFirst, findMany: enrollments.findMany, update: enrollments.update },
    activityProgress: { findMany: progress.findMany, update: progress.update, upsert: progress.upsert, count: progress.count },
    activitySubmission: { create: submissions.create, findFirst: submissions.findFirst },
    notification: { create: notifications.create, findMany: notifications.findMany, updateMany: notifications.updateMany },
    scenarioVersion: { findFirst: scenarioVersions.findFirst, findUnique: scenarioVersions.findUnique, create: scenarioVersions.create },
    scenario: { findUnique: scenarios.findUnique, create: scenarios.create, update: scenarios.update },
    rubric: { findFirst: rubrics.findFirst, create: rubrics.create },
    assessmentSession: {
      create: sessionsA.create, findUnique: sessionsA.findUnique, findMany: sessionsA.findMany, update: sessionsA.update,
    },
    assessmentAnswer: { create: answers.create, findFirst: answers.findFirst, findUnique: answers.findUnique },
    aIEvaluation: { create: evaluations.create, findMany: evaluations.findMany },
    humanReview: { create: reviews.create, findMany: reviews.findMany, findUnique: reviews.findUnique, update: reviews.update },
    preferenceSet: { findUnique: prefSets.findUnique, findMany: prefSets.findMany, upsert: prefSets.upsert, update: prefSets.update },
    preferenceItem: { findMany: prefItems.findMany, deleteMany: prefItems.deleteMany, createMany: prefItems.createMany },
    match: { create: matches.create, findUnique: matches.findUnique, findFirst: matches.findFirst, findMany: matches.findMany, update: matches.update, updateMany: matches.updateMany },
    matchExpectation: { create: expectations.create, findFirst: expectations.findFirst, update: expectations.update },
    matchExpectationItem: { findMany: expItems.findMany, deleteMany: expItems.deleteMany, createMany: expItems.createMany },
    matchResponse: { findMany: responses.findMany, upsert: responses.upsert },
    compatibility: { create: compat.create, findUnique: compat.findUnique, findMany: compat.findMany, update: compat.update },
    matchExclusion: { create: exclusions.create, findMany: exclusions.findMany },
    integrityEvent: { create: events.create, findFirst: events.findFirst, findMany: events.findMany, count: events.count },

    $transaction: (arg: Promise<unknown>[] | ((tx: unknown) => unknown)) => (typeof arg === "function" ? arg(fake) : Promise.all(arg)),
    $queryRaw: async () => [{ "?column?": 1 }],
    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };
  return fake;
}
