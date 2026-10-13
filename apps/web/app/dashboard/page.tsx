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
    const stage = matches.current.stage;
    const href = `/matches/${matches.current.id}`;
    const common = [...base, { ...rest[0], state: "done" as const }, { ...rest[1], state: "done" as const }];
    if (stage === "NEXT_STAGE") {
      return {
        steps: [...common, { ...rest[2], state: "done" }, { ...rest[3], state: "current" }],
        where: "Your expectations are compatible enough to move forward.",
        todo: "Look through how you compare, and the points to talk about.",
        next: "The later steps open in a future release.",
        cta: { href, label: "See how you compare" },
      };
    }
    const todo =
      stage === "EXPECTATIONS_PENDING"
        ? "Write what you are seeking in a spouse."
        : stage === "RESPONSE_PENDING"
          ? "Read what they are seeking and respond to each point."
          : "Nothing. Your expectations are being compared.";
    return {
      steps: [...common, { ...rest[2], state: "current" }, rest[3]],
      where: "You have a match.",
      todo,
      next: "When you have both written and responded, we compare your expectations.",
      cta: { href, label: stage === "COMPATIBILITY_REVIEW" ? "See where things stand" : "Continue" },
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

  const current = j.steps.find((s) => s.state === "current");

  return (
    <AppShell>
      <h1 className="editorial text-4xl font-semibold leading-tight text-nile sm:text-5xl">Assalamu alaikum, {name}.</h1>

      {unread.length > 0 && (
        <section aria-labelledby="updates" className="milestone mt-8 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 id="updates" className="text-lg font-semibold">New for you</h2>
            <button onClick={markRead} className="text-sm font-semibold underline underline-offset-4">Mark as read</button>
          </div>
          <ul className="mt-3 space-y-3">
            {unread.map((n) => (
              <li key={n.id}>
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-sm">{n.body}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="now" className="lattice relative mt-8 overflow-hidden rounded-2xl bg-night p-7 text-white sm:p-10">
        <div aria-hidden className="arch absolute -right-4 top-0 hidden h-40 w-28 border-2 border-turquoise/50 sm:block" />
        {current && <p className="text-sm font-semibold text-turquoise">{current.label}</p>}
        <h2 id="now" className="editorial mt-2 max-w-[22ch] text-balance text-3xl font-semibold leading-tight sm:text-4xl">
          {j.todo}
        </h2>
        <p className="mt-4 max-w-[52ch] text-white/80">{j.where}</p>
        {j.cta && (
          <Link href={j.cta.href} className="mt-7 inline-block rounded-md bg-turquoise px-6 py-3 font-semibold text-nile transition-colors hover:bg-white">
            {j.cta.label}
          </Link>
        )}
      </section>

      <section aria-labelledby="journey" className="mt-12">
        <h2 id="journey" className="text-lg font-semibold text-nile">Your Baytul Wisaal journey</h2>
        <ol className="mt-6 grid gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {j.steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3 sm:flex-col sm:gap-2">
              <span
                aria-hidden
                className={`arch flex h-12 w-9 shrink-0 items-end justify-center pb-1.5 text-sm font-bold ${
                  s.state === "done" ? "bg-nile text-white" : s.state === "current" ? "bg-turquoise text-nile" : "border-2 border-border text-text-muted"
                }`}
              >
                {s.state === "done" ? "✓" : ""}
              </span>
              <span className={`text-sm leading-snug ${s.state === "todo" ? "text-text-muted" : "font-semibold text-nile"}`}>
                {s.label}
                <span className="sr-only"> ({s.state === "done" ? "complete" : s.state === "current" ? "current step" : "not started"})</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 grid gap-8 border-t border-border pt-8 sm:grid-cols-2">
        {[
          ["What do I need to do?", j.todo],
          ["What happens next?", j.next],
        ].map(([q, a]) => (
          <div key={q}>
            <h3 className="font-semibold text-nile">{q}</h3>
            <p className="mt-2 max-w-[44ch] text-text-muted">{a}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
