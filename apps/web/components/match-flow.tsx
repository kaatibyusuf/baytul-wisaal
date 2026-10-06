"use client";

import { useState } from "react";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type FlowView, type Level, type ResponseType } from "@/lib/api";
import { CLASS_LABEL, CLASS_STYLE, LEVEL_HINT, LEVEL_TITLE, RESPONSE_LABEL, wordCount } from "@/lib/flow-labels";

const area =
  "mt-1.5 block w-full rounded-md border border-border bg-white px-3.5 py-2.5 text-base text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise aria-[invalid=true]:border-destructive";

const STEPS = [
  ["EXPECTATIONS_PENDING", "Your expectations"],
  ["RESPONSE_PENDING", "Responses"],
  ["COMPATIBILITY_REVIEW", "Comparison"],
  ["NEXT_STAGE", "Next stage"],
] as const;

export function Stepper({ stage }: { stage: FlowView["stage"] }) {
  const at = STEPS.findIndex(([k]) => k === stage);
  return (
    <ol className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Progress">
      {STEPS.map(([k, label], i) => (
        <li
          key={k}
          aria-current={i === at ? "step" : undefined}
          className={`rounded-full border px-4 py-1.5 ${i < at ? "border-nile bg-nile text-white" : i === at ? "border-turquoise bg-turquoise font-semibold text-nile" : "border-border bg-white text-text-muted"}`}
        >
          {i < at ? "✓ " : ""}
          {label}
        </li>
      ))}
    </ol>
  );
}

// ───────────────────────── Writing expectations ─────────────────────────

type Row = { category: string; statement: string; level: Level; compromiseNote: string };
const blank = (): Row => ({ category: "religion", statement: "", level: "PREFERENCE", compromiseNote: "" });

export function ExpectationEditor({ view, onChange }: { view: FlowView; onChange: () => void }) {
  const rules = view.rules!;
  const [rows, setRows] = useState<Row[]>(() =>
    view.myExpectations?.length
      ? view.myExpectations.map((e) => ({ category: e.category, statement: e.statement, level: e.level, compromiseNote: e.compromiseNote ?? "" }))
      : [blank(), blank(), blank()],
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const filled = rows.map((r, i) => ({ r, i })).filter((x) => x.r.statement.trim());
  const nn = filled.filter((x) => x.r.level === "NON_NEGOTIABLE").length;
  const physical = filled.filter((x) => x.r.category === "physical").length;
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  async function save(submit: boolean) {
    setBusy(true);
    setErrors({});
    setFormError(null);
    setNotice(null);
    try {
      await api(`/matches/${view.matchId}/expectations`, {
        method: "PUT",
        body: { submit, items: filled.map((x) => ({ category: x.r.category, statement: x.r.statement, level: x.r.level, compromiseNote: x.r.compromiseNote })) },
      });
      setConfirming(false);
      if (submit) onChange();
      else setNotice("Draft saved. You can come back to it any time.");
    } catch (e) {
      setConfirming(false);
      if (e instanceof ApiError && e.code === "FORM_INVALID") {
        const errs = (e.extra.errors ?? {}) as Record<string, string>;
        const byRow: Record<number, string> = {};
        for (const [k, msg] of Object.entries(errs)) {
          const m = /^item(\d+)$/.exec(k);
          if (m) byRow[filled[Number(m[1])]?.i ?? Number(m[1])] = msg;
        }
        setErrors(byRow);
        setFormError(errs.form ?? "A few expectations need your attention. They are marked below.");
      } else setFormError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="editorial text-lg text-nile/90">
        What exactly are you seeking in a spouse? Write each expectation as a sentence the other person can respond to, and say how firmly you hold it.
        Neither of you will see the other&rsquo;s until you have both submitted.
      </p>

      <div className="sticky top-0 z-10 flex flex-wrap gap-x-6 gap-y-1 rounded-md border border-border bg-white px-4 py-2.5 text-sm text-nile" aria-live="polite">
        <span>Written: <strong>{filled.length}</strong> (need {rules.minItems} to {rules.maxItems})</span>
        <span className={nn > rules.maxNonNegotiable ? "font-semibold text-destructive" : ""}>Non-negotiable: <strong>{nn}</strong> of {rules.maxNonNegotiable}</span>
        <span className={physical > rules.maxPhysicalItems ? "font-semibold text-destructive" : ""}>Physical: <strong>{physical}</strong> of {rules.maxPhysicalItems}</span>
      </div>

      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      <fieldset disabled={busy} className="space-y-5">
        {rows.map((r, i) => {
          const cat = rules.categories.find((c) => c.key === r.category);
          const levels = rules.levels.filter((l) => !(l === "NON_NEGOTIABLE" && r.category === "physical"));
          return (
            <div key={i} className={`rounded-lg border bg-white p-5 sm:p-6 ${errors[i] ? "border-destructive" : "border-border"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <label htmlFor={`cat-${i}`} className="block text-sm font-semibold text-nile">Area</label>
                  <select
                    id={`cat-${i}`}
                    value={r.category}
                    onChange={(e) => update(i, { category: e.target.value, level: e.target.value === "physical" && r.level === "NON_NEGOTIABLE" ? "PREFERENCE" : r.level })}
                    className={area}
                  >
                    {rules.categories.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
                  </select>
                </div>
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} className="mt-7 text-sm text-text-muted underline underline-offset-4 hover:text-nile">
                    Remove
                  </button>
                )}
              </div>
              <label htmlFor={`st-${i}`} className="mt-4 block text-sm font-semibold text-nile">What are you seeking?</label>
              <textarea
                id={`st-${i}`}
                rows={2}
                value={r.statement}
                placeholder={cat?.example}
                aria-invalid={errors[i] ? true : undefined}
                aria-describedby={errors[i] ? `err-${i}` : undefined}
                onChange={(e) => update(i, { statement: e.target.value })}
                className={area}
              />
              <p className="mt-1 text-sm text-text-muted">{cat?.hint}</p>

              <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="How firmly do you hold this?">
                {levels.map((l) => (
                  <label key={l} title={LEVEL_HINT[l]} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm ${r.level === l ? "border-nile bg-nile text-white" : "border-border bg-white text-nile hover:bg-aqua-tint"}`}>
                    <input type="radio" className="sr-only" name={`lv-${i}`} checked={r.level === l} onChange={() => update(i, { level: l })} />
                    {LEVEL_TITLE[l]}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-sm text-text-muted">{LEVEL_HINT[r.level]}</p>

              {r.level !== "NON_NEGOTIABLE" && (
                <div className="mt-4">
                  <label htmlFor={`cn-${i}`} className="block text-sm font-semibold text-nile">What could you compromise on? (optional)</label>
                  <input id={`cn-${i}`} value={r.compromiseNote} onChange={(e) => update(i, { compromiseNote: e.target.value })} className={area} />
                </div>
              )}
              {errors[i] && <p id={`err-${i}`} role="alert" className="mt-3 text-sm font-medium text-destructive">{errors[i]}</p>}
            </div>
          );
        })}
      </fieldset>

      {rows.length < rules.maxItems && (
        <Button variant="secondary" onClick={() => setRows((rs) => [...rs, blank()])} disabled={busy}>Add another expectation</Button>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Button variant="secondary" onClick={() => save(false)} disabled={busy}>Save draft</Button>
        {!confirming && <Button onClick={() => setConfirming(true)} disabled={busy}>Submit</Button>}
      </div>
      {confirming && (
        <div role="alertdialog" aria-labelledby="confirm-title" className="rounded-md border border-border bg-white p-4">
          <p id="confirm-title" className="font-semibold text-nile">Submit your expectations?</p>
          <p className="mt-1 text-sm text-text-muted">You cannot change them afterwards. Take a moment to read them through once more.</p>
          <div className="mt-3 flex gap-3">
            <Button onClick={() => save(true)} disabled={busy}>{busy ? "Submitting..." : "Yes, submit"}</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Keep editing</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Responding ─────────────────────────

type Answer = { type: ResponseType | ""; explanation: string };

export function ResponseEditor({ view, onChange }: { view: FlowView; onChange: () => void }) {
  const rules = view.rules!;
  const items = view.theirExpectations ?? [];
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { type: i.myResponse?.type ?? "", explanation: i.myResponse?.explanation ?? "" }])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const set = (id: string, patch: Partial<Answer>) => setAnswers((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
  const answered = items.filter((i) => answers[i.id]?.type).length;

  async function save(submit: boolean) {
    setBusy(true);
    setErrors({});
    setFormError(null);
    setNotice(null);
    try {
      await api(`/matches/${view.matchId}/responses`, {
        method: "PUT",
        body: {
          submit,
          responses: items.filter((i) => answers[i.id]?.type).map((i) => ({ itemId: i.id, type: answers[i.id].type, explanation: answers[i.id].explanation })),
        },
      });
      setConfirming(false);
      if (submit) onChange();
      else setNotice("Draft saved. You can come back to it any time.");
    } catch (e) {
      setConfirming(false);
      if (e instanceof ApiError && e.code === "FORM_INVALID") {
        const errs = (e.extra.errors ?? {}) as Record<string, string>;
        setErrors(errs);
        setFormError(errs.form ?? "A few responses need your attention. They are marked below.");
      } else setFormError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="editorial text-lg text-nile/90">
        Here is what the other person is seeking. Respond to every point and explain your position in your own words. A simple &ldquo;yes&rdquo; is not enough,
        because it tells them nothing.
      </p>
      <div className="rounded-md border border-border bg-white px-4 py-2.5 text-sm text-nile" aria-live="polite">
        Answered: <strong>{answered}</strong> of {items.length}
      </div>
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      <fieldset disabled={busy} className="space-y-5">
        {items.map((it, n) => {
          const a = answers[it.id] ?? { type: "", explanation: "" };
          const cat = rules.categories.find((c) => c.key === it.category);
          const needsText = a.type !== "" && a.type !== "NOT_APPLICABLE";
          return (
            <div key={it.id} id={`item-${it.id}`} className={`rounded-lg border bg-white p-5 sm:p-6 ${errors[it.id] ? "border-destructive" : "border-border"}`}>
              <p className="text-sm text-text-muted">{n + 1}. {cat?.title}</p>
              <p className="mt-1 text-lg font-semibold text-nile">{it.statement}</p>
              <p className="mt-2 text-sm">
                <span className="rounded-full border border-border px-3 py-0.5 text-nile">{LEVEL_TITLE[it.level]}</span>
                {it.compromiseNote && <span className="ml-3 text-text-muted">They could compromise on: {it.compromiseNote}</span>}
              </p>
              <div className="mt-4 space-y-1" role="radiogroup" aria-label={`Your response to: ${it.statement}`}>
                {rules.responseTypes.map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-aqua-tint">
                    <input type="radio" name={`r-${it.id}`} checked={a.type === t} onChange={() => set(it.id, { type: t })} className="h-4 w-4 accent-[#19687e]" />
                    <span className="text-nile">{RESPONSE_LABEL[t]}</span>
                  </label>
                ))}
              </div>
              {needsText && (
                <div className="mt-4">
                  <label htmlFor={`ex-${it.id}`} className="block text-sm font-semibold text-nile">Explain your position</label>
                  <textarea
                    id={`ex-${it.id}`}
                    rows={3}
                    value={a.explanation}
                    aria-invalid={errors[it.id] ? true : undefined}
                    onChange={(e) => set(it.id, { explanation: e.target.value })}
                    className={area}
                  />
                  <p className="mt-1 text-sm text-text-muted">{wordCount(a.explanation)} words. At least {rules.minExplanationWords} needed.</p>
                </div>
              )}
              {errors[it.id] && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{errors[it.id]}</p>}
            </div>
          );
        })}
      </fieldset>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Button variant="secondary" onClick={() => save(false)} disabled={busy}>Save draft</Button>
        {!confirming && <Button onClick={() => setConfirming(true)} disabled={busy}>Submit my responses</Button>}
      </div>
      {confirming && (
        <div role="alertdialog" aria-labelledby="confirm-r" className="rounded-md border border-border bg-white p-4">
          <p id="confirm-r" className="font-semibold text-nile">Submit your responses?</p>
          <p className="mt-1 text-sm text-text-muted">You cannot change them afterwards. They stay private until both of you have responded.</p>
          <div className="mt-3 flex gap-3">
            <Button onClick={() => save(true)} disabled={busy}>{busy ? "Submitting..." : "Yes, submit"}</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Keep editing</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── The result ─────────────────────────

export function ResultView({ view }: { view: FlowView }) {
  const r = view.result;
  const cats = view.rules?.categories ?? [];
  if (!r) return null;
  const title = (k: string) => cats.find((c) => c.key === k)?.title ?? k;

  const group = (direction: "YOURS" | "THEIRS", heading: string, respLabel: string) => (
    <section aria-labelledby={`h-${direction}`} className="mt-8">
      <h3 id={`h-${direction}`} className="text-lg font-semibold text-nile">{heading}</h3>
      <ul className="mt-3 space-y-4">
        {r.items.filter((i) => i.direction === direction).map((i, n) => (
          <li key={n} className="rounded-lg border border-border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-muted">{title(i.category)} · {LEVEL_TITLE[i.level]}</p>
              <span className={`rounded-full border px-3 py-0.5 text-sm ${CLASS_STYLE[i.classification]}`}>{CLASS_LABEL[i.classification]}</span>
            </div>
            <p className="mt-2 font-semibold text-nile">{i.statement}</p>
            {i.response && (
              <p className="mt-3 text-sm text-nile/90">
                <strong>{respLabel}:</strong> {RESPONSE_LABEL[i.response.type]}
                {i.response.explanation && <span className="mt-1 block text-text-muted">{i.response.explanation}</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="mt-8">
      <div className="milestone rounded-lg p-5">
        <p className="font-semibold">Your expectations are compatible enough to move forward.</p>
        <p className="mt-1 text-sm">Where you differ, the next conversation is the place to talk it through. The later steps open in a future release.</p>
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {([["Aligned", r.counts.aligned], ["Needs discussion", r.counts.needsDiscussion], ["Conflict", r.counts.conflict]] as [string, number][]).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-4">
            <dt className="text-sm text-text-muted">{k}</dt>
            <dd className="text-2xl font-semibold tabular-nums text-nile">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-5 flex flex-wrap gap-2">
        {r.categories.map((c) => (
          <li key={c.category} className={`rounded-full border px-3 py-1 text-sm ${CLASS_STYLE[c.classification]}`}>{title(c.category)}: {CLASS_LABEL[c.classification]}</li>
        ))}
      </ul>
      {group("YOURS", "What you asked for", "Their response")}
      {group("THEIRS", "What they asked for", "Your response")}
    </div>
  );
}
