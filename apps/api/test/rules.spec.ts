import {
  DEFAULT_SETTINGS,
  checkReflection,
  countWords,
  dayState,
  dayUnlockAt,
  gradeQuiz,
  requiredReadSeconds,
} from "../src/programme/rules";

const S = DEFAULT_SETTINGS;
const start = new Date("2026-10-01T08:00:00Z");

describe("programme rules", () => {
  describe("dayState", () => {
    const base = { startedAt: start, settings: S, previousDayComplete: true, thisDayComplete: false };

    it("day 1 is open immediately", () => {
      expect(dayState({ ...base, dayNumber: 1, now: start })).toBe("OPEN");
    });

    it("later days stay locked until their time arrives, even if the previous day is done", () => {
      const now = new Date(start.getTime() + 60 * 60 * 1000);
      expect(dayState({ ...base, dayNumber: 2, now })).toBe("LOCKED_TIME");
      expect(dayState({ ...base, dayNumber: 2, now: dayUnlockAt(start, 2, S) })).toBe("OPEN");
    });

    it("time alone never opens a day: the previous day must be finished", () => {
      const now = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
      expect(dayState({ ...base, dayNumber: 3, now, previousDayComplete: false })).toBe("LOCKED_PREVIOUS");
    });

    it("a finished day reports COMPLETE", () => {
      expect(dayState({ ...base, dayNumber: 1, now: start, thisDayComplete: true })).toBe("COMPLETE");
    });

    it("respects a configurable unlock interval of zero", () => {
      const fast = { ...S, unlockIntervalHours: 0 };
      expect(dayState({ ...base, settings: fast, dayNumber: 5, now: start })).toBe("OPEN");
    });
  });

  describe("requiredReadSeconds", () => {
    it("floors at the minimum and caps at the maximum", () => {
      expect(requiredReadSeconds(10, S)).toBe(S.lessonMinSeconds);
      expect(requiredReadSeconds(100000, S)).toBe(S.lessonMaxSeconds);
    });
    it("scales with length in between", () => {
      expect(requiredReadSeconds(400, S)).toBe(48); // 400 words ~ 120s at 200wpm, 40% of that
    });
    it("can be switched off for local testing", () => {
      expect(requiredReadSeconds(400, { ...S, lessonMinSeconds: 0, lessonMaxSeconds: 0 })).toBe(0);
    });
  });

  describe("checkReflection", () => {
    it("requires the minimum word count", () => {
      expect(checkReflection("too short", 40).ok).toBe(false);
    });
    it("rejects padding made of repeated words", () => {
      expect(checkReflection(Array(60).fill("word").join(" "), 40).ok).toBe(false);
    });
    it("accepts genuine writing, including non-ASCII text", () => {
      const text = "I want to learn how to listen first and speak second, especially when we disagree about money or time with family and friends over many years";
      expect(checkReflection(text, 20).ok).toBe(true);
      expect(countWords(text)).toBeGreaterThan(20);
    });
  });

  describe("gradeQuiz", () => {
    const qs = [
      { text: "a", options: ["x", "y", "z"], correctIndex: 1 },
      { text: "b", options: ["x", "y"], correctIndex: 0 },
      { text: "c", options: ["x", "y", "z"], correctIndex: 2 },
    ];
    it("scores correctly", () => {
      expect(gradeQuiz(qs, [1, 0, 2])).toEqual({ ok: true, correct: 3, score: 100 });
      expect(gradeQuiz(qs, [1, 0, 0])).toEqual({ ok: true, correct: 2, score: 67 });
    });
    it("rejects missing, out-of-range and non-integer answers", () => {
      expect(gradeQuiz(qs, [1, 0]).ok).toBe(false);
      expect(gradeQuiz(qs, [1, 0, 3]).ok).toBe(false);
      expect(gradeQuiz(qs, [1, 0, -1]).ok).toBe(false);
      expect(gradeQuiz(qs, [1, 0, 1.5]).ok).toBe(false);
    });
  });
});
