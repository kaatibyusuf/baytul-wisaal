"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProtectedContent } from "@/components/protected-content";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type AssessmentQuestion, type SessionState } from "@/lib/api";

const wordCount = (t: string) => (t.trim().match(/\S+/g) ?? []).length;
const draftKey = (id: string) => `bw-draft-${id}`;
const TOKEN_HEADER = "x-assessment-token";

type Phase = "intro" | "starting" | "active" | "submitting" | "submitted" | "expired";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Runs one protected scenario. The session token lives only in memory: reloading the page
 * asks the server for a new one, which also ends any other open copy of the assessment.
 */
export function ScenarioRunner({ activityId, sessionMinutes, dayNumber }: { activityId: string; sessionMinutes: number; dayNumber: number }) {
  const token = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [q, setQ] = useState<AssessmentQuestion | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [away, setAway] = useState(false);
  const [left, setLeft] = useState(0);
  const [state, setState] = useState<SessionState>("RECEIVED");

  const sessionId = q?.sessionId;
  const headers = () => ({ [TOKEN_HEADER]: token.current ?? "" });

  // Telemetry is best effort and never interrupts the person writing.
  const signal = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      if (!sessionId || !token.current) return;
      api(`/assessments/sessions/${sessionId}/events`, { body: { type, metadata }, headers: { [TOKEN_HEADER]: token.current } }).catch(() => undefined);
    },
    [sessionId],
  );

  async function start() {
    setPhase("starting");
    setError(null);
    try {
      const s = await api<{ sessionId: string; token: string; expiresAt: string }>("/assessments/sessions", { body: { activityId } });
      token.current = s.token;
      const question = await api<AssessmentQuestion>(`/assessments/sessions/${s.sessionId}`, { headers: { [TOKEN_HEADER]: s.token } });
      setQ(question);
      try {
        const saved = sessionStorage.getItem(draftKey(question.sessionId));
        if (saved) setAnswers(JSON.parse(saved));
      } catch {
        /* no draft */
      }
      setPhase("active");
    } catch (e) {
      setError(e instanceof ApiError ? { code: e.code, message: e.message } : { code: "ERROR", message: "Something went wrong." });
      setPhase("intro");
    }
  }

  // Keep a draft for this tab only, so a reload does not lose a long answer.
  useEffect(() => {
    if (phase !== "active" || !sessionId) return;
    try {
      sessionStorage.setItem(draftKey(sessionId), JSON.stringify(answers));
    } catch {
      /* storage unavailable */
    }
  }, [answers, phase, sessionId]);

  // Looking away: blur the scenario and note it for a person to consider (never treated as proof).
  useEffect(() => {
    if (phase !== "active") return;
    let hiddenAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        setAway(true);
      } else {
        if (hiddenAt) signal("TAB_SWITCH", { hiddenMs: Date.now() - hiddenAt });
        hiddenAt = 0;
        setAway(false);
      }
    };
    const onBlur = () => {
      setAway(true);
      if (!document.hidden) signal("WINDOW_BLUR");
    };
    const onFocus = () => setAway(false);
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        signal("SCREEN_CAPTURE_SIGNAL");
        navigator.clipboard?.writeText(" ").catch(() => undefined);
        setAway(true);
        timer = setTimeout(() => setAway(false), 1500);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["p", "s"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onBeforePrint = () => setAway(true);
    const onAfterPrint = () => setAway(false);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      if (timer) clearTimeout(timer);
    };
  }, [phase, signal]);

  // Countdown. The server enforces the real deadline.
  useEffect(() => {
    if (phase !== "active" || !q) return;
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(q.expiresAt).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setPhase("expired");
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, q]);

  // After submitting, watch progress.
  useEffect(() => {
    if (phase !== "submitted" || !sessionId) return;
    let stop = false;
    const poll = () =>
      api<{ state: SessionState }>(`/assessments/sessions/${sessionId}/status`)
        .then((r) => {
          if (stop) return;
          setState(r.state);
          if (r.state === "COMPLETE" || r.state === "IN_REVIEW") stop = true;
        })
        .catch(() => undefined);
    poll();
    const t = setInterval(() => !stop && poll(), 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [phase, sessionId]);

  async function submit() {
    if (!q) return;
    setPhase("submitting");
    setError(null);
    setErrors({});
    try {
      await api(`/assessments/sessions/${q.sessionId}/submit`, { body: { parts: answers }, headers: headers() });
      try {
        sessionStorage.removeItem(draftKey(q.sessionId));
      } catch {
        /* nothing to clear */
      }
      setPhase("submitted");
    } catch (e) {
      setPhase("active");
      if (e instanceof ApiError) {
        if (e.code === "ANSWER_INVALID") setErrors((e.extra.errors as Record<string, string>) ?? {});
        if (e.code === "SESSION_EXPIRED") return setPhase("expired");
        setError({ code: e.code, message: e.message });
      } else setError({ code: "ERROR", message: "Something went wrong." });
    }
  }

  // ───────────────────────── Screens ─────────────────────────

  if (phase === "intro" || phase === "starting") {
    return (
      <div className="mt-6 space-y-6">
        <div className="rounded-lg border border-border bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-nile">Before you begin</h2>
          <ul className="editorial mt-4 list-disc space-y-2 pl-5 text-lg text-nile/90">
            <li>You have {sessionMinutes} minutes once you start.</li>
            <li>You will make a real decision and explain it. Answers like &ldquo;it depends&rdquo; are not accepted on their own.</li>
            <li>Write in your own words. The scenario cannot be copied or printed, and each session is marked with a code.</li>
            <li>Switching to another tab or window is noted for a person to consider. It is not treated as proof of anything.</li>
            <li>If you reload the page, press the button again to continue where you were.</li>
          </ul>
        </div>
        {error && <FormMessage tone="error">{error.message}</FormMessage>}
        <Button onClick={start} disabled={phase === "starting"}>
          {phase === "starting" ? "Opening..." : "Start or continue"}
        </Button>
      </div>
    );
  }

  if (phase === "expired") {
    return (
      <div className="mt-6 space-y-4">
        <FormMessage tone="info">The time for this assessment has ended. Nothing you wrote has been submitted.</FormMessage>
        <p className="text-sm text-text-muted">You may be able to try once more. Press the button to see.</p>
        <Button variant="secondary" onClick={() => { setAnswers({}); setPhase("intro"); }}>
          Back
        </Button>
      </div>
    );
  }

  if (phase === "submitted") {
    return (
      <div className="mt-6 space-y-4">
        {state === "COMPLETE" ? (
          <FormMessage tone="success">Your response has been assessed and this activity is complete.</FormMessage>
        ) : state === "IN_REVIEW" ? (
          <FormMessage tone="info">A member of our team will look at your response. There is nothing you need to do.</FormMessage>
        ) : (
          <FormMessage tone="info">We have received your response and are assessing it. This usually takes a minute. You can leave this page.</FormMessage>
        )}
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

  // active or submitting
  if (!q) return null;
  const ready = q.parts.every((p) => wordCount(answers[p.key] ?? "") >= p.minWords);
  const busy = phase === "submitting";

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between text-sm" aria-live="off">
        <span className="text-text-muted">Time left</span>
        <span className={`font-semibold tabular-nums ${left < 300 ? "text-destructive" : "text-nile"}`}>{clock(left)}</span>
      </div>

      <ProtectedContent watermark={q.watermark} away={away}>
        <h2 className="text-xl font-semibold text-nile">{q.title}</h2>
        <p className="editorial mt-4 text-lg leading-relaxed text-nile/95">{q.text}</p>
        {q.instructions && <p className="mt-4 text-sm font-semibold text-aqua-ink">{q.instructions}</p>}
      </ProtectedContent>

      {error && (
        <FormMessage tone="error">
          {error.message}
          {error.code === "INVALID_ASSESSMENT_TOKEN" && (
            <span className="mt-2 block">
              <button type="button" onClick={start} className="font-semibold underline underline-offset-4">
                Continue here
              </button>
            </span>
          )}
        </FormMessage>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-6"
        noValidate
      >
        {q.parts.map((p, i) => {
          const text = answers[p.key] ?? "";
          const words = wordCount(text);
          const id = `part-${p.key}`;
          return (
            <div key={p.key} className="rounded-lg border border-border bg-white p-5 sm:p-6">
              <label htmlFor={id} className="block font-semibold text-nile">
                {i + 1}. {p.label}
              </label>
              <textarea
                id={id}
                value={text}
                rows={5}
                disabled={busy}
                aria-invalid={errors[p.key] ? true : undefined}
                aria-describedby={`${id}-info`}
                onChange={(e) => setAnswers((a) => ({ ...a, [p.key]: e.target.value }))}
                onPaste={(e) => {
                  // Paste is allowed (assistive tools use it) but noted. Only its size is recorded, never its content.
                  const pasted = e.clipboardData.getData("text").length;
                  if (pasted > 120) signal("LARGE_PASTE", { length: pasted, field: p.key });
                }}
                className="mt-2 block w-full rounded-md border border-border px-3.5 py-2.5 text-base leading-relaxed text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise aria-[invalid=true]:border-destructive"
              />
              <p id={`${id}-info`} className={`mt-1.5 text-sm ${errors[p.key] ? "font-medium text-destructive" : "text-text-muted"}`}>
                {errors[p.key] ?? `${words} words. At least ${p.minWords} needed.`}
              </p>
            </div>
          );
        })}
        <Button type="submit" disabled={busy || !ready}>
          {busy ? "Submitting..." : "Submit my response"}
        </Button>
        <p className="text-sm text-text-muted">You cannot change your response after submitting.</p>
      </form>
    </div>
  );
}
