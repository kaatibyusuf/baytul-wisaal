"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell, PageLoading } from "@/components/app-shell";
import { ExpectationEditor, ResponseEditor, ResultView, Stepper } from "@/components/match-flow";
import { FormMessage } from "@/components/ui";
import type { FlowView } from "@/lib/api";
import { useLoad } from "@/lib/use-load";

export default function MatchFlowPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useLoad<FlowView>(`/matches/${id}`);

  if (error) {
    return (
      <AppShell width="max-w-3xl">
        <FormMessage tone="error">{error.status === 404 ? "We could not find that match." : error.message}</FormMessage>
        <Link href="/matches" className="mt-6 inline-block text-aqua-ink underline underline-offset-4">Back to your match</Link>
      </AppShell>
    );
  }
  if (!data) return <AppShell width="max-w-3xl"><PageLoading /></AppShell>;

  if (data.status !== "ACTIVE") {
    return (
      <AppShell width="max-w-3xl">
        <h1 className="text-3xl font-semibold text-nile">This pairing is closed</h1>
        <div className="mt-6"><FormMessage tone="info">{data.note ?? "This pairing has been closed."} You remain eligible for other matches.</FormMessage></div>
        <Link href="/matches" className="mt-6 inline-block text-aqua-ink underline underline-offset-4">Back to your match</Link>
      </AppShell>
    );
  }

  const you = data.progress!.you;
  const other = data.progress!.other;

  return (
    <AppShell width="max-w-3xl">
      <Link href="/matches" className="text-sm text-aqua-ink underline underline-offset-4">Your match</Link>
      <h1 className="mt-3 text-3xl font-semibold text-nile">
        {data.stage === "EXPECTATIONS_PENDING" && "What you are seeking"}
        {data.stage === "RESPONSE_PENDING" && "Responding to each other"}
        {data.stage === "COMPATIBILITY_REVIEW" && "Comparing your expectations"}
        {data.stage === "NEXT_STAGE" && "How you compare"}
      </h1>
      <Stepper stage={data.stage} />

      {data.stage === "EXPECTATIONS_PENDING" &&
        (you.expectationsSubmitted ? (
          <div className="mt-8"><FormMessage tone="info">Your expectations are submitted. We are waiting for the other person to submit theirs. Once they have, you will both see each other&rsquo;s and can respond. There is nothing you need to do.</FormMessage></div>
        ) : (
          <>
            {other.expectationsSubmitted && <div className="mt-6"><FormMessage tone="info">The other person has already submitted. You will see theirs as soon as you submit yours.</FormMessage></div>}
            <ExpectationEditor view={data} onChange={reload} />
          </>
        ))}

      {data.stage === "RESPONSE_PENDING" &&
        (you.responsesSubmitted ? (
          <div className="mt-8"><FormMessage tone="info">Your responses are submitted. We are waiting for the other person to respond to yours. Nothing is shown until you have both responded.</FormMessage></div>
        ) : (
          <>
            {other.responsesSubmitted && <div className="mt-6"><FormMessage tone="info">The other person has already responded to you. Their answers stay private until you have responded too.</FormMessage></div>}
            <ResponseEditor view={data} onChange={reload} />
          </>
        ))}

      {data.stage === "COMPATIBILITY_REVIEW" && (
        <div className="mt-8"><FormMessage tone="info">Both of you have responded. Our team may take a look before the next step. There is nothing you need to do, and we will let you know.</FormMessage></div>
      )}

      {data.stage === "NEXT_STAGE" && <ResultView view={data} />}
    </AppShell>
  );
}
