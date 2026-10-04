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
import { DEFAULT_SETTINGS, SETTING_KEYS } from "./programme/rules";

const prisma = new PrismaClient();

type Block = { type: "h" | "p" | "quote"; text: string };
type Seed = { type: ActivityType; title: string; required?: boolean; content: Prisma.InputJsonValue };

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

  for (let n = 1; n <= programme.totalDays; n++) {
    const def = authored[n] ?? placeholder(n);
    const day = await prisma.programmeDay.upsert({
      where: { programmeId_dayNumber: { programmeId: programme.id, dayNumber: n } },
      update: { title: def.title },
      create: { programmeId: programme.id, dayNumber: n, title: def.title },
    });
    for (const [i, a] of def.activities.entries()) {
      const existing = await prisma.activity.findFirst({ where: { dayId: day.id, position: i } });
      const data = { type: a.type, title: a.title, required: a.required ?? true, content: a.content, position: i };
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
