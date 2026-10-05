"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type ReviewDetail } from "@/lib/api";
import { EVENT_LABELS, TRIGGER_LABELS } from "@/lib/review-labels";
import { useLoad } from "@/lib/use-load";

const label = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const DECISIONS = [
  { value: "APPROVED", title: "Approve", hint: "The activity is completed for this person." },
  { value: "CLARIFICATION_REQUESTED", title: "Need more information", hint: "Keeps it with the team. The person is told we may follow up." },
  { value: "FAILED", title: "Does not meet the requirements", hint: "Holds the activity for the team. The person is told this neutrally." },
] as const;

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useLoad<ReviewDetail>(`/admin/reviews/${id}`);
  const [choice, setChoice] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (error) {
    return (
      <AppShell>
        <FormMessage tone={error.status === 403 ? "info" : "error"}>{error.status === 403 ? "This page is for reviewers." : error.message}</FormMessage>
      </AppShell>
    );
  }
  if (!data) return <AppShell><PageLoading /></AppShell>;

  const combined = data.evaluations.find((e) => e.isAggregate);
  const providers = data.evaluations.filter((e) => !e.isAggregate);
  const open = data.status === "PENDING";

  async function decide() {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/admin/reviews/${id}/decision`, { body: { status: choice, notes: notes.trim() || undefined } });
      router.push("/admin/reviews");
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <AppShell width="max-w-5xl">
      <Link href="/admin/reviews" className="text-sm text-aqua-ink underline underline-offset-4">
        All reviews
      </Link>
      <h1 className="mt-3 text-3xl font-semibold text-nile">{data.candidate}</h1>
      <ul className="mt-3 flex flex-wrap gap-2">
        {data.triggers.map((t) => (
          <li key={t} className="rounded-full border border-border bg-white px-3 py-1 text-sm text-nile">
            {TRIGGER_LABELS[t] ?? t}
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-white p-6">
          <h2 className="font-semibold text-nile">The scenario</h2>
          <p className="editorial mt-3 text-nile/90">{data.scenario}</p>
        </section>
        <section className="rounded-lg border border-border bg-white p-6">
          <h2 className="font-semibold text-nile">The response, as written</h2>
          <p className="mt-3 whitespace-pre-wrap text-nile/90">{data.answer}</p>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-white p-6">
        <h2 className="font-semibold text-nile">Assessment</h2>
        {!combined ? (
          <p className="mt-3 text-text-muted">No AI assessment is available for this response. Please assess it directly.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-text-muted">
              Combined from {providers.length} assessor{providers.length === 1 ? "" : "s"}. Confidence {combined.confidence !== null ? Math.round(combined.confidence * 100) : "unknown"}%.
              Totals: {providers.map((p) => `${p.provider} ${p.total}`).join(", ")}. Combined {combined.total}.
            </p>
            {combined.summary && <p className="mt-3 text-nile">{combined.summary}</p>}
            <dl className="mt-4 divide-y divide-border">
              {Object.keys(combined.scores).map((k) => (
                <div key={k} className="grid gap-1 py-3 sm:grid-cols-[14rem_4rem_1fr]">
                  <dt className="font-semibold text-nile">{label(k)}</dt>
                  <dd className="tabular-nums text-nile">{combined.scores[k]}</dd>
                  <dd className="text-sm text-text-muted">{combined.evidence[k]}</dd>
                </div>
              ))}
            </dl>
            {!!combined.concerns?.length && (
              <div className="mt-4">
                <h3 className="font-semibold text-nile">Concerns</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-nile/90">{combined.concerns.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            )}
            {!!combined.contradictions?.length && (
              <div className="mt-4">
                <h3 className="font-semibold text-nile">Possible contradictions</h3>
                <ul className="mt-2 space-y-2 text-nile/90">
                  {combined.contradictions.map((c, i) => (
                    <li key={i} className="rounded-md bg-surface p-3 text-sm">
                      <p><strong>Earlier:</strong> {c.earlier}</p>
                      <p><strong>Now:</strong> {c.current}</p>
                      <p className="text-text-muted">{c.explanation}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {combined.followUp && <p className="mt-4 text-sm text-nile"><strong>Suggested follow-up question:</strong> {combined.followUp}</p>}
          </>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-border bg-white p-6">
        <h2 className="font-semibold text-nile">Session activity</h2>
        <p className="mt-1 text-sm text-text-muted">
          Signal level {data.integrityScore} of 100. These signals have ordinary explanations and are not evidence of anything on their own.
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {data.events.filter((e) => e.type !== "QUESTION_SERVED").map((e, i) => (
            <li key={i} className="flex justify-between py-2 text-nile">
              <span>{EVENT_LABELS[e.type] ?? e.type}</span>
              <span className="text-text-muted">{new Date(e.at).toLocaleTimeString()}</span>
            </li>
          ))}
          {data.events.every((e) => e.type === "QUESTION_SERVED") && <li className="py-2 text-text-muted">No unusual activity recorded.</li>}
        </ul>
      </section>

      {open ? (
        <section className="mt-6 rounded-lg border border-border bg-white p-6">
          <h2 className="font-semibold text-nile">Your decision</h2>
          <fieldset className="mt-3 space-y-2">
            <legend className="sr-only">Decision</legend>
            {DECISIONS.map((d) => (
              <label key={d.value} className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 hover:bg-aqua-tint">
                <input type="radio" name="decision" checked={choice === d.value} onChange={() => setChoice(d.value)} className="mt-1.5 h-4 w-4 accent-[#19687e]" />
                <span>
                  <span className="block font-semibold text-nile">{d.title}</span>
                  <span className="block text-sm text-text-muted">{d.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="notes" className="mt-4 block text-sm font-semibold text-nile">
            Notes for the record (not shown to the person)
          </label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5 block w-full rounded-md border border-border px-3.5 py-2.5 text-base text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise" />
          {problem && <div className="mt-4"><FormMessage tone="error">{problem}</FormMessage></div>}
          <Button onClick={decide} disabled={!choice || busy} className="mt-5">
            {busy ? "Saving..." : "Record decision"}
          </Button>
        </section>
      ) : (
        <div className="mt-6"><FormMessage tone="info">This review has been decided ({data.status.toLowerCase().replace(/_/g, " ")}).</FormMessage></div>
      )}
    </AppShell>
  );
}
