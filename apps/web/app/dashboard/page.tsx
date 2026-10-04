"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { ApiError, api, type Me } from "@/lib/api";

type Step = { label: string; state: "done" | "current" | "todo" };

// Steps mirror the journey in the PRD (section 31). Later steps light up as those milestones ship.
const steps: Step[] = [
  { label: "Account", state: "done" },
  { label: "Marriage readiness programme", state: "current" },
  { label: "Marriage preferences", state: "todo" },
  { label: "Matchmaking", state: "todo" },
  { label: "Compatibility", state: "todo" },
  { label: "Next stage", state: "todo" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Me>("/users/me")
      .then(setMe)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e instanceof ApiError ? e.message : "Could not load your account.");
      });
  }, [router]);

  async function signOut() {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    router.replace("/login");
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <p role="alert" className="text-destructive">{error}</p>
      </main>
    );
  }
  if (!me) return <main className="mx-auto max-w-xl px-6 py-16 text-nile">Loading...</main>;

  const name = me.profile?.preferredName || me.profile?.fullName.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-nile text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} className="h-10 w-auto" priority />
          <Button variant="quiet" onClick={signOut} className="!text-white">
            Sign out
          </Button>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold text-nile">Assalamu alaikum, {name}.</h1>

        <section aria-labelledby="journey" className="mt-10 rounded-lg border border-border bg-white p-6 sm:p-8">
          <h2 id="journey" className="text-lg font-semibold text-nile">
            Your Baytul Wisaal journey
          </h2>
          <ol className="mt-5 space-y-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-nile">
                <span
                  aria-hidden
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                    s.state === "done"
                      ? "border-nile bg-nile text-white"
                      : s.state === "current"
                        ? "border-turquoise bg-turquoise text-nile"
                        : "border-border bg-white text-text-muted"
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
        </section>

        <section className="mt-6 grid gap-6 sm:grid-cols-3">
          {[
            ["Where am I?", "Your account is created and your email is confirmed."],
            ["What do I need to do?", "Nothing yet. The 30-day marriage-readiness programme opens in the next release."],
            ["What happens next?", "You will begin the programme, then define what you are seeking, then be matched."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-lg border border-border bg-white p-6">
              <h3 className="font-semibold text-nile">{q}</h3>
              <p className="mt-2 text-text-muted">{a}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
