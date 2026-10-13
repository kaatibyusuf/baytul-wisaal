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
        <h1 className="editorial text-4xl font-semibold leading-tight text-nile">Day {n}</h1>
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
      <p className="mt-6 text-sm font-semibold text-aqua-ink">Day {data.dayNumber}</p>
      <h1 className="editorial text-4xl font-semibold leading-tight text-nile sm:text-5xl">{data.title}</h1>
      <ol className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
        {data.activities.map((a) => (
          <li key={a.id}>
            <Link href={`/programme/activity/${a.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-aqua-tint">
              <span aria-hidden className={`arch flex h-11 w-8 shrink-0 items-end justify-center pb-1 text-sm font-bold ${a.status === "PASSED" ? "bg-nile text-white" : a.status === "NOT_STARTED" ? "border-2 border-border text-text-muted" : "bg-turquoise text-nile"}`}>
                {a.status === "PASSED" ? "✓" : ""}
              </span>
              <div className="min-w-0 flex-1">
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
      </ol>
    </AppShell>
  );
}
