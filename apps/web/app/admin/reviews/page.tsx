"use client";

import Link from "next/link";
import { AppShell, PageLoading } from "@/components/app-shell";
import { FormMessage } from "@/components/ui";
import type { ReviewListItem } from "@/lib/api";
import { TRIGGER_LABELS } from "@/lib/review-labels";
import { useLoad } from "@/lib/use-load";

export default function ReviewsPage() {
  const { data, error } = useLoad<ReviewListItem[]>("/admin/reviews");

  if (error?.status === 403) {
    return (
      <AppShell>
        <FormMessage tone="info">This page is for reviewers.</FormMessage>
      </AppShell>
    );
  }
  if (!data) return <AppShell><PageLoading error={error?.message} /></AppShell>;

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold text-nile">Responses awaiting review</h1>
      <p className="editorial mt-3 text-lg text-nile/90">
        Judge the response in front of you, not the person. Identity is hidden on purpose.
      </p>
      {data.length === 0 ? (
        <p className="mt-8 text-text-muted">Nothing is waiting.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
          {data.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/reviews/${r.id}`} className="block px-5 py-4 transition-colors hover:bg-aqua-tint">
                <p className="text-sm text-text-muted">
                  {new Date(r.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>
                <p className="mt-1 font-semibold text-nile">{r.triggers.map((t) => TRIGGER_LABELS[t] ?? t).join(" · ") || "Review requested"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
