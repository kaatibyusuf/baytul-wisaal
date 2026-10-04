"use client";

import Link from "next/link";
import { AppShell, PageLoading } from "@/components/app-shell";
import { type Me, type ProgrammeSummary } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

type Step = { label: string; state: "done" | "current" | "todo" };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function journey(p: ProgrammeSummary): { steps: Step[]; where: string; todo: string; next: string; cta?: { href: string; label: string } } {
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
    return {
      steps: [{ label: "Account", state: "done" }, { label: "Marriage readiness programme", state: "done" }, { ...rest[0], state: "current" }, ...rest.slice(1)],
      where: "You have completed the marriage-readiness programme.",
      todo: "Nothing yet. Defining what you are seeking opens in the next release.",
      next: "You will say what you are looking for in a spouse, then be matched.",
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

  if (!me.data || !prog.data) return <AppShell><PageLoading error={me.error?.message ?? prog.error?.message} /></AppShell>;

  const name = me.data.profile?.preferredName || me.data.profile?.fullName.split(" ")[0] || "there";
  const j = journey(prog.data);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold text-nile">Assalamu alaikum, {name}.</h1>

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
