"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type DayState, type ProgrammeSummary } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function stateText(d: ProgrammeSummary["days"][number], prev: number): string {
  const counts = d.activitiesTotal ? `${d.activitiesDone ?? 0} of ${d.activitiesTotal} done` : "";
  switch (d.state as DayState) {
    case "COMPLETE":
      return "Complete";
    case "OPEN":
      return counts ? `Open, ${counts}` : "Open";
    case "LOCKED_TIME":
      return d.unlocksAt ? `Opens ${when(d.unlocksAt)}` : "Not open yet";
    case "LOCKED_PREVIOUS":
      return `Finish day ${prev} first`;
    default:
      return "";
  }
}

export default function ProgrammePage() {
  const { data, error, reload } = useLoad<ProgrammeSummary>("/programme");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function begin() {
    setStarting(true);
    setStartError(null);
    try {
      await api("/programme/enroll", { method: "POST", body: {} });
      reload();
    } catch (e) {
      setStartError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setStarting(false);
    }
  }

  if (!data) return <AppShell><PageLoading error={error?.message} /></AppShell>;

  const weeks: ProgrammeSummary["days"][] = [];
  for (let i = 0; i < data.days.length; i += 7) weeks.push(data.days.slice(i, i + 7));
  const enrolled = !!data.enrollment;
  const status = data.enrollment?.status;

  return (
    <AppShell>
      <h1 className="editorial text-4xl font-semibold leading-tight text-nile sm:text-5xl">{data.programme.title}</h1>

      {!enrolled && (
        <div className="lattice mt-6 rounded-2xl bg-night p-7 text-white sm:p-10">
          <p className="editorial prose-measure text-xl leading-relaxed">
            {data.programme.totalDays} days of short lessons, written reflections and questions. One day opens at a time, and each opens only when the one before it is finished.
          </p>
          {startError && <div className="mt-4"><FormMessage tone="error">{startError}</FormMessage></div>}
          <Button onClick={begin} disabled={starting} className="mt-6">
            {starting ? "Starting..." : "Begin the programme"}
          </Button>
        </div>
      )}

      {enrolled && (
        <div className="mt-6">
          {status === "COMPLETED" && (
            <div className="milestone rounded-lg p-5">
              <p className="font-semibold">You have completed the programme.</p>
              <p className="mt-1 text-sm">The next step, defining what you are seeking, opens in the next release.</p>
            </div>
          )}
          {(status === "EXPIRED" || status === "FAILED" || status === "UNDER_REVIEW") && (
            <FormMessage tone="info">
              {status === "EXPIRED" ? "The time allowed for this programme has passed. Please contact support." : "Your programme is with our team for review."}
            </FormMessage>
          )}
          <div className="mt-5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.percentComplete} aria-label="Programme progress">
            <div className="h-3 w-full rounded-full bg-border">
              <div className="h-3 rounded-full bg-turquoise transition-all" style={{ width: `${data.percentComplete}%` }} />
            </div>
            <p className="mt-2 text-sm text-text-muted">{data.percentComplete}% complete</p>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {weeks.map((week, wi) => (
          <section key={wi} aria-labelledby={`week-${wi}`}>
            <h2 id={`week-${wi}`} className="editorial text-2xl font-semibold text-nile">
              Week {wi + 1}
            </h2>
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
              {week.map((d) => {
                const clickable = d.state === "OPEN" || d.state === "COMPLETE";
                const row = (
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span
                      aria-hidden
                      className={`arch flex h-11 w-8 shrink-0 items-end justify-center pb-1 text-sm font-bold ${
                        d.state === "COMPLETE" ? "bg-nile text-white" : d.state === "OPEN" ? "bg-turquoise text-nile" : "border-2 border-border text-text-muted"
                      }`}
                    >
                      {d.state === "COMPLETE" ? "✓" : d.dayNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${clickable ? "text-nile" : "text-text-muted"}`}>
                        Day {d.dayNumber}: {d.title}
                      </p>
                      <p className="mt-0.5 text-sm text-text-muted">{enrolled ? stateText(d, d.dayNumber - 1) : ""}</p>
                    </div>
                    {d.state === "OPEN" && <span aria-hidden className="text-nile">→</span>}
                  </div>
                );
                return (
                  <li key={d.dayNumber}>
                    {clickable ? (
                      <Link href={`/programme/day/${d.dayNumber}`} className="block transition-colors hover:bg-aqua-tint">
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
