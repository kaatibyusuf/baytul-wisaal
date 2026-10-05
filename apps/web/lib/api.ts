const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/**
 * Thin client for the NestJS API. The browser only ever talks to our own backend,
 * and the session lives in an HTTP-only cookie it cannot read.
 */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      credentials: "include",
      headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers ?? {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "We could not reach the server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = data?.message;
    const message = Array.isArray(raw) ? raw[0] : raw;
    throw new ApiError(res.status, data?.code ?? "ERROR", message ?? "Something went wrong. Please try again.", data ?? {});
  }
  return data as T;
}

export type Me = {
  id: string;
  email: string;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  profile: { fullName: string; preferredName: string | null } | null;
  journey: { programme: string };
};

export type DayState = "NOT_ENROLLED" | "COMPLETE" | "OPEN" | "LOCKED_TIME" | "LOCKED_PREVIOUS";

export type ProgrammeSummary = {
  programme: { id: string; title: string; totalDays: number };
  enrollment: null | { status: "IN_PROGRESS" | "UNDER_REVIEW" | "COMPLETED" | "FAILED" | "EXPIRED"; startedAt: string; dueAt: string | null; completedAt: string | null };
  days: { dayNumber: number; title: string; state: DayState; unlocksAt?: string | null; activitiesTotal?: number; activitiesDone?: number }[];
  currentDay: number | null;
  percentComplete: number;
};

export type ActivityStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "UNDER_REVIEW" | "PASSED" | "FAILED";

export type DayView = {
  dayNumber: number;
  title: string;
  state: DayState;
  activities: { id: string; type: "LESSON" | "REFLECTION" | "QUIZ" | "SCENARIO" | "ASSIGNMENT"; title: string; required: boolean; status: ActivityStatus }[];
};

export type ActivityView = {
  id: string;
  title: string;
  required: boolean;
  dayNumber: number;
  status: ActivityStatus;
  attemptsUsed: number;
} & (
  | { type: "LESSON"; content: { blocks: { type: "h" | "p" | "quote"; text: string }[] }; minReadSeconds: number }
  | { type: "REFLECTION"; content: { prompt: string; minWords: number }; submittedText: string | null }
  | { type: "QUIZ"; content: { questions: { text: string; options: string[] }[] }; passMark: number; maxAttempts: number }
  | { type: "SCENARIO"; sessionMinutes: number }
);

export type ActivityResult = {
  activityStatus: ActivityStatus;
  dayComplete: boolean;
  programmeCompleted: boolean;
  score?: number;
  passed?: boolean;
  attemptsLeft?: number;
};

export type ProfileData = {
  fullName: string;
  preferredName: string | null;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
  maritalStatus: "NEVER_MARRIED" | "DIVORCED" | "WIDOWED";
  location: string | null;
  country: string | null;
  region: string | null;
  nationality: string | null;
  phone: string | null;
  education: string | null;
  occupation: string | null;
  religiousInfo: { practice?: string; quranStudy?: string; notes?: string };
  familyInfo: { siblings?: number; parents?: string; notes?: string };
};

export type AssessmentQuestion = {
  sessionId: string;
  watermark: string;
  expiresAt: string;
  title: string;
  text: string;
  instructions: string;
  parts: { key: string; label: string; minWords: number }[];
};

export type SessionState = "IN_PROGRESS" | "RECEIVED" | "IN_REVIEW" | "COMPLETE" | "EXPIRED";

export type ReviewListItem = { id: string; createdAt: string; triggers: string[] };

export type ReviewDetail = {
  id: string;
  status: string;
  triggers: string[];
  createdAt: string;
  candidate: string;
  scenario: string;
  answer: string;
  integrityScore: number;
  evaluations: {
    provider: string;
    model: string;
    isAggregate: boolean;
    total: number;
    scores: Record<string, number>;
    evidence: Record<string, string>;
    concerns: string[] | null;
    contradictions: { earlier: string; current: string; explanation: string }[] | null;
    confidence: number | null;
    followUp: string | null;
    summary: string | null;
    criticalFlag: boolean;
  }[];
  events: { type: string; at: string; metadata: Record<string, unknown> | null }[];
};

export type Level = "NON_NEGOTIABLE" | "PREFERENCE" | "FLEXIBLE";

export type QuestionDef = {
  key: string;
  category: string;
  prompt: string;
  seekPrompt: string;
  options: { value: string; label: string }[];
  weight: number;
  allowNonNegotiable: boolean;
};

export type PreferencesForm = {
  version: number;
  categories: { key: string; title: string; intro: string }[];
  questions: QuestionDef[];
  eligible: boolean;
  ineligibleReason: string | null;
  nonNegotiableMax: number;
  submittedAt: string | null;
  availability: "AVAILABLE" | "PAUSED";
  availableAfter: string | null;
  hasActiveMatch: boolean;
  answers: null | {
    self: Record<string, string>;
    seek: Record<string, { accept: string[]; level: Level; note?: string }>;
    filters: { ageMin: number; ageMax: number; maritalStatuses: string[]; locationScope: string } | null;
  };
};

export type MatchesData = {
  current: null | {
    id: string;
    stage: string;
    createdAt: string;
    whatNext: string;
    introduction: null | {
      name: string;
      age: number;
      location: string | null;
      education: string | null;
      occupation: string | null;
      maritalStatus: string;
    };
  };
  history: { id: string; status: string; stage: string; createdAt: string; closedAt: string | null; note: string | null }[];
};

export type RunResult = {
  dryRun: boolean;
  created: number;
  proposed: { a: string; b: string; score: number }[];
  stats: {
    candidates: number;
    pairsConsidered: number;
    excluded: number;
    belowMinimumScore: number;
    rejected: Record<string, number>;
    eligiblePairs: number;
    unmatched: number;
  };
};

export type NotificationsData = {
  unread: number;
  items: { id: string; type: string; title: string; body: string | null; readAt: string | null; createdAt: string }[];
};
