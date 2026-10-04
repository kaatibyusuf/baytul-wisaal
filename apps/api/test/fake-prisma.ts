/**
 * In-memory stand-in for PrismaService, covering what the app uses. It lets business logic be
 * tested without a database. Database-level behaviour (real unique indexes, transactions) is
 * verified separately against real Postgres.
 */
let counter = 0;
const newId = () => `id_${++counter}`;

type Row = Record<string, any>;
type Where = Record<string, any>;

const isPlainObject = (v: unknown): v is Row => !!v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    // Composite unique keys like { userId_programmeId: { userId, programmeId } }
    if (k.includes("_") && isPlainObject(v) && !(k in row)) return matches(row, v);
    if (isPlainObject(v)) {
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
    async findMany({ where, orderBy }: { where?: Where; orderBy?: Row } = {}) {
      return sortRows(rows.filter((r) => matches(r, where)), orderBy).map(copy);
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
  const activities = table("activity", { defaults: () => ({ required: true, position: 0 }) });
  const enrollments = table("enrollment", {
    uniques: [["userId", "programmeId"]],
    defaults: () => ({ status: "IN_PROGRESS", startedAt: new Date(), completedAt: null, dueAt: null }),
  });
  const progress = table("activityProgress", {
    uniques: [["enrollmentId", "activityId"]],
    defaults: () => ({ status: "NOT_STARTED", attempts: 0, startedAt: null, completedAt: null }),
  });
  const submissions = table("activitySubmission", { uniques: [["progressId", "attempt"]] });
  const notifications = table("notification");

  const withProfile = (u: Row | null, include?: Row) =>
    u && include?.profile ? { ...u, profile: profiles.rows.find((p) => p.userId === u.id) ?? null } : u;

  const fake: Row = {
    // Direct access for assertions in tests
    users, profiles, sessions, tokens, audit, settings, programme, days, activities, enrollments, progress, submissions, notifications,

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
      update: users.update,
    },
    profile: { findUnique: profiles.findUnique, update: profiles.update },
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
    auditLog: { create: audit.create },
    systemSetting: { findUnique: settings.findUnique },
    programmeDay: { findMany: days.findMany, findUnique: days.findUnique },
    activity: { findMany: activities.findMany, findUnique: activities.findUnique },
    enrollment: { create: enrollments.create, findUnique: enrollments.findUnique, findFirst: enrollments.findFirst, update: enrollments.update },
    activityProgress: { findMany: progress.findMany, update: progress.update, upsert: progress.upsert },
    activitySubmission: { create: submissions.create, findFirst: submissions.findFirst },
    notification: { create: notifications.create },

    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    $queryRaw: async () => [{ "?column?": 1 }],
    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };
  return fake;
}
