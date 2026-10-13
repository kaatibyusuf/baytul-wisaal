"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { ScenarioRunner } from "@/components/scenario-runner";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type ActivityResult, type ActivityView } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

const wordCount = (t: string) => (t.trim().match(/\S+/g) ?? []).length;

function Outcome({ result, dayNumber }: { result: ActivityResult; dayNumber: number }) {
  return (
    <div className="mt-8 space-y-4">
      {result.programmeCompleted ? (
        <div className="milestone rounded-lg p-5">
          <p className="font-semibold">You have completed the programme.</p>
          <p className="mt-1 text-sm">Take a moment with that. The next step opens in the next release.</p>
        </div>
      ) : result.dayComplete ? (
        <FormMessage tone="success">Day {dayNumber} is complete.</FormMessage>
      ) : null}
      <div className="flex flex-wrap gap-4">
        <Link href={`/programme/day/${dayNumber}`} className="rounded-md border border-nile px-5 py-3 font-semibold text-nile hover:bg-aqua-tint">
          Back to day {dayNumber}
        </Link>
        <Link href="/programme" className="rounded-md bg-nile px-5 py-3 font-semibold text-white hover:bg-aqua">
          Programme overview
        </Link>
      </div>
    </div>
  );
}

function Lesson({ a, onDone }: { a: Extract<ActivityView, { type: "LESSON" }>; onDone: (r: ActivityResult) => void }) {
  const [left, setLeft] = useState(a.status === "PASSED" ? 0 : a.minReadSeconds);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Countdown is only a courtesy. The server enforces the reading time on its own clock.
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      onDone(await api<ActivityResult>(`/programme/activities/${a.id}/complete`, { method: "POST", body: {} }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "TOO_EARLY") {
        const secs = Number(e.extra.retryAfterSeconds ?? 5);
        setLeft(Number.isFinite(secs) ? secs : 5);
      }
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <article className="mt-8">
        <div className="editorial prose-measure space-y-6 text-[1.2rem] leading-[1.85] text-nile">
          {a.content.blocks.map((b, i) =>
            b.type === "h" ? (
              <h2 key={i} className="!mt-12 font-sans text-2xl font-semibold leading-snug text-nile">{b.text}</h2>
            ) : b.type === "quote" ? (
              <blockquote key={i} className="!my-10 border-l-4 border-gold bg-gold-tint py-5 pl-6 pr-5 text-[1.35rem] italic leading-snug text-nile">{b.text}</blockquote>
            ) : (
              <p key={i}>{b.text}</p>
            ),
          )}
        </div>
      </article>
      {a.status === "PASSED" ? (
        <p className="mt-6 font-semibold text-aqua-ink">✓ You have completed this lesson.</p>
      ) : (
        <div className="mt-10 space-y-3 border-t border-border pt-6">
          {a.minReadSeconds > 0 && (
            <div aria-hidden className="h-1.5 w-full max-w-xs rounded-full bg-border">
              <div className="h-1.5 rounded-full bg-turquoise transition-all duration-1000 ease-linear" style={{ width: `${Math.round(((a.minReadSeconds - Math.max(left, 0)) / a.minReadSeconds) * 100)}%` }} />
            </div>
          )}
          {error && <FormMessage tone="info">{error}</FormMessage>}
          <Button onClick={complete} disabled={busy || left > 0}>
            {left > 0 ? `Mark as complete (${left}s)` : busy ? "Saving..." : "Mark as complete"}
          </Button>
        </div>
      )}
    </>
  );
}

function Reflection({ a, onDone }: { a: Extract<ActivityView, { type: "REFLECTION" }>; onDone: (r: ActivityResult) => void }) {
  const done = a.status === "PASSED";
  const [text, setText] = useState(a.submittedText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const words = wordCount(text);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onDone(await api<ActivityResult>(`/programme/activities/${a.id}/submit`, { body: { text } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-border bg-white p-6 sm:p-8">
      <label htmlFor="reflection" className="editorial block text-xl text-nile">
        {a.content.prompt}
      </label>
      <textarea
        id="reflection"
        value={text}
        onChange={(e) => setText(e.target.value)}
        readOnly={done}
        rows={10}
        className="editorial mt-4 block w-full rounded-md border border-border px-4 py-3 text-lg leading-relaxed text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise read-only:bg-surface"
        aria-describedby="reflection-count"
      />
      <p id="reflection-count" className="mt-2 text-sm text-text-muted">
        {done ? "Submitted." : `${words} words. At least ${a.content.minWords} needed.`}
      </p>
      {error && <div className="mt-4"><FormMessage tone="error">{error}</FormMessage></div>}
      {!done && (
        <Button onClick={submit} disabled={busy || words < a.content.minWords} className="mt-5">
          {busy ? "Saving..." : "Submit reflection"}
        </Button>
      )}
    </div>
  );
}

function Quiz({ a, onDone }: { a: Extract<ActivityView, { type: "QUIZ" }>; onDone: (r: ActivityResult) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(a.content.questions.map(() => null));
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActivityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const done = a.status === "PASSED";
  const review = a.status === "UNDER_REVIEW";
  const ready = answers.every((x) => x !== null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<ActivityResult>(`/programme/activities/${a.id}/submit`, { body: { answers } });
      if (r.passed || r.activityStatus === "UNDER_REVIEW") onDone(r);
      else {
        setFeedback(r);
        setAnswers(a.content.questions.map(() => null));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="mt-6 font-semibold text-aqua-ink">✓ You have passed these questions.</p>;
  if (review) return <div className="mt-6"><FormMessage tone="info">These questions are with our team for review. We will be in touch.</FormMessage></div>;

  return (
    <div className="mt-6 space-y-6">
      {feedback && (
        <FormMessage tone="info">
          You scored {feedback.score}%. You need {a.passMark}% to pass. You have {feedback.attemptsLeft} {feedback.attemptsLeft === 1 ? "attempt" : "attempts"} left. Take another look and try again.
        </FormMessage>
      )}
      {a.content.questions.map((q, qi) => (
        <fieldset key={qi} className="rounded-xl border border-border bg-white p-6">
          <legend className="editorial px-1 text-xl font-semibold text-nile">
            {qi + 1}. {q.text}
          </legend>
          <div className="mt-3 space-y-2">
            {q.options.map((opt, oi) => (
              <label key={oi} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-aqua-tint ${answers[qi] === oi ? "border-aqua bg-aqua-tint" : "border-border"}`}>
                <input
                  type="radio"
                  name={`q${qi}`}
                  checked={answers[qi] === oi}
                  onChange={() => setAnswers((prev) => prev.map((v, i) => (i === qi ? oi : v)))}
                  className="mt-1.5 h-4 w-4 accent-[#19687e]"
                />
                <span className="text-nile">{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button onClick={submit} disabled={busy || !ready}>
        {busy ? "Checking..." : "Submit answers"}
      </Button>
    </div>
  );
}

function ScenarioPanel({ a }: { a: Extract<ActivityView, { type: "SCENARIO" }> }) {
  if (a.status === "PASSED") return <p className="mt-6 font-semibold text-aqua-ink">✓ You have completed this scenario.</p>;
  if (a.status === "SUBMITTED" || a.status === "UNDER_REVIEW") {
    return <div className="mt-6"><FormMessage tone="info">Your response has been received and is being assessed. There is nothing you need to do.</FormMessage></div>;
  }
  if (a.status === "FAILED") {
    return <div className="mt-6"><FormMessage tone="info">This activity is with our team. We will be in touch.</FormMessage></div>;
  }
  return <ScenarioRunner activityId={a.id} sessionMinutes={a.sessionMinutes} dayNumber={a.dayNumber} />;
}

export default function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useLoad<ActivityView>(`/programme/activities/${id}`);
  const [result, setResult] = useState<ActivityResult | null>(null);

  if (error) {
    return (
      <AppShell width="max-w-3xl">
        <FormMessage tone={error.code.startsWith("DAY_LOCKED") || error.code === "NOT_AVAILABLE_YET" ? "info" : "error"}>{error.message}</FormMessage>
        <Link href="/programme" className="mt-6 inline-block text-aqua-ink underline underline-offset-4">
          Back to the programme
        </Link>
      </AppShell>
    );
  }
  if (!data) return <AppShell><PageLoading /></AppShell>;

  const finish = (r: ActivityResult) => {
    setResult(r);
    reload();
  };

  return (
    <AppShell width="max-w-3xl">
      <Link href={`/programme/day/${data.dayNumber}`} className="text-sm text-aqua-ink underline underline-offset-4">
        Day {data.dayNumber}
      </Link>
      <h1 className="editorial mt-3 text-4xl font-semibold leading-tight text-nile">{data.title}</h1>

      {data.type === "LESSON" && <Lesson key={data.id} a={data} onDone={finish} />}
      {data.type === "REFLECTION" && <Reflection key={data.id} a={data} onDone={finish} />}
      {data.type === "QUIZ" && <Quiz key={data.id} a={data} onDone={finish} />}
      {data.type === "SCENARIO" && <ScenarioPanel a={data} />}

      {result && <Outcome result={result} dayNumber={data.dayNumber} />}
    </AppShell>
  );
}
