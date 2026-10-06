"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type CompatDetail } from "@/lib/api";
import { CLASS_LABEL, CLASS_STYLE, LEVEL_TITLE, REASON_LABEL, RESPONSE_LABEL } from "@/lib/flow-labels";
import { useLoad } from "@/lib/use-load";

const AREA: Record<string, string> = {
  religion: "Religion", family: "Family and in-laws", finance: "Money", parenting: "Children and parenting", career: "Work and study",
  household: "Home life", personality: "Character and communication", lifestyle: "Lifestyle", physical: "Physical",
};

export default function CompatibilityReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useLoad<CompatDetail>(`/admin/compatibility/${id}`);
  const [choice, setChoice] = useState<"PASS" | "CLOSE" | "">("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
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

  async function decide() {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/admin/compatibility/${id}/decision`, { body: { decision: choice, notes: notes.trim() || undefined } });
      router.push("/admin/reviews");
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Something went wrong.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <AppShell width="max-w-4xl">
      <Link href="/admin/reviews" className="text-sm text-aqua-ink underline underline-offset-4">All reviews</Link>
      <h1 className="mt-3 text-3xl font-semibold text-nile">A pairing to review</h1>
      <p className="editorial mt-3 text-lg text-nile/90">Judge the pairing, never the people. Names are hidden on purpose.</p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {data.reasons.map((r) => <li key={r} className="rounded-full border border-border bg-white px-3 py-1 text-sm text-nile">{REASON_LABEL[r] ?? r}</li>)}
      </ul>

      <dl className="mt-6 grid gap-3 sm:grid-cols-4">
        {([["Aligned", data.counts.aligned], ["Needs discussion", data.counts.needsDiscussion], ["Conflict", data.counts.conflict], ["Preferences disagreed with", data.counts.preferenceDisagreements]] as [string, number][]).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-4"><dt className="text-sm text-text-muted">{k}</dt><dd className="text-2xl font-semibold tabular-nums text-nile">{v}</dd></div>
        ))}
      </dl>
      <ul className="mt-4 flex flex-wrap gap-2">
        {data.categories.map((c) => <li key={c.category} className={`rounded-full border px-3 py-1 text-sm ${CLASS_STYLE[c.classification]}`}>{AREA[c.category] ?? c.category}: {CLASS_LABEL[c.classification]}</li>)}
      </ul>

      {["Person A", "Person B"].map((who) => (
        <section key={who} className="mt-8" aria-labelledby={`h-${who}`}>
          <h2 id={`h-${who}`} className="text-lg font-semibold text-nile">{who} wrote</h2>
          <ul className="mt-3 space-y-4">
            {data.items.filter((i) => i.author === who).map((i, n) => (
              <li key={n} className="rounded-lg border border-border bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-text-muted">{AREA[i.category] ?? i.category} · {LEVEL_TITLE[i.level]}</p>
                  <span className={`rounded-full border px-3 py-0.5 text-sm ${CLASS_STYLE[i.classification]}`}>{CLASS_LABEL[i.classification]}</span>
                </div>
                <p className="mt-2 font-semibold text-nile">{i.statement}</p>
                {i.compromiseNote && <p className="mt-1 text-sm text-text-muted">Could compromise on: {i.compromiseNote}</p>}
                {i.response && (
                  <p className="mt-3 text-sm text-nile/90">
                    <strong>The other person:</strong> {RESPONSE_LABEL[i.response.type]}
                    {i.response.explanation && <span className="mt-1 block text-text-muted">{i.response.explanation}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {data.decided ? (
        <div className="mt-8"><FormMessage tone="info">This has been decided ({data.passed ? "allowed to proceed" : "pairing closed"}).</FormMessage></div>
      ) : (
        <section className="mt-8 rounded-lg border border-border bg-white p-6">
          <h2 className="font-semibold text-nile">Your decision</h2>
          <fieldset className="mt-3 space-y-2">
            <legend className="sr-only">Decision</legend>
            {([
              ["PASS", "Let it proceed", "Both move to the next stage. Use this when the differences can be talked through."],
              ["CLOSE", "Close this pairing", "Permanent for these two. Both are told neutrally, and both stay available for other matches."],
            ] as const).map(([v, t, h]) => (
              <label key={v} className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 hover:bg-aqua-tint">
                <input type="radio" name="decision" checked={choice === v} onChange={() => { setChoice(v); setConfirming(false); }} className="mt-1.5 h-4 w-4 accent-[#19687e]" />
                <span><span className="block font-semibold text-nile">{t}</span><span className="block text-sm text-text-muted">{h}</span></span>
              </label>
            ))}
          </fieldset>
          <label htmlFor="notes" className="mt-4 block text-sm font-semibold text-nile">Notes for the record (never shown to either person)</label>
          <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5 block w-full rounded-md border border-border px-3.5 py-2.5 text-base text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise" />
          {problem && <div className="mt-4"><FormMessage tone="error">{problem}</FormMessage></div>}
          {!confirming ? (
            <Button className="mt-5" disabled={!choice || busy} onClick={() => (choice === "CLOSE" ? setConfirming(true) : decide())}>Record decision</Button>
          ) : (
            <div role="alertdialog" aria-label="Confirm closing" className="mt-5 rounded-md border border-border p-4">
              <p className="text-nile">Closing is permanent. These two will never be matched again.</p>
              <div className="mt-3 flex gap-3"><Button onClick={decide} disabled={busy}>{busy ? "Closing..." : "Yes, close it"}</Button><Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button></div>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
