/**
 * Pure programme rules. No database, no clock reads: everything is passed in, so each rule
 * can be tested on its own. The service layer applies these on the server for every request
 * (PRD rule 14), and nothing here is ever decided by the browser.
 */

export interface ProgrammeSettings {
  /** Hours between one day unlocking and the next. 24 = one day per day. */
  unlockIntervalHours: number;
  /** Extra days after the last day before an unfinished enrolment expires. */
  graceDays: number;
  lessonMinSeconds: number;
  lessonMaxSeconds: number;
  /** Fraction of the estimated reading time that must pass before a lesson can be completed. */
  readingFraction: number;
  quizPassMark: number;
  quizMaxAttempts: number;
}

export const DEFAULT_SETTINGS: ProgrammeSettings = {
  unlockIntervalHours: 24,
  graceDays: 14,
  lessonMinSeconds: 10,
  lessonMaxSeconds: 120,
  readingFraction: 0.4,
  quizPassMark: 80,
  quizMaxAttempts: 3,
};

export const SETTING_KEYS: Record<keyof ProgrammeSettings, string> = {
  unlockIntervalHours: "programme.unlockIntervalHours",
  graceDays: "programme.graceDays",
  lessonMinSeconds: "programme.lessonMinSeconds",
  lessonMaxSeconds: "programme.lessonMaxSeconds",
  readingFraction: "programme.readingFraction",
  quizPassMark: "programme.quizPassMark",
  quizMaxAttempts: "programme.quizMaxAttempts",
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const dayUnlockAt = (startedAt: Date, dayNumber: number, s: ProgrammeSettings): Date =>
  new Date(startedAt.getTime() + (dayNumber - 1) * s.unlockIntervalHours * HOUR);

export const dueDate = (startedAt: Date, totalDays: number, s: ProgrammeSettings): Date =>
  new Date(startedAt.getTime() + (totalDays * s.unlockIntervalHours / 24 * DAY) + s.graceDays * DAY);

export type DayState = "COMPLETE" | "OPEN" | "LOCKED_TIME" | "LOCKED_PREVIOUS";

/**
 * A day is open only when BOTH hold: enough time has passed since enrolment, and every
 * required activity of the previous day is complete. Time alone never skips content.
 */
export function dayState(opts: {
  dayNumber: number;
  now: Date;
  startedAt: Date;
  settings: ProgrammeSettings;
  previousDayComplete: boolean;
  thisDayComplete: boolean;
}): DayState {
  if (opts.thisDayComplete) return "COMPLETE";
  if (opts.now < dayUnlockAt(opts.startedAt, opts.dayNumber, opts.settings)) return "LOCKED_TIME";
  if (opts.dayNumber > 1 && !opts.previousDayComplete) return "LOCKED_PREVIOUS";
  return "OPEN";
}

export const countWords = (text: string): number => (text.trim().match(/\S+/g) ?? []).length;

/** Seconds a user must spend on a lesson before the server accepts "complete". */
export function requiredReadSeconds(wordCount: number, s: ProgrammeSettings): number {
  if (s.lessonMinSeconds === 0 && s.lessonMaxSeconds === 0) return 0;
  const estimated = (wordCount / 200) * 60 * s.readingFraction;
  return Math.round(Math.min(s.lessonMaxSeconds, Math.max(s.lessonMinSeconds, estimated)));
}

/** A reflection must be a real piece of writing, not padding. */
export function checkReflection(text: string, minWords: number): { ok: true } | { ok: false; reason: string } {
  const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  if (words.length < minWords) {
    return { ok: false, reason: `Please write at least ${minWords} words. You have written ${words.length}.` };
  }
  const distinct = new Set(words).size;
  if (distinct < Math.min(Math.ceil(minWords * 0.5), 20)) {
    return { ok: false, reason: "Your reflection needs more than repeated words. Say what you actually think." };
  }
  return { ok: true };
}

export interface QuizQuestion {
  text: string;
  options: string[];
  correctIndex: number;
}

export function gradeQuiz(
  questions: QuizQuestion[],
  answers: number[],
): { ok: true; score: number; correct: number } | { ok: false; reason: string } {
  if (answers.length !== questions.length) {
    return { ok: false, reason: "Please answer every question." };
  }
  for (let i = 0; i < questions.length; i++) {
    const a = answers[i];
    if (!Number.isInteger(a) || a < 0 || a >= questions[i].options.length) {
      return { ok: false, reason: "One of your answers is not valid." };
    }
  }
  const correct = questions.filter((q, i) => answers[i] === q.correctIndex).length;
  return { ok: true, correct, score: Math.round((correct / questions.length) * 100) };
}

/** Content shapes stored in Activity.content (JSON). */
export type LessonBlock = { type: "h" | "p" | "quote"; text: string };
export interface LessonContent {
  blocks: LessonBlock[];
}
export interface ReflectionContent {
  prompt: string;
  minWords?: number;
}
export interface QuizContent {
  questions: QuizQuestion[];
  passMark?: number;
  maxAttempts?: number;
}

export const lessonWordCount = (c: LessonContent): number =>
  c.blocks.reduce((n, b) => n + countWords(b.text), 0);
