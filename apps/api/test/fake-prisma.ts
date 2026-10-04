/**
 * Minimal in-memory stand-in for PrismaService, covering only what the auth flow uses.
 * It lets the auth logic be tested without a database. Database-level behaviour
 * (unique indexes, transactions) is still verified separately against real Postgres.
 */
let counter = 0;
const id = () => `id_${++counter}`;

type Row = Record<string, any>;

const matches = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([k, v]) => (v === null ? row[k] == null : row[k] === v));

function table(name: string, uniques: string[] = [], defaults: () => Row = () => ({})) {
  const rows: Row[] = [];
  return {
    rows,
    async create({ data }: { data: Row }) {
      for (const u of uniques) {
        if (rows.some((r) => r[u] === data[u])) throw Object.assign(new Error(`Unique ${name}.${u}`), { code: "P2002" });
      }
      const row = { id: id(), createdAt: new Date(), ...defaults(), ...data };
      rows.push(row);
      return row;
    },
    async findUnique({ where }: { where: Row }) {
      return rows.find((r) => matches(r, where)) ?? null;
    },
    async findFirst({ where }: { where?: Row } = {}) {
      return rows.find((r) => matches(r, where ?? {})) ?? null;
    },
    async update({ where, data }: { where: Row; data: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error(`${name} not found`);
      Object.assign(row, data);
      return row;
    },
    async updateMany({ where, data }: { where: Row; data: Row }) {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
  };
}

export function createFakePrisma() {
  const users = table("user", ["email"], () => ({
    role: "USER",
    status: "PENDING_VERIFICATION",
    emailVerifiedAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
  }));
  const profiles: Row[] = [];
  const sessions = table("authSession", ["tokenHash"], () => ({ lastSeenAt: new Date(), revokedAt: null }));
  const tokens = table("authToken", ["tokenHash"], () => ({ usedAt: null }));
  const audit = table("auditLog");
  const enrollments = table("enrollment");

  const withProfile = (u: Row | null, include?: Row) =>
    u && include?.profile ? { ...u, profile: profiles.find((p) => p.userId === u.id) ?? null } : u;

  const fake: Row = {
    users,
    sessions,
    tokens,
    audit,
    user: {
      async create({ data }: { data: Row }) {
        const { profile, ...rest } = data;
        const u = await users.create({ data: rest });
        if (profile?.create) profiles.push({ id: id(), userId: u.id, ...profile.create });
        return u;
      },
      async findUnique({ where, include }: { where: Row; include?: Row }) {
        return withProfile(await users.findUnique({ where }), include);
      },
      update: users.update,
    },
    authSession: {
      create: sessions.create,
      update: sessions.update,
      updateMany: sessions.updateMany,
      async findUnique({ where, include }: { where: Row; include?: Row }) {
        const s = await sessions.findUnique({ where });
        return s && include?.user ? { ...s, user: users.rows.find((u) => u.id === s.userId) } : s;
      },
    },
    authToken: {
      create: tokens.create,
      findUnique: tokens.findUnique,
      update: tokens.update,
      updateMany: tokens.updateMany,
    },
    auditLog: { create: audit.create },
    enrollment: { findFirst: enrollments.findFirst },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    $queryRaw: async () => [{ "?column?": 1 }],
    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };
  return fake;
}
