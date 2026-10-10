"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { Badge, Pager, STATUS_STYLE, input, pretty, when } from "@/components/admin-ui";
import { Button, FormMessage } from "@/components/ui";
import type { AdminUserList } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

export default function AdminUsersPage() {
  const [form, setForm] = useState({ q: "", status: "", role: "" });
  const [applied, setApplied] = useState(form);
  const [page, setPage] = useState(1);

  const qs = new URLSearchParams({ page: String(page), ...(applied.q ? { q: applied.q } : {}), ...(applied.status ? { status: applied.status } : {}), ...(applied.role ? { role: applied.role } : {}) });
  const { data, error } = useLoad<AdminUserList>(`/admin/users?${qs}`);

  if (error?.status === 403) return <AppShell><FormMessage tone="info">This area is for administrators.</FormMessage></AppShell>;

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold text-nile">Members</h1>
      <form
        className="mt-6 grid gap-4 rounded-lg border border-border bg-white p-5 sm:grid-cols-[1fr_11rem_11rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(form);
          setPage(1);
        }}
      >
        <label className="block text-sm font-semibold text-nile">Name or email<input value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} className={input} /></label>
        <label className="block text-sm font-semibold text-nile">Status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={input}>
            <option value="">Any</option>
            {["ACTIVE", "PENDING_VERIFICATION", "RESTRICTED", "SUSPENDED"].map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-nile">Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={input}>
            <option value="">Any</option>
            {["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"].map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
          </select>
        </label>
        <Button type="submit">Search</Button>
      </form>

      {!data ? (
        <div className="mt-6"><PageLoading error={error?.message} /></div>
      ) : data.items.length === 0 ? (
        <p className="mt-6 text-text-muted">No one matches.</p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
            {data.items.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-aqua-tint">
                  <div>
                    <p className="font-semibold text-nile">{u.fullName ?? "No profile"}</p>
                    <p className="text-sm text-text-muted">{u.email} · joined {when(u.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {u.role !== "USER" && <Badge className="border-nile text-nile">{pretty(u.role)}</Badge>}
                    <Badge className={STATUS_STYLE[u.status] ?? ""}>{pretty(u.status)}</Badge>
                    <span className="text-text-muted">Programme: {pretty(u.programme)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </AppShell>
  );
}
