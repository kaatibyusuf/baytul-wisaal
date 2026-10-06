"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type MatchesData, type PreferencesForm } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

const STATUS: Record<string, string> = { NEVER_MARRIED: "Never married", DIVORCED: "Divorced", WIDOWED: "Widowed" };
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

export default function MatchesPage() {
  const matches = useLoad<MatchesData>("/matches");
  const prefs = useLoad<PreferencesForm>("/preferences");
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [closedNote, setClosedNote] = useState<string | null>(null);

  if (!matches.data || !prefs.data) {
    return <AppShell width="max-w-3xl"><PageLoading error={matches.error?.message ?? prefs.error?.message} /></AppShell>;
  }
  const { current, history } = matches.data;
  const p = prefs.data;

  async function withdraw() {
    if (!current) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<{ availableAfter: string }>(`/matches/${current.id}/withdraw`, { body: reason.trim() ? { reason: reason.trim() } : {} });
      setClosedNote(`This pairing is closed. You will be available for new matches from ${day(r.availableAfter)}.`);
      setConfirming(false);
      setReason("");
      matches.reload();
      prefs.reload();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const resting = p.availableAfter && new Date(p.availableAfter).getTime() > Date.now();

  return (
    <AppShell width="max-w-3xl">
      <h1 className="text-3xl font-semibold text-nile">Your match</h1>
      {closedNote && <div className="mt-6"><FormMessage tone="info">{closedNote}</FormMessage></div>}

      {current ? (
        <section className="mt-8 rounded-lg border border-border bg-white p-6 sm:p-8" aria-labelledby="intro">
          <p className="text-sm text-text-muted">Introduced {day(current.createdAt)}</p>
          {current.introduction ? (
            <>
              <h2 id="intro" className="mt-1 text-2xl font-semibold text-nile">{current.introduction.name}</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  ["Age", String(current.introduction.age)],
                  ["Marital status", STATUS[current.introduction.maritalStatus] ?? current.introduction.maritalStatus],
                  ["Lives in", current.introduction.location],
                  ["Education", current.introduction.education],
                  ["Occupation", current.introduction.occupation],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-sm text-text-muted">{k}</dt>
                    <dd className="font-semibold text-nile">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <h2 id="intro" className="mt-1 text-2xl font-semibold text-nile">A match</h2>
          )}
          <div className="mt-6 rounded-md bg-surface p-4">
            <p className="text-sm font-semibold text-nile">What happens next</p>
            <p className="mt-1 text-text-muted">{current.whatNext}</p>
          </div>
          <p className="mt-4 text-sm text-text-muted">
            This is a deliberately short introduction. There is no photo at this stage, because we want you to think beyond appearance.
          </p>

          <Link
            href={`/matches/${current.id}`}
            className="mt-6 inline-block rounded-md bg-nile px-5 py-3 font-semibold text-white transition-colors hover:bg-aqua"
          >
            {{ EXPECTATIONS_PENDING: "Write what you are seeking", RESPONSE_PENDING: "Respond to their expectations", COMPATIBILITY_REVIEW: "See where things stand", NEXT_STAGE: "See how you compare" }[current.stage] ?? "Continue"}
          </Link>

          <div className="mt-6 border-t border-border pt-5">
            {!confirming ? (
              <Button variant="secondary" onClick={() => setConfirming(true)}>Close this pairing</Button>
            ) : (
              <div className="space-y-3" role="alertdialog" aria-labelledby="close-title">
                <p id="close-title" className="font-semibold text-nile">Close this pairing?</p>
                <p className="text-sm text-text-muted">
                  This cannot be undone, and you will not be introduced to each other again. They will be told only that the pairing is closed. You will
                  rest for a few days before being matched again.
                </p>
                <label htmlFor="reason" className="block text-sm font-semibold text-nile">Reason (optional, private, never shown to them)</label>
                <textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="block w-full rounded-md border border-border px-3.5 py-2.5 text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise" />
                {problem && <FormMessage tone="error">{problem}</FormMessage>}
                <div className="flex flex-wrap gap-3">
                  <Button onClick={withdraw} disabled={busy}>{busy ? "Closing..." : "Yes, close it"}</Button>
                  <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Keep it</Button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-lg border border-border bg-white p-6 sm:p-8">
          {!p.eligible ? (
            <>
              <p className="editorial text-lg text-nile/90">Matching opens once you have finished the programme.</p>
              <Link href="/programme" className="mt-4 inline-block font-semibold text-aqua-ink underline underline-offset-4">Go to the programme</Link>
            </>
          ) : !p.submittedAt ? (
            <>
              <p className="editorial text-lg text-nile/90">Tell us what you are seeking, and we will look for someone whose expectations fit yours.</p>
              <Link href="/preferences" className="mt-4 inline-block rounded-md bg-nile px-5 py-3 font-semibold text-white hover:bg-aqua">Complete your preferences</Link>
            </>
          ) : resting ? (
            <p className="editorial text-lg text-nile/90">You are resting until {day(p.availableAfter!)}. After that we will look for a new match.</p>
          ) : p.availability === "PAUSED" ? (
            <>
              <p className="editorial text-lg text-nile/90">You have paused matching.</p>
              <Link href="/preferences" className="mt-4 inline-block font-semibold text-aqua-ink underline underline-offset-4">Resume on the preferences page</Link>
            </>
          ) : (
            <p className="editorial text-lg text-nile/90">
              Your preferences are in and you are available. We will notify you as soon as we find someone whose expectations fit yours. There is nothing you need to do.
            </p>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10" aria-labelledby="history">
          <h2 id="history" className="text-lg font-semibold text-nile">Previous matches</h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-semibold text-nile">Introduced {day(h.createdAt)}</p>
                  <p className="text-sm text-text-muted">{h.note ?? "Closed"}</p>
                </div>
                <span className="text-sm text-text-muted">{h.closedAt ? `Closed ${day(h.closedAt)}` : ""}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-text-muted">Details of earlier matches are never kept visible, to protect everyone&rsquo;s privacy.</p>
        </section>
      )}
    </AppShell>
  );
}
