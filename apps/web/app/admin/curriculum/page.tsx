"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { input } from "@/components/admin-ui";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type ImportSummary } from "@/lib/api";

type Problem = { path: string; message: string };

export default function CurriculumPage() {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  function fail(e: unknown) {
    if (e instanceof ApiError) {
      if (e.status === 403) return setForbidden(true);
      setProblems((e.extra.problems as Problem[]) ?? []);
      setNotice({ tone: "error", text: e.message });
    } else setNotice({ tone: "error", text: "Something went wrong." });
  }

  function parse(): unknown | undefined {
    try {
      return JSON.parse(text);
    } catch (e) {
      setProblems([]);
      setNotice({ tone: "error", text: `This is not valid JSON: ${(e as Error).message}` });
      return undefined;
    }
  }

  async function run(dryRun: boolean) {
    const curriculum = parse();
    if (curriculum === undefined) return;
    setBusy(true);
    setNotice(null);
    setProblems([]);
    try {
      const s = await api<ImportSummary>("/admin/programme/import", { body: { curriculum, dryRun } });
      setSummary(s);
      if (dryRun) {
        setChecked(text);
        setNotice({ tone: "info", text: "The file is valid. Nothing has been written yet. Review the summary, then import." });
      } else {
        setChecked(null);
        setNotice({ tone: "success", text: "Imported. The programme now reflects this file." });
      }
    } catch (e) {
      setSummary(null);
      setChecked(null);
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setNotice(null);
    try {
      const data = await api("/admin/programme/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "curriculum.json" });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotice({ tone: "info", text: "There is no programme to export yet." });
      else fail(e);
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 4_000_000) return setNotice({ tone: "error", text: "That file is too large." });
    setText(await f.text());
    setChecked(null);
    setSummary(null);
    setProblems([]);
    setNotice(null);
  }

  if (forbidden) return <AppShell><FormMessage tone="info">This area is for administrators.</FormMessage></AppShell>;
  const ready = checked !== null && checked === text;

  return (
    <AppShell width="max-w-4xl">
      <h1 className="text-3xl font-semibold text-nile">Curriculum</h1>
      <p className="editorial mt-3 text-lg text-nile/90">
        Load the 30-day programme from a file. It is checked first and nothing is written until you confirm. Nothing is ever deleted: anything missing from the file stays as it was.
      </p>

      <section className="mt-8 rounded-lg border border-border bg-white p-5" aria-labelledby="export">
        <h2 id="export" className="font-semibold text-nile">What is there now</h2>
        <p className="mt-1 text-sm text-text-muted">Download the current programme in the same format. Edit it and load it back to change it.</p>
        <Button variant="secondary" className="mt-3" onClick={download}>Download current curriculum</Button>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-white p-5" aria-labelledby="load">
        <h2 id="load" className="font-semibold text-nile">Load a curriculum</h2>
        <label className="mt-3 block text-sm font-semibold text-nile">Choose a .json file
          <input type="file" accept=".json,application/json" onChange={(e) => onFile(e.target.files?.[0])} className="mt-1.5 block w-full text-sm text-nile" />
        </label>
        <label className="mt-4 block text-sm font-semibold text-nile">Or paste it here
          <textarea rows={12} value={text} onChange={(e) => { setText(e.target.value); setChecked(null); }} spellCheck={false} className={`${input} font-mono text-sm`} />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => run(true)} disabled={!text.trim() || busy}>{busy ? "Checking..." : "Check it"}</Button>
          <Button variant="secondary" onClick={() => run(false)} disabled={!ready || busy}>Import</Button>
        </div>
        {!ready && summary === null && text.trim() && <p className="mt-2 text-sm text-text-muted">Check the file first. Import unlocks once it passes.</p>}
      </section>

      {notice && <div className="mt-6"><FormMessage tone={notice.tone}>{notice.text}</FormMessage></div>}

      {problems.length > 0 && (
        <section className="mt-6 rounded-lg border border-destructive/40 bg-[#fef3f2] p-5" aria-labelledby="problems">
          <h2 id="problems" className="font-semibold text-[#912018]">{problems.length} problem{problems.length === 1 ? "" : "s"} to fix</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#912018]">
            {problems.map((p, i) => <li key={i}><code className="rounded bg-white px-1.5 py-0.5">{p.path}</code> {p.message}</li>)}
          </ul>
          <p className="mt-3 text-xs text-[#912018]">Fix these and check again. Deeper checks only appear once the structure is right.</p>
        </section>
      )}

      {summary && (
        <section className="mt-6 rounded-lg border border-border bg-white p-5" aria-labelledby="summary" aria-live="polite">
          <h2 id="summary" className="font-semibold text-nile">{summary.dryRun ? "What would change" : "What changed"}</h2>
          <p className="mt-1 text-sm text-text-muted">Programme: {summary.programme}</p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            {([
              ["Days", `${summary.days.created} new, ${summary.days.updated} changed, ${summary.days.unchanged} the same`],
              ["Activities", `${summary.activities.created} new, ${summary.activities.updated} changed, ${summary.activities.unchanged} the same`],
              ["Scenarios", `${summary.scenarios.created} new, ${summary.scenarios.newVersion} new version, ${summary.scenarios.unchanged} the same`],
            ] as [string, string][]).map(([k, v]) => <div key={k}><dt className="text-text-muted">{k}</dt><dd className="font-semibold text-nile">{v}</dd></div>)}
          </dl>
          {summary.warnings.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-nile">Worth knowing</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-nile/90">{summary.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
