/**
 * Curriculum import and export. The curriculum arrives as a document, so there is one safe way in:
 *   - the whole file is checked first, and every problem is reported together with where it is
 *   - nothing is written unless the whole file is valid, and it is written as one unit
 *   - content is never deleted: days and activities missing from a file are left alone
 *   - scenarios and rubrics are versioned, never overwritten (PRD section 30)
 *   - export writes the same format, so a curriculum can be exported, edited and imported again
 */
import { ActivityType, Prisma } from "@prisma/client";
import { z } from "zod";
import { RubricCriterion, ScenarioBody, renderScenario } from "../assessment/rules";

// ───────────────────────── The file format ─────────────────────────

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, "Use lowercase letters, numbers and hyphens.");
const snake = z.string().regex(/^[a-z][a-z0-9_]{1,50}$/, "Use lowercase letters, numbers and underscores.");
const title = z.string().trim().min(2).max(200);

const block = z.strictObject({ type: z.enum(["h", "p", "quote"]), text: z.string().trim().min(1).max(5000) });

const lesson = z.strictObject({
  type: z.literal("LESSON"),
  title,
  required: z.boolean().optional(),
  blocks: z.array(block).min(1).max(200).optional(),
  /** Plain text: blank lines separate paragraphs, "## " starts a heading, "> " starts a quote. */
  body: z.string().trim().min(1).max(60000).optional(),
});

const reflection = z.strictObject({
  type: z.literal("REFLECTION"),
  title,
  required: z.boolean().optional(),
  prompt: z.string().trim().min(5).max(1000),
  minWords: z.number().int().min(5).max(1000).optional(),
});

const quiz = z.strictObject({
  type: z.literal("QUIZ"),
  title,
  required: z.boolean().optional(),
  passMark: z.number().int().min(1).max(100).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  questions: z
    .array(
      z.strictObject({
        text: z.string().trim().min(3).max(1000),
        options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
        correctIndex: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(50),
});

const scenarioActivity = z.strictObject({ type: z.literal("SCENARIO"), title, required: z.boolean().optional(), scenarioKey: slug });

const activity = z.discriminatedUnion("type", [lesson, reflection, quiz, scenarioActivity]);

const variable = z.union([
  z.strictObject({ type: z.literal("int"), min: z.number().int(), max: z.number().int(), step: z.number().int().min(1).optional(), format: z.enum(["naira", "plain"]).optional() }),
  z.strictObject({ type: z.literal("choice"), options: z.array(z.string().min(1).max(100)).min(2).max(20) }),
]);

const scenario = z.strictObject({
  key: slug,
  competency: z.string().trim().max(200).optional(),
  title,
  template: z.string().trim().min(20).max(6000),
  variables: z.record(z.string().regex(/^\w+$/), variable).optional(),
  instructions: z.string().trim().max(1000).optional(),
  parts: z.array(z.strictObject({ key: snake, label: z.string().trim().min(2).max(300), minWords: z.number().int().min(1).max(300) })).min(1).max(15),
  rubric: z.strictObject({
    passThreshold: z.number().int().min(0).max(100).optional(),
    criteria: z.array(z.strictObject({ key: snake, label: z.string().trim().min(2).max(200), weight: z.number().int().min(1).max(100), description: z.string().trim().max(1000).optional() })).min(1).max(12),
    criticalCriteria: z.array(z.strictObject({ key: snake, label: z.string().trim().min(2).max(200), description: z.string().trim().min(5).max(1000) })).max(10).optional(),
  }),
});

const curriculumSchema = z.strictObject({
  programme: z.strictObject({ slug, title, totalDays: z.number().int().min(1).max(120) }),
  scenarios: z.array(scenario).max(50).optional(),
  days: z.array(z.strictObject({ day: z.number().int().min(1), title, activities: z.array(activity).min(1).max(12) })).min(1).max(120),
});

export type Curriculum = z.infer<typeof curriculumSchema>;
export type CurriculumActivity = z.infer<typeof activity>;
export type CurriculumScenario = z.infer<typeof scenario>;
export type Block = z.infer<typeof block>;

export interface Problem {
  path: string;
  message: string;
}

export class CurriculumError extends Error {
  constructor(public problems: Problem[]) {
    super("The curriculum has problems.");
  }
}

// ───────────────────────── Checking a file ─────────────────────────

export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  for (const chunk of body.split(/\n\s*\n/)) {
    const t = chunk.trim();
    if (!t) continue;
    if (t.startsWith("## ")) out.push({ type: "h", text: t.slice(3).trim() });
    else if (t.startsWith("> ")) out.push({ type: "quote", text: t.replace(/^>\s?/gm, "").trim() });
    else out.push({ type: "p", text: t.replace(/\s*\n\s*/g, " ") });
  }
  return out;
}

export function validateCurriculum(raw: unknown): { ok: true; value: Curriculum } | { ok: false; problems: Problem[] } {
  const parsed = curriculumSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.slice(0, 50).map((i) => ({ path: i.path.join(".") || "(file)", message: i.message })),
    };
  }
  const c = parsed.data;
  const problems: Problem[] = [];
  const add = (path: string, message: string) => problems.push({ path, message });

  const seenDays = new Set<number>();
  c.days.forEach((d, di) => {
    if (d.day > c.programme.totalDays) add(`days.${di}.day`, `Day ${d.day} is beyond the programme's ${c.programme.totalDays} days.`);
    if (seenDays.has(d.day)) add(`days.${di}.day`, `Day ${d.day} appears more than once.`);
    seenDays.add(d.day);
    d.activities.forEach((a, ai) => {
      const at = `days.${di}.activities.${ai}`;
      if (a.type === "LESSON" && !a.blocks && !a.body) add(at, "A lesson needs either 'blocks' or 'body'.");
      if (a.type === "LESSON" && a.blocks && a.body) add(at, "Give either 'blocks' or 'body', not both.");
      if (a.type === "LESSON" && a.body && parseBody(a.body).length === 0) add(`${at}.body`, "The lesson body is empty.");
      if (a.type === "QUIZ") {
        a.questions.forEach((q, qi) => {
          if (q.correctIndex >= q.options.length) add(`${at}.questions.${qi}.correctIndex`, `There are only ${q.options.length} options.`);
          if (new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) add(`${at}.questions.${qi}.options`, "Two options are the same.");
        });
      }
    });
  });

  const keys = new Set<string>();
  (c.scenarios ?? []).forEach((s, si) => {
    const at = `scenarios.${si}`;
    if (keys.has(s.key)) add(`${at}.key`, `Scenario "${s.key}" appears more than once.`);
    keys.add(s.key);

    const total = s.rubric.criteria.reduce((n, x) => n + x.weight, 0);
    if (total !== 100) add(`${at}.rubric.criteria`, `The weights add up to ${total}. They must add up to 100.`);
    if (new Set(s.rubric.criteria.map((x) => x.key)).size !== s.rubric.criteria.length) add(`${at}.rubric.criteria`, "Two criteria share a key.");
    if (new Set((s.rubric.criticalCriteria ?? []).map((x) => x.key)).size !== (s.rubric.criticalCriteria ?? []).length) add(`${at}.rubric.criticalCriteria`, "Two critical criteria share a key.");
    if (new Set(s.parts.map((p) => p.key)).size !== s.parts.length) add(`${at}.parts`, "Two parts share a key.");
    for (const [name, v] of Object.entries(s.variables ?? {})) {
      if (v.type === "int" && v.min > v.max) add(`${at}.variables.${name}`, "The minimum is more than the maximum.");
    }
    try {
      renderScenario(scenarioBody(s), "check");
    } catch (e) {
      add(`${at}.template`, (e as Error).message);
    }
  });

  c.days.forEach((d, di) =>
    d.activities.forEach((a, ai) => {
      if (a.type === "SCENARIO" && !keys.has(a.scenarioKey)) {
        // May exist already in the database. The importer checks that.
      }
      void di;
      void ai;
    }),
  );

  return problems.length ? { ok: false, problems } : { ok: true, value: c };
}

// ───────────────────────── What gets stored ─────────────────────────

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
export const sameJson = (a: unknown, b: unknown) => stable(a ?? null) === stable(b ?? null);

export function scenarioBody(s: CurriculumScenario): ScenarioBody {
  return {
    title: s.title,
    template: s.template,
    ...(s.variables ? { variables: s.variables as ScenarioBody["variables"] } : {}),
    parts: s.parts,
    instructions: s.instructions ?? "",
  };
}

const rubricData = (s: CurriculumScenario) => ({
  criteria: s.rubric.criteria.map((x) => ({ key: x.key, label: x.label, weight: x.weight, ...(x.description ? { description: x.description } : {}) })),
  criticalCriteria: s.rubric.criticalCriteria ?? [],
  passThreshold: s.rubric.passThreshold ?? null,
});

export function activityContent(a: CurriculumActivity): Prisma.InputJsonObject {
  switch (a.type) {
    case "LESSON":
      return { blocks: a.blocks ?? parseBody(a.body!) };
    case "REFLECTION":
      return { prompt: a.prompt, minWords: a.minWords ?? 50 };
    case "QUIZ":
      return { questions: a.questions, ...(a.passMark ? { passMark: a.passMark } : {}), ...(a.maxAttempts ? { maxAttempts: a.maxAttempts } : {}) };
    case "SCENARIO":
      return {};
  }
}

// ───────────────────────── Importing ─────────────────────────

export interface ImportSummary {
  dryRun: boolean;
  programme: "created" | "updated" | "unchanged";
  days: { created: number; updated: number; unchanged: number };
  activities: { created: number; updated: number; unchanged: number };
  scenarios: { created: number; newVersion: number; unchanged: number };
  warnings: string[];
}

/**
 * Applies a validated curriculum. In a dry run it does every read and decides what would change,
 * but writes nothing. A real run is wrapped in a single database transaction by the caller.
 */
export async function importCurriculum(db: Prisma.TransactionClient, c: Curriculum, dryRun: boolean): Promise<ImportSummary> {
  const sum: ImportSummary = {
    dryRun,
    programme: "unchanged",
    days: { created: 0, updated: 0, unchanged: 0 },
    activities: { created: 0, updated: 0, unchanged: 0 },
    scenarios: { created: 0, newVersion: 0, unchanged: 0 },
    warnings: [],
  };

  // Scenarios first, so activities can point at them
  const scenarioIds = new Map<string, string>();
  for (const s of c.scenarios ?? []) {
    const existing = await db.scenario.findUnique({ where: { key: s.key } });
    let id: string;
    if (!existing) {
      id = dryRun ? `dry:${s.key}` : (await db.scenario.create({ data: { key: s.key, competency: s.competency ?? null } })).id;
    } else {
      id = existing.id;
      if (!dryRun && (existing.competency ?? undefined) !== s.competency) await db.scenario.update({ where: { id }, data: { competency: s.competency ?? null } });
    }
    scenarioIds.set(s.key, id);

    const body = scenarioBody(s);
    const rubric = rubricData(s);
    const latestV = existing ? await db.scenarioVersion.findFirst({ where: { scenarioId: id }, orderBy: { version: "desc" } }) : null;
    const latestR = existing ? await db.rubric.findFirst({ where: { scenarioId: id }, orderBy: { version: "desc" } }) : null;
    const bodyChanged = !latestV || !sameJson(latestV.body, body);
    const rubricChanged = !latestR || !sameJson({ criteria: latestR.criteria, criticalCriteria: latestR.criticalCriteria ?? [], passThreshold: latestR.passThreshold ?? null }, rubric);

    if (!existing) sum.scenarios.created++;
    else if (bodyChanged || rubricChanged) {
      sum.scenarios.newVersion++;
      sum.warnings.push(
        `Scenario "${s.key}" changed: a new version was added. People already in a session keep the version they were shown, but answers still waiting for assessment will be assessed against the new rubric.`,
      );
    } else sum.scenarios.unchanged++;

    if (!dryRun) {
      if (bodyChanged) await db.scenarioVersion.create({ data: { scenarioId: id, version: (latestV?.version ?? 0) + 1, body: body as unknown as Prisma.InputJsonObject } });
      if (rubricChanged) {
        await db.rubric.create({
          data: { scenarioId: id, version: (latestR?.version ?? 0) + 1, criteria: rubric.criteria, criticalCriteria: rubric.criticalCriteria, passThreshold: rubric.passThreshold },
        });
      }
    }
  }

  // Every scenario an activity names must exist, in this file or already
  const missing: Problem[] = [];
  for (const [di, d] of c.days.entries()) {
    for (const [ai, a] of d.activities.entries()) {
      if (a.type !== "SCENARIO" || scenarioIds.has(a.scenarioKey)) continue;
      const found = await db.scenario.findUnique({ where: { key: a.scenarioKey } });
      if (found) scenarioIds.set(a.scenarioKey, found.id);
      else missing.push({ path: `days.${di}.activities.${ai}.scenarioKey`, message: `There is no scenario "${a.scenarioKey}". Add it under "scenarios" in this file.` });
    }
  }
  if (missing.length) throw new CurriculumError(missing);

  // The programme
  let programme = await db.programme.findUnique({ where: { slug: c.programme.slug } });
  if (!programme) {
    sum.programme = "created";
    if (dryRun) programme = { id: "dry", slug: c.programme.slug, title: c.programme.title, totalDays: c.programme.totalDays, isActive: true, createdAt: new Date() };
    else {
      const active = await db.programme.findFirst({ where: { isActive: true } });
      programme = await db.programme.create({ data: { slug: c.programme.slug, title: c.programme.title, totalDays: c.programme.totalDays, isActive: !active } });
      if (active) sum.warnings.push(`Another programme ("${active.slug}") is already active, so this one was created inactive.`);
    }
  } else if (programme.title !== c.programme.title || programme.totalDays !== c.programme.totalDays) {
    sum.programme = "updated";
    if (c.programme.totalDays < programme.totalDays) sum.warnings.push("The programme now has fewer days. Existing later days were not removed.");
    if (!dryRun) programme = await db.programme.update({ where: { id: programme.id }, data: { title: c.programme.title, totalDays: c.programme.totalDays } });
  }

  // Days and activities
  const touchedProgress = new Set<string>();
  for (const d of c.days) {
    const existingDay = programme.id === "dry" ? null : await db.programmeDay.findFirst({ where: { programmeId: programme.id, dayNumber: d.day } });
    let dayId: string;
    if (!existingDay) {
      sum.days.created++;
      dayId = dryRun ? `dry:${d.day}` : (await db.programmeDay.create({ data: { programmeId: programme.id, dayNumber: d.day, title: d.title } })).id;
    } else {
      dayId = existingDay.id;
      if (existingDay.title !== d.title) {
        sum.days.updated++;
        if (!dryRun) await db.programmeDay.update({ where: { id: dayId }, data: { title: d.title } });
      } else sum.days.unchanged++;
    }

    for (const [position, a] of d.activities.entries()) {
      const content = activityContent(a);
      const scenarioId = a.type === "SCENARIO" ? (scenarioIds.get(a.scenarioKey) ?? null) : null;
      const realScenarioId = scenarioId?.startsWith("dry:") ? null : scenarioId;
      const required = a.required ?? true;
      const existing = dayId.startsWith("dry:") ? null : await db.activity.findFirst({ where: { dayId, position } });

      if (!existing) {
        sum.activities.created++;
        if (!dryRun) await db.activity.create({ data: { dayId, position, type: a.type as ActivityType, title: a.title, required, content, scenarioId: realScenarioId } });
        continue;
      }
      const unchanged =
        existing.type === a.type && existing.title === a.title && existing.required === required &&
        (existing.scenarioId ?? null) === realScenarioId && (dryRun && scenarioId?.startsWith("dry:") ? false : true) &&
        sameJson(existing.content, content);
      if (unchanged) {
        sum.activities.unchanged++;
        continue;
      }
      const withProgress = await db.activityProgress.count({ where: { activityId: existing.id } });
      if (existing.type !== a.type && withProgress > 0) {
        throw new CurriculumError([{ path: `days.${c.days.indexOf(d)}.activities.${position}.type`, message: `Day ${d.day}, activity ${position + 1} already has learner progress, so its type cannot change from ${existing.type} to ${a.type}.` }]);
      }
      sum.activities.updated++;
      if (withProgress > 0) touchedProgress.add(existing.id);
      if (!dryRun) await db.activity.update({ where: { id: existing.id }, data: { type: a.type as ActivityType, title: a.title, required, content, scenarioId: realScenarioId } });
    }

    if (!dayId.startsWith("dry:")) {
      const total = await db.activity.count({ where: { dayId } });
      if (total > d.activities.length) sum.warnings.push(`Day ${d.day} has ${total - d.activities.length} more activit${total - d.activities.length === 1 ? "y" : "ies"} than the file. They were left as they are.`);
    }
  }
  if (touchedProgress.size > 0) {
    sum.warnings.push(`${touchedProgress.size} updated activit${touchedProgress.size === 1 ? "y has" : "ies have"} learner progress. Their progress is kept, so people see the new wording.`);
  }
  return sum;
}

// ───────────────────────── Exporting ─────────────────────────

/** Writes the active programme in the same format the importer reads. */
export async function exportCurriculum(db: Prisma.TransactionClient, programmeSlug?: string): Promise<Curriculum | null> {
  const programme = programmeSlug
    ? await db.programme.findUnique({ where: { slug: programmeSlug } })
    : await db.programme.findFirst({ where: { isActive: true } });
  if (!programme) return null;

  const days = await db.programmeDay.findMany({ where: { programmeId: programme.id }, orderBy: { dayNumber: "asc" } });
  const acts = await db.activity.findMany({ where: { dayId: { in: days.map((d) => d.id) } }, orderBy: { position: "asc" } });

  const scenarioKeys = new Map<string, string>();
  const outScenarios: CurriculumScenario[] = [];
  for (const a of acts.filter((x) => x.scenarioId)) {
    if (scenarioKeys.has(a.scenarioId!)) continue;
    const s = await db.scenario.findUnique({ where: { id: a.scenarioId! } });
    if (!s) continue;
    scenarioKeys.set(s.id, s.key);
    const v = await db.scenarioVersion.findFirst({ where: { scenarioId: s.id }, orderBy: { version: "desc" } });
    const r = await db.rubric.findFirst({ where: { scenarioId: s.id }, orderBy: { version: "desc" } });
    if (!v || !r) continue;
    const body = v.body as unknown as ScenarioBody;
    outScenarios.push({
      key: s.key,
      ...(s.competency ? { competency: s.competency } : {}),
      title: body.title,
      template: body.template,
      ...(body.variables ? { variables: body.variables as CurriculumScenario["variables"] } : {}),
      ...(body.instructions ? { instructions: body.instructions } : {}),
      parts: body.parts,
      rubric: {
        ...(r.passThreshold !== null ? { passThreshold: r.passThreshold } : {}),
        criteria: r.criteria as unknown as RubricCriterion[],
        ...((r.criticalCriteria as unknown[] | null)?.length ? { criticalCriteria: r.criticalCriteria as unknown as NonNullable<CurriculumScenario["rubric"]["criticalCriteria"]> } : {}),
      },
    });
  }

  return {
    programme: { slug: programme.slug, title: programme.title, totalDays: programme.totalDays },
    ...(outScenarios.length ? { scenarios: outScenarios } : {}),
    days: days.map((d) => ({
      day: d.dayNumber,
      title: d.title,
      activities: acts
        .filter((a) => a.dayId === d.id)
        .map((a): CurriculumActivity => {
          const c = a.content as Record<string, any>;
          const base = { title: a.title, required: a.required };
          if (a.type === "LESSON") return { type: "LESSON", ...base, blocks: c.blocks };
          if (a.type === "REFLECTION") return { type: "REFLECTION", ...base, prompt: c.prompt, minWords: c.minWords };
          if (a.type === "QUIZ") return { type: "QUIZ", ...base, questions: c.questions, ...(c.passMark ? { passMark: c.passMark } : {}), ...(c.maxAttempts ? { maxAttempts: c.maxAttempts } : {}) };
          return { type: "SCENARIO", ...base, scenarioKey: scenarioKeys.get(a.scenarioId ?? "") ?? "unknown" };
        }),
    })),
  };
}
