/**
 * Seeds the programme structure and default settings.
 *
 * IMPORTANT: the lesson content below is SAMPLE content so the engine can be exercised end to
 * end. The real 30-day curriculum will be supplied separately and replaces it. Re-running this
 * script is safe: it updates by position and never deletes anything users have progressed through.
 *
 *   pnpm db:seed                      normal settings (one day unlocks per 24 hours)
 *   $env:SEED_DEV_FAST=1; pnpm db:seed   local testing: every day open in order, no reading delay
 *   $env:SEED_DEV_FAST=0; pnpm db:seed   put the normal settings back
 */
import "dotenv/config";
import { ActivityType, Prisma, PrismaClient } from "@prisma/client";
import { ASSESSMENT_DEFAULTS } from "./assessment/settings";
import { MATCHING_DEFAULTS } from "./matching/settings";
import { COMPAT_DEFAULTS } from "./postmatch/rules";
import { DEFAULT_SETTINGS, SETTING_KEYS } from "./programme/rules";

const prisma = new PrismaClient();

type Block = { type: "h" | "p" | "quote"; text: string };
type Seed = { type: ActivityType; title: string; required?: boolean; content: Prisma.InputJsonValue; scenarioKey?: string };

const lesson = (title: string, blocks: Block[]): Seed => ({ type: ActivityType.LESSON, title, content: { blocks } });
const reflection = (title: string, prompt: string, minWords: number): Seed => ({
  type: ActivityType.REFLECTION,
  title,
  content: { prompt, minWords },
});

const authored: Record<number, { title: string; activities: Seed[] }> = {
  1: {
    title: "Welcome: how this programme works",
    activities: [
      lesson("Why preparation comes before matching", [
        { type: "p", text: "SAMPLE CONTENT. Marriage is a big deal, and this platform treats it as one. Before you are introduced to anyone, you spend time thinking seriously about marriage itself." },
        { type: "h", text: "What the next 30 days involve" },
        { type: "p", text: "Each day has a short lesson, and most days ask you to reflect in writing or answer a few questions. Days open in order, and each one opens only when the one before it is finished." },
        { type: "p", text: "Nothing here is a test of whether you are a good person. It is a chance to clarify what you believe, what you expect, and how you handle the ordinary pressures of married life." },
      ]),
      reflection(
        "Your starting point",
        "In your own words, what do you hope will be different about how you approach marriage by the end of these 30 days?",
        40,
      ),
    ],
  },
  2: {
    title: "Compatibility, not perfection",
    activities: [
      lesson("Two good people can still be a poor match", [
        { type: "p", text: "SAMPLE CONTENT. Two people can both be responsible, religious and mature, and still want different lives. The question is never who is better. It is whether these two people have expectations that can live together." },
        { type: "quote", text: "The aim is not to find a perfect spouse, but a workable partnership between two real people." },
        { type: "p", text: "That is why a pairing that does not move forward says nothing about either person. It means that one pairing did not meet the requirements for the next stage." },
      ]),
      {
        type: ActivityType.QUIZ,
        title: "Check your understanding",
        content: {
          passMark: 67,
          maxAttempts: 3,
          questions: [
            {
              text: "What does Baytul Wisaal try to determine about two people?",
              options: [
                "Which of them is the better person",
                "Whether their expectations and approaches to marriage are compatible",
                "Which of them is more attractive",
              ],
              correctIndex: 1,
            },
            {
              text: "A pairing closes at the compatibility stage. What does that mean?",
              options: [
                "Both people are banned from the platform",
                "One of them failed the assessment",
                "That pairing did not meet the requirements for the next stage",
              ],
              correctIndex: 2,
            },
            {
              text: "Why do scenarios ask you to decide rather than answer \"it depends\"?",
              options: [
                "A real decision shows how you actually reason",
                "To make the programme longer",
                "To catch people out",
              ],
              correctIndex: 0,
            },
          ],
        },
      },
    ],
  },
  3: {
    title: "Thinking beyond physique",
    activities: [
      lesson("What lasts after the first impression", [
        { type: "p", text: "SAMPLE CONTENT. Appearance and chemistry are real, but they say little about the ordinary Tuesday nights of a marriage: who handles a hard conversation well, who is generous when money is tight, who is patient when tired." },
        { type: "p", text: "Today you practise noticing those qualities in people you already know, so that you can recognise what you value when it matters." },
      ]),
      reflection(
        "Qualities that matter",
        "Describe a quality in a person that you value more than their appearance, and a specific moment when that quality mattered.",
        40,
      ),
    ],
  },
  4: {
    title: "A scenario: when two duties collide",
    activities: [
      lesson("How scenarios work", [
        { type: "p", text: "SAMPLE CONTENT. Today you are placed in a realistic situation and asked to decide. There is no trick answer. What matters is that you make a concrete decision, explain it, and show that you have thought about everyone affected." },
        { type: "p", text: "Answers such as \"it depends\" or \"I would communicate\" are not accepted on their own, because they do not show how you would actually act. Say what you would do, in what order, and why." },
        { type: "h", text: "How the assessment is run" },
        { type: "p", text: "The scenario is shown only inside a protected session with a time limit and cannot be copied. Switching away from the page is noted for a person to consider, and is not treated as proof of anything. Write in your own words." },
      ]),
      { type: ActivityType.SCENARIO, title: "Scenario: a job loss and a parent's treatment", content: {}, scenarioKey: "job-loss-parent-treatment" },
    ],
  },
};

const placeholder = (n: number): { title: string; activities: Seed[] } => ({
  title: `Day ${n}`,
  activities: [
    lesson(`Day ${n} lesson (placeholder)`, [
      { type: "p", text: `PLACEHOLDER. The curriculum for day ${n} will be supplied separately and will replace this lesson.` },
      { type: "p", text: "This placeholder exists so the programme can be tested from the first day to the last." },
    ]),
  ],
});

async function main() {
  const programme = await prisma.programme.upsert({
    where: { slug: "marriage-readiness" },
    update: {},
    create: { slug: "marriage-readiness", title: "Marriage Readiness Programme", totalDays: 30 },
  });

  // SAMPLE scenario content. Replace with the real scenarios and rubrics (PRD sections 8 and 9).
  const scenario = await prisma.scenario.upsert({
    where: { key: "job-loss-parent-treatment" },
    update: {},
    create: { key: "job-loss-parent-treatment", competency: "Finance, family and communication" },
  });
  const body = {
    title: "A job loss and a parent's treatment",
    template:
      "You have been married for {{months}} months. Your combined household income is {{income}}. Your spouse loses their job. Your {{parent}} urgently needs {{need}} for medical treatment. You have {{savings}} in savings. Your spouse does not want you to use the emergency fund without discussing it together. Your {{parent}} says your spouse has become more important to you than your own {{parent}}. You have 48 hours to decide.",
    variables: {
      months: { type: "int", min: 10, max: 18 },
      income: { type: "int", min: 500000, max: 800000, step: 50000, format: "naira" },
      need: { type: "int", min: 200000, max: 300000, step: 50000, format: "naira" },
      savings: { type: "int", min: 800000, max: 1200000, step: 100000, format: "naira" },
      parent: { type: "choice", options: ["father", "mother"] },
    },
    instructions: "Make a decision and explain it. Answers like \"it depends\" or \"I would communicate\" are not accepted on their own.",
    parts: [
      { key: "decision", label: "What do you decide to do?", minWords: 12 },
      { key: "reasoning", label: "Why did you decide this?", minWords: 12 },
      { key: "funds", label: "Where exactly does the money come from?", minWords: 10 },
      { key: "tellSpouse", label: "What do you tell your spouse, and when?", minWords: 12 },
      { key: "tellParent", label: "What do you tell your parent, and when?", minWords: 12 },
      { key: "cuts", label: "Which expenses would you cut?", minWords: 10 },
      { key: "spouseDisagrees", label: "What happens if your spouse still disagrees?", minWords: 12 },
      { key: "parentAngry", label: "What happens if your parent becomes angry?", minWords: 12 },
      { key: "whoIsRight", label: "What is each side right about?", minWords: 12 },
      { key: "principle", label: "What principle is behind your decision?", minWords: 10 },
    ],
  };
  const hasVersion = await prisma.scenarioVersion.findFirst({ where: { scenarioId: scenario.id } });
  if (!hasVersion) await prisma.scenarioVersion.create({ data: { scenarioId: scenario.id, version: 1, body } });
  const hasRubric = await prisma.rubric.findFirst({ where: { scenarioId: scenario.id } });
  if (!hasRubric) {
    await prisma.rubric.create({
      data: {
        scenarioId: scenario.id,
        version: 1,
        passThreshold: 70,
        criteria: [
          { key: "financial_responsibility", label: "Financial responsibility", weight: 20, description: "Realistic, specific handling of the money, including repayment and protecting the household." },
          { key: "communication", label: "Communication", weight: 20, description: "Concrete plans for what is said, to whom and when, including honesty and timing." },
          { key: "conflict_resolution", label: "Conflict resolution", weight: 20, description: "A workable way through disagreement with the spouse and with the parent." },
          { key: "consideration_of_spouse", label: "Consideration of spouse", weight: 15, description: "Treats the spouse as a partner whose concerns are weighed and respected." },
          { key: "practical_reasoning", label: "Practical reasoning", weight: 15, description: "A plan that could actually be carried out within the time and means given." },
          { key: "self_awareness", label: "Self-awareness", weight: 10, description: "Recognises their own pressures, bias and what each side is right about." },
        ],
        criticalCriteria: [
          { key: "violence_or_coercion", label: "Violence or coercion", description: "Willingness to use violence, threats or coercion against anyone." },
          { key: "serious_deception", label: "Serious deliberate deception", description: "Plans to seriously and deliberately deceive the spouse or parent." },
          { key: "severe_financial_irresponsibility", label: "Severe financial irresponsibility", description: "Plans that would knowingly put the household in serious financial danger." },
        ],
      },
    });
  }

  for (let n = 1; n <= programme.totalDays; n++) {
    const def = authored[n] ?? placeholder(n);
    const day = await prisma.programmeDay.upsert({
      where: { programmeId_dayNumber: { programmeId: programme.id, dayNumber: n } },
      update: { title: def.title },
      create: { programmeId: programme.id, dayNumber: n, title: def.title },
    });
    for (const [i, a] of def.activities.entries()) {
      const existing = await prisma.activity.findFirst({ where: { dayId: day.id, position: i } });
      const scenarioId = a.scenarioKey ? (await prisma.scenario.findUnique({ where: { key: a.scenarioKey } }))?.id ?? null : null;
      const data = { type: a.type, title: a.title, required: a.required ?? true, content: a.content, position: i, scenarioId };
      if (existing) await prisma.activity.update({ where: { id: existing.id }, data });
      else await prisma.activity.create({ data: { ...data, dayId: day.id } });
    }
  }

  // Settings
  const mode = process.env.SEED_DEV_FAST;
  const values: Record<string, number> = { ...DEFAULT_SETTINGS };
  if (mode === "1") Object.assign(values, { unlockIntervalHours: 0, lessonMinSeconds: 0, lessonMaxSeconds: 0 });
  for (const [k, key] of Object.entries(SETTING_KEYS)) {
    const value = values[k];
    if (mode === undefined) {
      await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, value } });
    } else {
      await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
  }

  for (const [k, v] of Object.entries(ASSESSMENT_DEFAULTS)) {
    const key = `assessment.${k}`;
    await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, value: v } });
  }

  for (const [k, v] of Object.entries(MATCHING_DEFAULTS)) {
    const key = `matching.${k}`;
    await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, value: v } });
  }

  for (const [k, v] of Object.entries(COMPAT_DEFAULTS)) {
    const key = `compat.${k}`;
    await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, value: v } });
  }

  console.log(
    `Seeded "${programme.title}" (${programme.totalDays} days). ` +
      (mode === "1" ? "DEV-FAST settings on: all days open in order, no waiting." : "Normal settings."),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
