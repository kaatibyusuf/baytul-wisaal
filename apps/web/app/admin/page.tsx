"use client";

import Link from "next/link";
import { AppShell, PageLoading } from "@/components/app-shell";
import { FormMessage } from "@/components/ui";
import type { Me } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

const SECTIONS = [
  { href: "/admin/users", title: "Members", text: "Find a member, look after their account, restrict or suspend, extend their programme." },
  { href: "/admin/matchmaking", title: "Matchmaking", text: "Preview a round, create matches, and prevent two people being introduced." },
  { href: "/admin/reviews", title: "Reviews", text: "Scenario answers and pairings that need a person to look at them." },
  { href: "/admin/curriculum", title: "Curriculum", text: "Export, check and import the 30-day programme, its scenarios and rubrics." },
  { href: "/admin/settings", title: "Settings", text: "The thresholds that decide how the programme, assessment and matching behave." },
  { href: "/admin/audit", title: "Audit log", text: "A permanent record of every sensitive action, who did it and why." },
];

export default function AdminHome() {
  const me = useLoad<Me>("/users/me");
  if (!me.data) return <AppShell><PageLoading error={me.error?.message} /></AppShell>;
  if (!["ADMIN", "SUPER_ADMIN"].includes(me.data.role)) {
    return <AppShell><FormMessage tone="info">This area is for administrators.</FormMessage></AppShell>;
  }
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold text-nile">Administration</h1>
      <p className="editorial mt-3 text-lg text-nile/90">Everything here is recorded. Where you change something about a person, you will be asked why.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block h-full rounded-lg border border-border bg-white p-5 transition-colors hover:bg-aqua-tint">
              <p className="font-semibold text-nile">{s.title}</p>
              <p className="mt-1 text-sm text-text-muted">{s.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
