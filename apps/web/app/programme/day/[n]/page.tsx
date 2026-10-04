"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell, PageLoading } from "@/components/app-shell";
import { FormMessage } from "@/components/ui";
import type { ActivityStatus, DayView } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

const typeLabel: Record<string, string> = {
  LESSON: "Lesson",
  REFLECTION: "Reflection",
  QUIZ: "Questions",
  SCENARIO: "Scenario",
  ASSIGNMENT: "Assignment",
};

const statusLabel: Record<ActivityStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "With our team for review",
  PASSED: "Complete",
  FAILED: "Not passed",
};

export default function DayPage() {
  const { n } = useParams<{ n: string }>();
  const { data, error } = useLoad<DayView>(`/programme/days/${n}`);

  if (error) {
    const locked = error.code === "DAY_LOCKED_TIME" || error.code === "DAY_LOCKED_PREVIOUS";
    return (
      <AppShell>
        <h1 className="text-3xl font-semibold text-nile">Day {n}</h1>
        <div className="mt-6">
          <FormMessage tone={locked ? "info" : "error"}>{error.message}</FormMessage>
        </div>
        <Link href="/programme" className="mt-6 inline-block text-aqua-ink underline underline-offset-4">
          Back to the programme
        </Link>
      </AppShell>
    );
  }
  if (!data) return <AppShell><PageLoading /></AppShell>;

  return (
    <AppShell width="max-w-3xl">
      <Link href="/programme" className="text-sm text-aqua-ink underline underline-offset-4">
        All days
      </Link>
      <h1 className="mt-3 text-3xl font-semibold text-nile">
        Day {data.dayNumber}: {data.title}
      </h1>
      <ul className="mt-8 divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
        {data.activities.map((a) => (
          <li key={a.id}>
            <Link href={`/programme/activity/${a.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-aqua-tint">
              <div>
                <p className="text-sm text-text-muted">{typeLabel[a.type] ?? a.type}</p>
                <p className="font-semibold text-nile">{a.title}</p>
              </div>
              <span className={`text-sm ${a.status === "PASSED" ? "font-semibold text-aqua-ink" : "text-text-muted"}`}>
                {a.status === "PASSED" ? "✓ " : ""}
                {statusLabel[a.status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
