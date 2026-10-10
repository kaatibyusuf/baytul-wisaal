import { CurriculumError, Curriculum, exportCurriculum, importCurriculum, parseBody, validateCurriculum } from "../src/programme/curriculum";
import { createFakePrisma } from "./fake-prisma";

const good = (): any => ({
  programme: { slug: "marriage-readiness", title: "Marriage Readiness Programme", totalDays: 3 },
  scenarios: [
    {
      key: "job-loss",
      competency: "Finance",
      title: "A job loss",
      template: "You have {{months}} months of savings and your {{parent}} needs help urgently.",
      variables: { months: { type: "int", min: 3, max: 9 }, parent: { type: "choice", options: ["father", "mother"] } },
      instructions: "Decide, then explain.",
      parts: [{ key: "decision", label: "What do you decide?", minWords: 10 }],
      rubric: {
        passThreshold: 70,
        criteria: [{ key: "finance", label: "Finance", weight: 60 }, { key: "communication", label: "Communication", weight: 40 }],
        criticalCriteria: [{ key: "violence", label: "Violence", description: "Willingness to use violence" }],
      },
    },
  ],
  days: [
    {
      day: 1,
      title: "Welcome",
      activities: [
        { type: "LESSON", title: "How this works", body: "## Why we start here\n\nMarriage is a big deal.\nWe treat it as one.\n\n> Prepare before you look." },
        { type: "REFLECTION", title: "Your starting point", prompt: "What do you hope will change?", minWords: 40 },
      ],
    },
    {
      day: 2,
      title: "Questions",
      activities: [
        { type: "QUIZ", title: "Check", passMark: 67, questions: [{ text: "What is compared?", options: ["People", "Pairings"], correctIndex: 1 }] },
        { type: "SCENARIO", title: "The scenario", scenarioKey: "job-loss" },
      ],
    },
  ],
});

const run = (db: any, c: Curriculum, dryRun = false) => importCurriculum(db, c, dryRun);
const parsed = (raw: unknown) => {
  const v = validateCurriculum(raw);
  if (!v.ok) throw new Error(JSON.stringify(v.problems));
  return v.value;
};
const problems = (raw: unknown) => {
  const v = validateCurriculum(raw);
  return v.ok ? [] : v.problems;
};
const counts = (db: any) => ({
  days: db.days.rows.length,
  activities: db.activities.rows.length,
  scenarios: db.scenarios.rows.length,
  versions: db.scenarioVersions.rows.length,
  rubrics: db.rubrics.rows.length,
  programmes: db.programme.rows.length,
});

describe("checking a curriculum file", () => {
  it("accepts a valid file", () => expect(validateCurriculum(good()).ok).toBe(true));

  it("reports every structural problem together, with where each one is", () => {
    const c = good();
    c.days[0].activities[0].titel = "typo"; // a misspelt field is caught, not silently ignored
    c.days[0].activities[1].minWords = 2; // out of range
    c.days[1].activities[0].questions[0].options = ["only one"];
    const at = problems(c).map((x) => x.path);
    expect(at.some((x) => x.startsWith("days.0.activities.0"))).toBe(true);
    expect(at).toContain("days.0.activities.1.minWords");
    expect(at.some((x) => x.startsWith("days.1.activities.0.questions.0.options"))).toBe(true);
  });

  it("then reports every deeper problem together once the structure is right", () => {
    const c = good();
    c.days[1].day = 9; // beyond totalDays
    c.days[1].activities[0].questions[0].correctIndex = 5;
    c.scenarios[0].rubric.criteria[0].weight = 50;
    c.scenarios[0].template = "Uses {{unknown}} value in a long enough template text";
    const p = problems(c);
    expect(p.find((x) => x.path === "days.1.day")!.message).toMatch(/beyond/);
    expect(p.find((x) => x.path.endsWith("correctIndex"))!.message).toMatch(/only 2 options/);
    expect(p.find((x) => x.path.endsWith("rubric.criteria"))!.message).toMatch(/add up to 90/);
    expect(p.find((x) => x.path.endsWith("template"))!.message).toMatch(/unknown variable "unknown"/);
  });

  it("rejects duplicate days, duplicate keys, and a lesson with no content or two kinds", () => {
    const c = good();
    c.days.push({ ...c.days[0] });
    c.scenarios.push({ ...c.scenarios[0] });
    c.days[0].activities[0] = { type: "LESSON", title: "Both", body: "text here", blocks: [{ type: "p", text: "x" }] };
    c.days[1].activities[0] = { type: "LESSON", title: "None" };
    const msgs = problems(c).map((x) => x.message).join(" | ");
    expect(msgs).toMatch(/more than once/);
    expect(msgs).toMatch(/not both/);
    expect(msgs).toMatch(/either 'blocks' or 'body'/);
  });

  it("rejects unknown activity types, empty files and junk", () => {
    expect(problems({ ...good(), days: [{ day: 1, title: "Day", activities: [{ type: "VIDEO", title: "x" }] }] }).length).toBeGreaterThan(0);
    for (const junk of [null, 5, "x", [], {}]) expect(problems(junk).length).toBeGreaterThan(0);
  });

  it("turns a plain-text body into headings, quotes and paragraphs", () => {
    expect(parseBody("## A heading\n\nFirst line\ncontinues here.\n\n> A quote\n> over two lines\n\nLast.")).toEqual([
      { type: "h", text: "A heading" },
      { type: "p", text: "First line continues here." },
      { type: "quote", text: "A quote\nover two lines" },
      { type: "p", text: "Last." },
    ]);
  });
});

describe("importing a curriculum", () => {
  it("creates everything, and a second import changes nothing", async () => {
    const db: any = createFakePrisma();
    const first = await run(db, parsed(good()));
    expect(first).toMatchObject({
      dryRun: false,
      programme: "created",
      days: { created: 2, updated: 0, unchanged: 0 },
      activities: { created: 4, updated: 0, unchanged: 0 },
      scenarios: { created: 1, newVersion: 0, unchanged: 0 },
    });
    expect(counts(db)).toEqual({ days: 2, activities: 4, scenarios: 1, versions: 1, rubrics: 1, programmes: 1 });
    // The scenario activity points at the scenario, and the lesson was converted
    expect(db.activities.rows.find((a: any) => a.type === "SCENARIO").scenarioId).toBe(db.scenarios.rows[0].id);
    expect(db.activities.rows.find((a: any) => a.type === "LESSON").content.blocks).toHaveLength(3);

    const before = counts(db);
    const second = await run(db, parsed(good()));
    expect(second).toMatchObject({
      programme: "unchanged",
      days: { created: 0, updated: 0, unchanged: 2 },
      activities: { created: 0, updated: 0, unchanged: 4 },
      scenarios: { created: 0, newVersion: 0, unchanged: 1 },
      warnings: [],
    });
    expect(counts(db)).toEqual(before);
  });

  it("a dry run reports what would happen and writes nothing", async () => {
    const db: any = createFakePrisma();
    const r = await run(db, parsed(good()), true);
    expect(r).toMatchObject({ dryRun: true, programme: "created", days: { created: 2 }, activities: { created: 4 }, scenarios: { created: 1 } });
    expect(counts(db)).toEqual({ days: 0, activities: 0, scenarios: 0, versions: 0, rubrics: 0, programmes: 0 });
  });

  it("updates changed wording and leaves the rest alone", async () => {
    const db: any = createFakePrisma();
    await run(db, parsed(good()));
    const c = good();
    c.days[0].title = "Welcome, renamed";
    c.days[0].activities[1].prompt = "What do you hope will be different?";
    const r = await run(db, parsed(c));
    expect(r.days).toEqual({ created: 0, updated: 1, unchanged: 1 });
    expect(r.activities).toEqual({ created: 0, updated: 1, unchanged: 3 });
    expect(db.activities.rows.find((a: any) => a.type === "REFLECTION").content.prompt).toBe("What do you hope will be different?");
  });

  it("warns when it changes something people are already working through, and keeps their progress", async () => {
    const db: any = createFakePrisma();
    await run(db, parsed(good()));
    const lesson = db.activities.rows.find((a: any) => a.type === "LESSON");
    await db.progress.create({ data: { enrollmentId: "e1", activityId: lesson.id, status: "PASSED" } });
    const c = good();
    c.days[0].activities[0].body = "## New heading\n\nCompletely new text for the lesson.";
    const r = await run(db, parsed(c));
    expect(r.warnings.join(" ")).toMatch(/learner progress/);
    expect(db.progress.rows).toHaveLength(1);
    expect(db.progress.rows[0].status).toBe("PASSED");
  });

  it("never deletes: anything missing from the file is left as it was", async () => {
    const db: any = createFakePrisma();
    await run(db, parsed(good()));
    const c = good();
    c.days = [c.days[0]];
    c.days[0].activities = [c.days[0].activities[0]];
    const r = await run(db, parsed(c));
    expect(r.warnings.join(" ")).toMatch(/1 more activity than the file/);
    expect(counts(db).activities).toBe(4);
    expect(counts(db).days).toBe(2);
  });

  it("changing a scenario adds a new version instead of overwriting the old one", async () => {
    const db: any = createFakePrisma();
    await run(db, parsed(good()));
    const c = good();
    c.scenarios[0].template = "Now you have {{months}} months of savings and your {{parent}} is unwell and needs urgent care.";
    const r = await run(db, parsed(c));
    expect(r.scenarios).toEqual({ created: 0, newVersion: 1, unchanged: 0 });
    expect(r.warnings.join(" ")).toMatch(/new version was added/);
    expect(db.scenarioVersions.rows.map((v: any) => v.version).sort()).toEqual([1, 2]);
    expect(db.scenarioVersions.rows.find((v: any) => v.version === 1).body.template).toMatch(/^You have/); // the old one is intact
    expect(db.rubrics.rows).toHaveLength(1); // the rubric did not change
  });

  it("changing only the rubric versions only the rubric", async () => {
    const db: any = createFakePrisma();
    await run(db, parsed(good()));
    const c = good();
    c.scenarios[0].rubric.passThreshold = 75;
    await run(db, parsed(c));
    expect(db.rubrics.rows.map((r: any) => r.version).sort()).toEqual([1, 2]);
    expect(db.scenarioVersions.rows).toHaveLength(1);
  });

  it("refuses an activity that names a scenario which does not exist, and writes nothing for it", async () => {
    const db: any = createFakePrisma();
    const c = good();
    delete c.scenarios;
    await expect(run(db, parsed(c))).rejects.toBeInstanceOf(CurriculumError);
    await run(db, parsed(good()));
    delete c.scenarios; // now it exists in the database, so a file without it is fine
    await expect(run(db, parsed(c))).resolves.toBeDefined();
  });

  it("will not change an activity's type once people have progress on it", async () => {
    const db: any = createFakePrisma();
    await run(db, parsed(good()));
    const lesson = db.activities.rows.find((a: any) => a.type === "LESSON");
    await db.progress.create({ data: { enrollmentId: "e1", activityId: lesson.id, status: "IN_PROGRESS" } });
    const c = good();
    c.days[0].activities[0] = { type: "REFLECTION", title: "Now a reflection", prompt: "Say what you think about it" };
    const err = await run(db, parsed(c)).catch((e) => e);
    expect(err).toBeInstanceOf(CurriculumError);
    expect(err.problems[0].message).toMatch(/already has learner progress/);
  });

  it("creates a second programme inactive when one is already active", async () => {
    const db: any = createFakePrisma();
    await run(db, parsed(good()));
    const c = good();
    c.programme.slug = "another-programme";
    const r = await run(db, parsed(c));
    expect(r.warnings.join(" ")).toMatch(/created inactive/);
    expect(db.programme.rows.find((p: any) => p.slug === "another-programme").isActive).toBe(false);
  });
});

describe("exporting a curriculum", () => {
  it("returns nothing when there is no programme", async () => {
    expect(await exportCurriculum(createFakePrisma() as any)).toBeNull();
  });

  it("writes the same format back, so export, edit and import again changes nothing", async () => {
    const db: any = createFakePrisma();
    await run(db, parsed(good()));
    const exported = await exportCurriculum(db);
    const again = validateCurriculum(JSON.parse(JSON.stringify(exported)));
    expect(again.ok).toBe(true);
    if (again.ok) {
      const r = await run(db, again.value, true);
      expect(r).toMatchObject({
        programme: "unchanged",
        days: { created: 0, updated: 0, unchanged: 2 },
        activities: { created: 0, updated: 0, unchanged: 4 },
        scenarios: { created: 0, newVersion: 0, unchanged: 1 },
        warnings: [],
      });
    }
    expect(exported!.scenarios![0].key).toBe("job-loss");
    expect(exported!.days[1].activities[1]).toMatchObject({ type: "SCENARIO", scenarioKey: "job-loss" });
  });
});
