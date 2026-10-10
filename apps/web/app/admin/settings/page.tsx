"use client";

import { useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { input } from "@/components/admin-ui";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api, type SettingItem } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

function Row({ s, onSaved }: { s: SettingItem; onSaved: () => void }) {
  const [value, setValue] = useState(String(s.value));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const changed = Number(value) !== s.value && value.trim() !== "";

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/admin/settings/${s.key}`, { method: "PUT", body: { value: Number(value), reason: reason.trim() } });
      setMsg({ tone: "success", text: "Saved. It applies straight away." });
      setReason("");
      setConfirming(false);
      onSaved();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Something went wrong." });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <p className="font-semibold text-nile">{s.label}</p>
          {s.description && <p className="mt-1 text-sm text-text-muted">{s.description}</p>}
          <p className="mt-1 text-xs text-text-muted">Allowed {s.min} to {s.max}{s.integer ? ", whole numbers" : ""}. Normal value {s.default}.{s.isDefault ? "" : " Currently changed."}</p>
        </div>
        <div className="w-32">
          {s.boolean ? (
            <select aria-label={s.label} value={value} onChange={(e) => setValue(e.target.value)} className={input}>
              <option value="1">On (1)</option>
              <option value="0">Off (0)</option>
            </select>
          ) : (
            <input aria-label={s.label} type="number" step={s.integer ? 1 : 0.05} min={s.min} max={s.max} value={value} onChange={(e) => setValue(e.target.value)} className={input} />
          )}
        </div>
      </div>

      {changed && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {s.sensitive && <FormMessage tone="info">This setting guards something important. Changing it can weaken a safeguard.</FormMessage>}
          <label className="block text-sm font-semibold text-nile">Reason (recorded in the audit log)
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
          </label>
          {!confirming ? (
            <Button onClick={() => (s.sensitive ? setConfirming(true) : save())} disabled={reason.trim().length < 5 || busy}>Save</Button>
          ) : (
            <div role="alertdialog" aria-label="Confirm" className="rounded-md border border-border p-4">
              <p className="text-nile">Change &ldquo;{s.label}&rdquo; from {s.value} to {value}?</p>
              <div className="mt-3 flex gap-3">
                <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Yes, change it"}</Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {msg && <div className="mt-3"><FormMessage tone={msg.tone}>{msg.text}</FormMessage></div>}
    </li>
  );
}

export default function SettingsPage() {
  const { data, error, reload } = useLoad<SettingItem[]>("/admin/settings");
  if (error?.status === 403) return <AppShell><FormMessage tone="info">This area is for administrators.</FormMessage></AppShell>;
  if (!data) return <AppShell><PageLoading error={error?.message} /></AppShell>;

  const groups = [...new Set(data.map((s) => s.group))];
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold text-nile">Settings</h1>
      <p className="editorial mt-3 text-lg text-nile/90">
        These decide how the programme, the assessment and matching behave. Each has limits, every change needs a reason, and it takes effect straight away.
        If you run more than one server, others can take up to 30 seconds to catch up.
      </p>
      {groups.map((g) => (
        <section key={g} className="mt-10" aria-labelledby={`g-${g}`}>
          <h2 id={`g-${g}`} className="text-2xl font-semibold text-nile">{g}</h2>
          <ul className="mt-4 space-y-4">
            {data.filter((s) => s.group === g).map((s) => <Row key={`${s.key}:${s.value}`} s={s} onSaved={reload} />)}
          </ul>
        </section>
      ))}
    </AppShell>
  );
}
