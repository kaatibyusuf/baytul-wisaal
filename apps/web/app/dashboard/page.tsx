"use client";

import Link from "next/link";
import { AppShell, PageLoading } from "@/components/app-shell";
import { api, type MatchesData, type Me, type NotificationsData, type PreferencesForm, type ProgrammeSummary } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type Step = { label: string; state: "done" | "current" | "todo" };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function journey(p: ProgrammeSummary, prefs: PreferencesForm, matches: MatchesData): { steps: Step[]; where: string; todo: string; next: string; cta?: { href: string; label: string } } {
  const status = p.enrollment?.status;
  const rest: Step[] = [
    { label: "Marriage preferences", state: "todo" },
    { label: "Matchmaking", state: "todo" },
    { label: "Compatibility", state: "todo" },
    { label: "Next stage", state: "todo" },
  ];

  if (!p.enrollment) {
    return {
      steps: [{ label: "Account", state: "done" }, { label: "Marriage readiness programme", state: "current" }, ...rest],
      where: "Your account is confirmed. You have not started the programme.",
      todo: `Begin Day 1 of ${p.programme.totalDays}.`,
      next: "One day opens at a time, and each opens only when the one before it is finished.",
      cta: { href: "/programme", label: "Begin the programme" },
    };
  }
  if (status === "COMPLETED") {
    const base: Step[] = [{ label: "Account", state: "done" }, { label: "Marriage readiness programme", state: "done" }];
    if (!prefs.submittedAt) {
      return {
        steps: [...base, { ...rest[0], state: "current" }, ...rest.slice(1)],
        where: "You have completed the marriage-readiness programme.",
        todo: "Say what you are seeking in a spouse.",
        next: "Once your preferences are in, we will look for someone whose expectations fit yours.",
        cta: { href: "/preferences", label: "Complete your preferences" },
      };
    }
    if (!matches.current) {
      return {
        steps: [...base, { ...rest[0], state: "done" }, { ...rest[1], state: "current" }, ...rest.slice(2)],
        where: prefs.availability === "PAUSED" ? "Your preferences are in, and matching is paused." : "Your preferences are in. We are looking for a match.",
        todo: prefs.availability === "PAUSED" ? "Resume matching when you are ready." : "Nothing. You are available, and we will notify you.",
        next: "When we find someone whose expectations fit yours, you will be introduced.",
        cta: { href: prefs.availability === "PAUSED" ? "/preferences" : "/matches", label: prefs.availability === "PAUSED" ? "Resume matching" : "View matches" },
      };
    }
    return {
      steps: [...base, { ...rest[0], state: "done" }, { ...rest[1], state: "done" }, { ...rest[2], state: "current" }, rest[3]],
      where: "You have a match.",
      todo: "Read their introduction. Nothing else is needed yet.",
      next: "The next step, sharing what each of you is seeking, opens in the next release.",
      cta: { href: "/matches", label: "See your match" },
    };
  }
  if (status === "EXPIRED" || status === "FAILED" || status === "UNDER_REVIEW") {
    return {
      steps: [{ label: "Account", state: "done" }, { label: "Marriage readiness programme", state: "current" }, ...rest],
      where: "Your programme is on hold.",
      todo: status === "EXPIRED" ? "The time allowed has passed. Please contact support." : "Our team is reviewing your progress.",
      next: "We will be in touch.",
    };
  }
  const nextLocked = p.days.find((d) => d.state === "LOCKED_TIME" && d.unlocksAt);
  return {
    steps: [{ label: "Account", state: "done" }, { label: "Marriage readiness programme", state: "current" }, ...rest],
    where: p.currentDay ? `Day ${p.currentDay} of ${p.programme.totalDays}, ${p.percentComplete}% complete.` : `${p.percentComplete}% complete.`,
    todo: p.currentDay ? `Continue Day ${p.currentDay}.` : "You are up to date for now.",
    next: nextLocked?.unlocksAt ? `Day ${nextLocked.dayNumber} opens ${fmt(nextLocked.unlocksAt)}.` : "Keep going in order. The next day opens when you finish this one.",
    cta: p.currentDay ? { href: "/programme", label: `Continue Day ${p.currentDay}` } : undefined,
  };
}

export default function DashboardPage() {
  const me = useLoad<Me>("/users/me");
  const prog = useLoad<ProgrammeSummary>("/programme");
  const prefs = useLoad<PreferencesForm>("/preferences");
  const matches = useLoad<MatchesData>("/matches");
  const notes = useLoad<NotificationsData>("/notifications");

  if (!me.data || !prog.data || !prefs.data || !matches.data) {
    return <AppShell><PageLoading error={me.error?.message ?? prog.error?.message ?? prefs.error?.message ?? matches.error?.message} /></AppShell>;
  }

  const name = me.data.profile?.preferredName || me.data.profile?.fullName.split(" ")[0] || "there";
  const j = journey(prog.data, prefs.data, matches.data);
  const unread = notes.data?.items.filter((n) => !n.readAt) ?? [];

  async function markRead() {
    await api("/notifications/read", { method: "POST", body: {} }).catch(() => undefined);
    notes.reload();
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold text-nile">Assalamu alaikum, {name}.</h1>

      {unread.length > 0 && (
        <section aria-labelledby="updates" className="mt-8 rounded-lg border border-aqua/40 bg-aqua-tint p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="updates" className="text-lg font-semibold text-nile">New for you</h2>
            <button onClick={markRead} className="text-sm text-aqua-ink underline underline-offset-4">Mark as read</button>
          </div>
          <ul className="mt-3 space-y-3">
            {unread.map((n) => (
              <li key={n.id}>
                <p className="font-semibold text-nile">{n.title}</p>
                {n.body && <p className="text-sm text-nile/90">{n.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="journey" className="mt-10 rounded-lg border border-border bg-white p-6 sm:p-8">
        <h2 id="journey" className="text-lg font-semibold text-nile">
          Your Baytul Wisaal journey
        </h2>
        <ol className="mt-5 space-y-3">
          {j.steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-nile">
              <span
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                  s.state === "done" ? "border-nile bg-nile text-white" : s.state === "current" ? "border-turquoise bg-turquoise text-nile" : "border-border bg-white text-text-muted"
                }`}
              >
                {s.state === "done" ? "✓" : s.state === "current" ? "→" : ""}
              </span>
              <span className={s.state === "todo" ? "text-text-muted" : "font-semibold"}>
                {s.label}
                <span className="sr-only"> ({s.state === "done" ? "complete" : s.state === "current" ? "current step" : "not started"})</span>
              </span>
            </li>
          ))}
        </ol>
        {j.cta && (
          <Link href={j.cta.href} className="mt-7 inline-block rounded-md bg-nile px-6 py-3 font-semibold text-white transition-colors hover:bg-aqua">
            {j.cta.label}
          </Link>
        )}
      </section>

      <section className="mt-6 grid gap-6 sm:grid-cols-3">
        {[
          ["Where am I?", j.where],
          ["What do I need to do?", j.todo],
          ["What happens next?", j.next],
        ].map(([q, a]) => (
          <div key={q} className="rounded-lg border border-border bg-white p-6">
            <h3 className="font-semibold text-nile">{q}</h3>
            <p className="mt-2 text-text-muted">{a}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
