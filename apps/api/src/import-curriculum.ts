/**
 * Loads a curriculum file into the database from the command line.
 *
 *   pnpm db:import-curriculum path\to\curriculum.json --dry-run     preview, writes nothing
 *   pnpm db:import-curriculum path\to\curriculum.json               import for real
 *
 * The same checks and the same single transaction as the admin import. See docs/curriculum.example.json
 * for the format. Content missing from the file is never deleted.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { CurriculumError, importCurriculum, validateCurriculum } from "./programme/curriculum";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: pnpm db:import-curriculum <file.json> [--dry-run]");
    process.exit(2);
  }

  // pnpm runs this from apps/api, so relative paths are resolved from where you typed the command
  const path = resolve(process.env.INIT_CWD ?? process.cwd(), file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`Could not read ${path}: ${(e as Error).message}`);
    process.exit(2);
  }

  const v = validateCurriculum(raw);
  if (!v.ok) {
    console.error(`The curriculum has ${v.problems.length} problem${v.problems.length === 1 ? "" : "s"}:\n`);
    for (const p of v.problems) console.error(`  ${p.path}: ${p.message}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const summary = dryRun
      ? await importCurriculum(prisma, v.value, true)
      : await prisma.$transaction((tx) => importCurriculum(tx, v.value, false), { timeout: 60_000 });
    console.log(dryRun ? "PREVIEW (nothing was written)" : "IMPORTED");
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    if (e instanceof CurriculumError) {
      console.error("The curriculum could not be imported:\n");
      for (const p of e.problems) console.error(`  ${p.path}: ${p.message}`);
      process.exit(1);
    }
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main();
