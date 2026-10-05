"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type Level, type PreferencesForm, type QuestionDef } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type Seek = Record<string, { accept: string[]; level: Level }>;

const LEVELS: { value: Level; title: string; hint: string }[] = [
  { value: "NON_NEGOTIABLE", title: "Non-negotiable", hint: "I could not marry someone outside these." },
  { value: "PREFERENCE", title: "Preference", hint: "I would like this, but I can compromise." },
  { value: "FLEXIBLE", title: "Flexible", hint: "Open to discussion." },
];

const STATUSES = [
  { value: "NEVER_MARRIED", label: "Never married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
];

const SCOPES = [
  { value: "ANYWHERE", label: "Anywhere" },
  { value: "SAME_COUNTRY", label: "In the same country as me" },
  { value: "SAME_REGION", label: "In the same state or region as me" },
];

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long" });

export default function PreferencesPage() {
  const { data, error, reload } = useLoad<PreferencesForm>("/preferences");
  const [self, setSelf] = useState<Record<string, string>>({});
  const [seek, setSeek] = useState<Seek>({});
  const [ageMin, setAgeMin] = useState("25");
  const [ageMax, setAgeMax] = useState("40");
  const [statuses, setStatuses] = useState<string[]>(["NEVER_MARRIED"]);
  const [scope, setScope] = useState("ANYWHERE");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // Fill the form once: from earlier answers if there are any, otherwise empty and deliberate.
  useEffect(() => {
    if (!data || ready) return;
    const a = data.answers;
    setSelf(a?.self ?? {});
    setSeek(Object.fromEntries(data.questions.map((q) => [q.key, { accept: a?.seek[q.key]?.accept ?? [], level: a?.seek[q.key]?.level ?? "PREFERENCE" }])));
    if (a?.filters) {
      setAgeMin(String(a.filters.ageMin));
      setAgeMax(String(a.filters.ageMax));
      setStatuses(a.filters.maritalStatuses);
      setScope(a.filters.locationScope);
    }
    setReady(true);
  }, [data, ready]);

  if (!data) return <AppShell width="max-w-3xl"><PageLoading error={error?.message} /></AppShell>;

  if (!data.eligible) {
    return (
      <AppShell width="max-w-3xl">
        <h1 className="text-3xl font-semibold text-nile">What you are seeking</h1>
        <div className="mt-6"><FormMessage tone="info">{data.ineligibleReason}</FormMessage></div>
        <Link href="/programme" className="mt-6 inline-block rounded-md bg-nile px-5 py-3 font-semibold text-white hover:bg-aqua">Go to the programme</Link>
      </AppShell>
    );
  }

  const locked = data.hasActiveMatch;
  const nonNegotiable = Object.values(seek).filter((s) => s.level === "NON_NEGOTIABLE").length;
  const overLimit = nonNegotiable > data.nonNegotiableMax;
  const resting = data.availableAfter && new Date(data.availableAfter).getTime() > Date.now();

  const toggle = (q: QuestionDef, value: string) =>
    setSeek((s) => {
      const has = s[q.key].accept.includes(value);
      return { ...s, [q.key]: { ...s[q.key], accept: has ? s[q.key].accept.filter((v) => v !== value) : [...s[q.key].accept, value] } };
    });

  async function save() {
    setBusy(true);
    setErrors({});
    setProblem(null);
    setSaved(false);
    try {
      await api("/preferences", {
        method: "PUT",
        body: { self, seek, filters: { ageMin: Number(ageMin), ageMax: Number(ageMax), maritalStatuses: statuses, locationScope: scope } },
      });
      setSaved(true);
      reload();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof ApiError && e.code === "FORM_INVALID") {
        const errs = (e.extra.errors ?? {}) as Record<string, string>;
        setErrors(errs);
        setProblem("A few answers need your attention. They are marked below.");
        const first = Object.keys(errs).find((k) => k !== "form" && k !== "filters") ?? (errs.filters ? "filters" : "top");
        document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else setProblem(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function setAvailability(availability: "AVAILABLE" | "PAUSED") {
    await api("/preferences/availability", { method: "PATCH", body: { availability } }).catch(() => undefined);
    reload();
  }

  return (
    <AppShell width="max-w-3xl">
      <h1 id="q-top" className="text-3xl font-semibold text-nile">What you are seeking</h1>
      <p className="editorial mt-3 text-lg text-nile/90">
        The month should have changed how you answer. Take your time. For each question, tell us about yourself, then which answers you would accept in a
        spouse and how firmly you feel. Keep &ldquo;non-negotiable&rdquo; for what you truly cannot live without.
      </p>

      {data.submittedAt && (
        <section className="mt-6 rounded-lg border border-border bg-white p-5">
          <h2 className="font-semibold text-nile">Your availability</h2>
          {resting ? (
            <p className="mt-2 text-text-muted">You are resting until {when(data.availableAfter!)}. You will not be matched before then.</p>
          ) : data.availability === "PAUSED" ? (
            <p className="mt-2 text-text-muted">You are paused and will not be matched.</p>
          ) : (
            <p className="mt-2 text-text-muted">You are available to be matched.</p>
          )}
          <Button variant="secondary" className="mt-3" onClick={() => setAvailability(data.availability === "PAUSED" ? "AVAILABLE" : "PAUSED")}>
            {data.availability === "PAUSED" ? "Become available again" : "Pause matching"}
          </Button>
        </section>
      )}

      {locked && (
        <div className="mt-6"><FormMessage tone="info">You have a current match, so your preferences are locked until that pairing is complete.</FormMessage></div>
      )}
      {saved && <div className="mt-6"><FormMessage tone="success">Saved. <Link href="/matches" className="font-semibold underline">See your matches</Link></FormMessage></div>}
      {problem && <div className="mt-6"><FormMessage tone="error">{problem}</FormMessage></div>}
      {errors.form && <div className="mt-3"><FormMessage tone="error">{errors.form}</FormMessage></div>}

      <div className={`sticky top-0 z-10 mt-6 rounded-md border px-4 py-2.5 text-sm ${overLimit ? "border-destructive/40 bg-[#fef3f2] text-[#912018]" : "border-border bg-white text-nile"}`} aria-live="polite">
        Non-negotiables: <strong>{nonNegotiable}</strong> of {data.nonNegotiableMax} allowed
      </div>

      <fieldset disabled={locked || busy} className="mt-8 space-y-12">
        {data.categories.map((c) => (
          <section key={c.key} aria-labelledby={`cat-${c.key}`}>
            <h2 id={`cat-${c.key}`} className="text-2xl font-semibold text-nile">{c.title}</h2>
            <p className="mt-1 text-text-muted">{c.intro}</p>
            <div className="mt-5 space-y-5">
              {data.questions.filter((q) => q.category === c.key).map((q) => {
                const cur = seek[q.key] ?? { accept: [], level: "PREFERENCE" as Level };
                return (
                  <div key={q.key} id={`q-${q.key}`} role="group" aria-labelledby={`${q.key}-prompt`} className={`rounded-lg border bg-white p-5 sm:p-6 ${errors[q.key] ? "border-destructive" : "border-border"}`}>
                    <p id={`${q.key}-prompt`} className="text-lg font-semibold text-nile">{q.prompt}</p>
                    <div className="mt-3 space-y-1.5">
                      {q.options.map((o) => (
                        <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-aqua-tint">
                          <input type="radio" name={`self-${q.key}`} checked={self[q.key] === o.value} onChange={() => setSelf((s) => ({ ...s, [q.key]: o.value }))} className="mt-1.5 h-4 w-4 accent-[#19687e]" />
                          <span className="text-nile">{o.label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-5 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-nile">{q.seekPrompt}</p>
                        <button
                          type="button"
                          className="text-sm text-aqua-ink underline underline-offset-4"
                          onClick={() => setSeek((s) => ({ ...s, [q.key]: { ...s[q.key], accept: cur.accept.length === q.options.length ? [] : q.options.map((o) => o.value) } }))}
                        >
                          {cur.accept.length === q.options.length ? "Clear" : "Select all"}
                        </button>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((o) => (
                          <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 hover:bg-aqua-tint">
                            <input type="checkbox" checked={cur.accept.includes(o.value)} onChange={() => toggle(q, o.value)} className="mt-1.5 h-4 w-4 accent-[#19687e]" />
                            <span className="text-nile">{o.label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="How firmly do you feel about this?">
                        {LEVELS.filter((l) => l.value !== "NON_NEGOTIABLE" || q.allowNonNegotiable).map((l) => (
                          <label key={l.value} title={l.hint} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${cur.level === l.value ? "border-nile bg-nile text-white" : "border-border bg-white text-nile hover:bg-aqua-tint"}`}>
                            <input type="radio" name={`level-${q.key}`} className="sr-only" checked={cur.level === l.value} onChange={() => setSeek((s) => ({ ...s, [q.key]: { ...s[q.key], level: l.value } }))} />
                            {l.title}
                          </label>
                        ))}
                      </div>
                      {!q.allowNonNegotiable && <p className="mt-2 text-sm text-text-muted">This can only be a preference or flexible.</p>}
                    </div>
                    {errors[q.key] && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{errors[q.key]}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section id="q-filters" aria-labelledby="filters-title" className={`rounded-lg border bg-white p-5 sm:p-6 ${errors.filters ? "border-destructive" : "border-border"}`}>
          <h2 id="filters-title" className="text-2xl font-semibold text-nile">Who we may introduce</h2>
          <p className="mt-1 text-text-muted">These are firm limits. We will not introduce anyone outside them.</p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="ageMin" className="block text-sm font-semibold text-nile">Youngest age</label>
              <input id="ageMin" type="number" inputMode="numeric" min={18} max={100} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className="mt-1.5 block w-full rounded-md border border-border px-3.5 py-2.5 text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise" />
            </div>
            <div>
              <label htmlFor="ageMax" className="block text-sm font-semibold text-nile">Oldest age</label>
              <input id="ageMax" type="number" inputMode="numeric" min={18} max={100} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className="mt-1.5 block w-full rounded-md border border-border px-3.5 py-2.5 text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise" />
            </div>
          </div>

          <div role="group" aria-labelledby="status-label" className="mt-5">
            <p id="status-label" className="text-sm font-semibold text-nile">Marital status you would accept</p>
            <div className="mt-2 space-y-1.5">
              {STATUSES.map((s) => (
                <label key={s.value} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-aqua-tint">
                  <input type="checkbox" checked={statuses.includes(s.value)} onChange={() => setStatuses((x) => (x.includes(s.value) ? x.filter((v) => v !== s.value) : [...x, s.value]))} className="h-4 w-4 accent-[#19687e]" />
                  <span className="text-nile">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div role="group" aria-labelledby="scope-label" className="mt-5">
            <p id="scope-label" className="text-sm font-semibold text-nile">Where should your spouse live?</p>
            <div className="mt-2 space-y-1.5">
              {SCOPES.map((s) => (
                <label key={s.value} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-aqua-tint">
                  <input type="radio" name="scope" checked={scope === s.value} onChange={() => setScope(s.value)} className="h-4 w-4 accent-[#19687e]" />
                  <span className="text-nile">{s.label}</span>
                </label>
              ))}
            </div>
            {scope !== "ANYWHERE" && (
              <p className="mt-2 text-sm text-text-muted">This uses the country and region on <Link href="/profile" className="text-aqua-ink underline">your profile</Link>.</p>
            )}
          </div>
          {errors.filters && <p role="alert" className="mt-4 text-sm font-medium text-destructive">{errors.filters}</p>}
        </section>
      </fieldset>

      {!locked && (
        <div className="mt-10">
          <Button onClick={save} disabled={busy || overLimit}>{busy ? "Saving..." : data.submittedAt ? "Save changes" : "Save my preferences"}</Button>
          <p className="mt-3 text-sm text-text-muted">Your answers are private. A match only ever sees what a stage needs them to see.</p>
        </div>
      )}
    </AppShell>
  );
}
