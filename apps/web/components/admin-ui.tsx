"use client";

import { useState, type ReactNode } from "react";
import { Button, FormMessage } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

export const input =
  "mt-1.5 block w-full rounded-md border border-border bg-white px-3.5 py-2.5 text-base text-nile focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise";

export const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "border-aqua/40 bg-aqua-tint text-nile",
  PENDING_VERIFICATION: "border-border bg-surface text-text-muted",
  RESTRICTED: "border-gold bg-gold-tint text-nile",
  SUSPENDED: "border-destructive/50 bg-[#fef3f2] text-[#912018]",
};

export const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export const pretty = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`rounded-full border px-3 py-0.5 text-sm ${className}`}>{children}</span>;
}

/** A single sensitive action: it always asks why, and it confirms before doing anything that cannot be undone. */
export function ActionCard({
  title,
  help,
  confirmText,
  buttonLabel,
  path,
  method = "POST",
  extra,
  buildBody,
  canSubmit = true,
  onDone,
  children,
}: {
  title: string;
  help?: string;
  /** If set, the action asks "are you sure" first with this message. */
  confirmText?: string;
  buttonLabel: string;
  path: string;
  method?: string;
  extra?: () => Record<string, unknown>;
  buildBody?: never;
  canSubmit?: boolean;
  onDone: () => void;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  void buildBody;

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      await api(path, { method, body: { ...(extra?.() ?? {}), reason: reason.trim() } });
      setMsg({ tone: "success", text: "Done. It has been recorded in the audit log." });
      setReason("");
      setConfirming(false);
      onDone();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Something went wrong." });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const ready = canSubmit && reason.trim().length >= 5;
  return (
    <section className="rounded-lg border border-border bg-white p-5">
      <h3 className="font-semibold text-nile">{title}</h3>
      {help && <p className="mt-1 text-sm text-text-muted">{help}</p>}
      <div className="mt-3 space-y-3">
        {children}
        <div>
          <label className="block text-sm font-semibold text-nile">
            Reason (recorded in the audit log)
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
          </label>
        </div>
        {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
        {!confirming ? (
          <Button onClick={() => (confirmText ? setConfirming(true) : go())} disabled={!ready || busy}>
            {busy ? "Working..." : buttonLabel}
          </Button>
        ) : (
          <div role="alertdialog" aria-label="Confirm" className="rounded-md border border-border p-4">
            <p className="text-nile">{confirmText}</p>
            <div className="mt-3 flex gap-3">
              <Button onClick={go} disabled={busy}>{busy ? "Working..." : "Yes, do it"}</Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm text-text-muted">
      <span>{total} in total · page {page} of {pages}</span>
      <span className="flex gap-3">
        <Button variant="secondary" onClick={() => onPage(page - 1)} disabled={page <= 1}>Previous</Button>
        <Button variant="secondary" onClick={() => onPage(page + 1)} disabled={page >= pages}>Next</Button>
      </span>
    </nav>
  );
}
