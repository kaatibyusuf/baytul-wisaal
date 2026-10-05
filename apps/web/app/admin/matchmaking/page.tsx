"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, FormMessage, TextField } from "@/components/ui";
import { ApiError, api, type RunResult } from "@/lib/api";

const REASONS: Record<string, string> = {
  SAME_GENDER: "Same sex",
  FILTER_AGE: "Outside someone's age range",
  FILTER_MARITAL_STATUS: "Marital status not accepted",
  FILTER_LOCATION: "Location filter not met",
  NON_NEGOTIABLE: "A non-negotiable was not met",
};

export default function MatchmakingAdminPage() {
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [ex, setEx] = useState({ emailA: "", emailB: "", reason: "" });
  const [exMsg, setExMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      setResult(await api<RunResult>("/admin/matchmaking/run", { body: { dryRun } }));
      setConfirm(false);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "ERROR", "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  async function exclude() {
    setExMsg(null);
    try {
      const r = await api<{ closedActiveMatch: boolean }>("/admin/matchmaking/exclusions", {
        body: { emailA: ex.emailA.trim(), emailB: ex.emailB.trim(), ...(ex.reason.trim() ? { reason: ex.reason.trim() } : {}) },
      });
      setExMsg({ tone: "success", text: r.closedActiveMatch ? "These two will never be matched. Their current pairing has been closed." : "These two will never be matched." });
      setEx({ emailA: "", emailB: "", reason: "" });
    } catch (e) {
      setExMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Something went wrong." });
    }
  }

  if (error?.status === 403) {
    return <AppShell><FormMessage tone="info">This page is for administrators.</FormMessage></AppShell>;
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold text-nile">Matchmaking</h1>
      <p className="editorial mt-3 text-lg text-nile/90">Preview a round first. Nothing is created until you confirm.</p>

      {error && <div className="mt-6"><FormMessage tone="error">{error.message}</FormMessage></div>}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => run(true)} disabled={busy}>{busy ? "Working..." : "Preview a round"}</Button>
        {result?.dryRun && result.proposed.length > 0 && !confirm && (
          <Button variant="secondary" onClick={() => setConfirm(true)} disabled={busy}>Create these {result.proposed.length} matches</Button>
        )}
      </div>

      {confirm && (
        <div className="mt-4 rounded-md border border-border bg-white p-4" role="alertdialog" aria-label="Confirm">
          <p className="text-nile">This creates real matches and notifies the people involved. It cannot be undone.</p>
          <div className="mt-3 flex gap-3">
            <Button onClick={() => run(false)} disabled={busy}>Yes, create them</Button>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {result && (
        <section className="mt-8 rounded-lg border border-border bg-white p-6" aria-live="polite">
          <h2 className="font-semibold text-nile">{result.dryRun ? "Preview" : `Created ${result.created} match${result.created === 1 ? "" : "es"}`}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            {([
              ["People waiting", result.stats.candidates],
              ["Pairs considered", result.stats.pairsConsidered],
              ["Pairs that fit", result.stats.eligiblePairs],
              ["Blocked or closed", result.stats.excluded],
              ["Below the minimum fit", result.stats.belowMinimumScore],
              ["Left unmatched", result.stats.unmatched],
            ] as [string, number][]).map(([k, v]) => (
              <div key={k}><dt className="text-text-muted">{k}</dt><dd className="text-xl font-semibold tabular-nums text-nile">{v}</dd></div>
            ))}
          </dl>
          {Object.keys(result.stats.rejected).length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-nile">Why other pairs were ruled out</h3>
              <ul className="mt-2 space-y-1 text-sm text-nile/90">
                {Object.entries(result.stats.rejected).map(([k, v]) => <li key={k}>{REASONS[k] ?? k}: {v}</li>)}
              </ul>
            </div>
          )}
          {result.dryRun && result.proposed.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-nile">Proposed pairs</h3>
              <ul className="mt-2 divide-y divide-border text-sm">
                {result.proposed.map((p, i) => (
                  <li key={i} className="flex justify-between py-2 text-nile"><span>{p.a} and {p.b}</span><span className="tabular-nums text-text-muted">fit {Math.round(p.score * 100)}%</span></li>
                ))}
              </ul>
            </div>
          )}
          {result.dryRun && result.proposed.length === 0 && <p className="mt-5 text-text-muted">No pairs would be created right now.</p>}
        </section>
      )}

      <section className="mt-10 rounded-lg border border-border bg-white p-6" aria-labelledby="ex-title">
        <h2 id="ex-title" className="font-semibold text-nile">Prevent a pairing</h2>
        <p className="mt-1 text-sm text-text-muted">Two people who must never be introduced (for example, they know each other). If they are currently matched, that pairing is closed.</p>
        <div className="mt-4 space-y-4">
          <TextField label="First person's email" type="email" value={ex.emailA} onChange={(e) => setEx({ ...ex, emailA: e.target.value })} />
          <TextField label="Second person's email" type="email" value={ex.emailB} onChange={(e) => setEx({ ...ex, emailB: e.target.value })} />
          <TextField label="Reason (recorded in the audit log)" value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} />
          {exMsg && <FormMessage tone={exMsg.tone}>{exMsg.text}</FormMessage>}
          <Button onClick={exclude} disabled={!ex.emailA || !ex.emailB}>Prevent this pairing</Button>
        </div>
      </section>
    </AppShell>
  );
}
