"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { Pager, input, pretty, when } from "@/components/admin-ui";
import { Button, FormMessage } from "@/components/ui";
import type { AuditList } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

function Audit() {
  const params = useSearchParams();
  const [form, setForm] = useState({ action: params.get("action") ?? "", targetId: params.get("targetId") ?? "" });
  const [applied, setApplied] = useState(form);
  const [page, setPage] = useState(1);

  const qs = new URLSearchParams({ page: String(page), ...(applied.action ? { action: applied.action } : {}), ...(applied.targetId ? { targetId: applied.targetId } : {}) });
  const { data, error } = useLoad<AuditList>(`/admin/audit?${qs}`);

  if (error?.status === 403) return <AppShell><FormMessage tone="info">This area is for administrators.</FormMessage></AppShell>;

  return (
    <AppShell width="max-w-5xl">
      <h1 className="text-3xl font-semibold text-nile">Audit log</h1>
      <p className="editorial mt-3 text-lg text-nile/90">A permanent record. Entries cannot be edited or removed by anyone, including administrators.</p>

      <form
        className="mt-6 grid gap-4 rounded-lg border border-border bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => { e.preventDefault(); setApplied(form); setPage(1); }}
      >
        <label className="block text-sm font-semibold text-nile">Action (exact, for example USER_STATUS_CHANGED)<input value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className={input} /></label>
        <label className="block text-sm font-semibold text-nile">About this account or item (its id)<input value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} className={input} /></label>
        <Button type="submit">Filter</Button>
      </form>

      {!data ? (
        <div className="mt-6"><PageLoading error={error?.message} /></div>
      ) : data.items.length === 0 ? (
        <p className="mt-6 text-text-muted">Nothing matches.</p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
            {data.items.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-nile">{pretty(a.action)}</p>
                  <p className="text-sm text-text-muted">{when(a.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-text-muted">By {a.actor} · on {a.targetType} <span className="break-all">{a.targetId}</span></p>
                {a.reason && <p className="mt-1 text-sm text-nile">Reason: {a.reason}</p>}
                {a.metadata != null && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-aqua-ink">Details</summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-surface p-3 text-xs text-nile">{JSON.stringify(a.metadata, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </AppShell>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <Audit />
    </Suspense>
  );
}
