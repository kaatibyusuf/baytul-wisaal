"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AppShell, PageLoading } from "@/components/app-shell";
import { ActionCard, Badge, STATUS_STYLE, input, pretty, when } from "@/components/admin-ui";
import { FormMessage } from "@/components/ui";
import type { AdminUserDetail, Me } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

const STATUS_HELP: Record<string, string> = {
  ACTIVE: "Restores normal use.",
  RESTRICTED: "They can keep using the programme but will not be matched. They are told.",
  SUSPENDED: "Signs them out everywhere, blocks sign-in, and closes any current pairing. The other person is told neutrally.",
};

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useLoad<AdminUserDetail>(`/admin/users/${id}`);
  const me = useLoad<Me>("/users/me");
  const [status, setStatus] = useState("");
  const [days, setDays] = useState("7");
  const [role, setRole] = useState("");

  if (error) {
    return (
      <AppShell>
        <FormMessage tone={error.status === 403 ? "info" : "error"}>{error.status === 403 ? "This area is for administrators." : error.message}</FormMessage>
        <Link href="/admin/users" className="mt-6 inline-block text-aqua-ink underline underline-offset-4">Back to members</Link>
      </AppShell>
    );
  }
  if (!data) return <AppShell><PageLoading /></AppShell>;

  const isSuper = me.data?.role === "SUPER_ADMIN";
  const isSelf = me.data?.id === data.id;
  const p = data.programme;

  return (
    <AppShell width="max-w-5xl">
      <Link href="/admin/users" className="text-sm text-aqua-ink underline underline-offset-4">All members</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-nile">{data.profile?.fullName ?? data.email}</h1>
        <Badge className={STATUS_STYLE[data.status] ?? ""}>{pretty(data.status)}</Badge>
        {data.role !== "USER" && <Badge className="border-nile text-nile">{pretty(data.role)}</Badge>}
      </div>
      <p className="mt-1 text-text-muted">{data.email} · {data.emailVerified ? "email verified" : "email not verified"} · joined {when(data.createdAt)}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-white p-5" aria-labelledby="about">
          <h2 id="about" className="font-semibold text-nile">About</h2>
          {data.profile ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[["Gender", pretty(data.profile.gender)], ["Age", String(data.profile.age)], ["Marital status", pretty(data.profile.maritalStatus)], ["Lives in", data.profile.location], ["Phone", data.profile.phone]]
                .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-text-muted">{k}</dt><dd className="font-semibold text-nile">{v}</dd></div>)}
            </dl>
          ) : <p className="mt-3 text-text-muted">No profile yet.</p>}
          <p className="mt-4 text-xs text-text-muted">Private answers, assessment responses and preferences are deliberately not shown here.</p>
        </section>

        <section className="rounded-lg border border-border bg-white p-5" aria-labelledby="progress">
          <h2 id="progress" className="font-semibold text-nile">Progress</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-text-muted">Programme</dt><dd className="font-semibold text-nile">{p?.enrollment ? `${pretty(p.enrollment.status)}, ${p.percentComplete}%` : "Not started"}</dd></div>
            {p?.enrollment?.dueAt && <div><dt className="text-text-muted">Due by</dt><dd className="font-semibold text-nile">{when(p.enrollment.dueAt)}</dd></div>}
            <div><dt className="text-text-muted">Preferences</dt><dd className="font-semibold text-nile">{data.preferences.submitted ? `Submitted${data.preferences.availability ? `, ${pretty(data.preferences.availability)}` : ""}` : "Not submitted"}</dd></div>
            <div><dt className="text-text-muted">Current match</dt><dd className="font-semibold text-nile">{data.hasActiveMatch ? "Yes" : "No"}</dd></div>
            {data.lockedUntil && new Date(data.lockedUntil) > new Date() && <div><dt className="text-text-muted">Sign-in locked until</dt><dd className="font-semibold text-nile">{when(data.lockedUntil)}</dd></div>}
          </dl>
        </section>
      </div>

      {isSelf ? (
        <div className="mt-8"><FormMessage tone="info">This is your own account, so changes are not available here.</FormMessage></div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ActionCard
            title="Change account status"
            help={status ? STATUS_HELP[status] : "Choose a new status."}
            buttonLabel="Change status"
            path={`/admin/users/${data.id}/status`}
            extra={() => ({ status })}
            canSubmit={!!status && status !== data.status}
            confirmText={status === "SUSPENDED" ? "Suspending signs them out now and closes any current pairing. Are you sure?" : undefined}
            onDone={() => { setStatus(""); reload(); }}
          >
            <label className="block text-sm font-semibold text-nile">New status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
                <option value="">Choose...</option>
                {["ACTIVE", "RESTRICTED", "SUSPENDED"].filter((s) => s !== data.status).map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
              </select>
            </label>
          </ActionCard>

          {!data.emailVerified && (
            <ActionCard title="Verify email by hand" help="Use this only after confirming their identity some other way." buttonLabel="Mark email as verified" path={`/admin/users/${data.id}/verify-email`} onDone={reload} />
          )}

          {p?.enrollment && p.enrollment.status !== "COMPLETED" && (
            <ActionCard
              title="Give more time"
              help="Extends the programme deadline, and reopens it if it had expired."
              buttonLabel="Extend programme"
              path={`/admin/users/${data.id}/programme/extend`}
              extra={() => ({ days: Number(days) })}
              canSubmit={Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 90}
              onDone={reload}
            >
              <label className="block text-sm font-semibold text-nile">Extra days (1 to 90)
                <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className={input} />
              </label>
            </ActionCard>
          )}

          {isSuper && (
            <ActionCard
              title="Change role"
              help="Only super administrators can do this."
              buttonLabel="Change role"
              path={`/admin/users/${data.id}/role`}
              extra={() => ({ role })}
              canSubmit={!!role && role !== data.role}
              confirmText="Changing a role changes what this person can see and do. Are you sure?"
              onDone={() => { setRole(""); reload(); }}
            >
              <label className="block text-sm font-semibold text-nile">New role
                <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>
                  <option value="">Choose...</option>
                  {["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"].filter((r) => r !== data.role).map((r) => <option key={r} value={r}>{pretty(r)}</option>)}
                </select>
              </label>
            </ActionCard>
          )}
        </div>
      )}

      <section className="mt-8 rounded-lg border border-border bg-white p-5" aria-labelledby="recent">
        <h2 id="recent" className="font-semibold text-nile">Recent activity on this account</h2>
        {data.recent.length === 0 ? (
          <p className="mt-3 text-text-muted">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {data.recent.map((r, i) => (
              <li key={i} className="py-2.5">
                <p className="text-nile"><strong>{pretty(r.action)}</strong> <span className="text-text-muted">{r.asActor ? "(done by them)" : "(done to them)"}</span></p>
                <p className="text-text-muted">{when(r.createdAt)}{r.reason ? ` · ${r.reason}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/admin/audit?targetId=${data.id}`} className="mt-3 inline-block text-sm text-aqua-ink underline underline-offset-4">See the full record</Link>
      </section>
    </AppShell>
  );
}
