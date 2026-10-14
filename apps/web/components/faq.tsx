import Link from "next/link";

const SUBSTACK = "https://baytulwisaal.substack.com/";

const items: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is Baytul Wisaal?",
    a: "A space where people learn how to build a strong, beautiful and formidable home. It starts with a 30-day programme on what a marriage asks of you, and it includes a newsletter.",
  },
  {
    q: "Is Baytul Wisaal a matchmaking platform?",
    a: "No. Matching is one part of what we do, and it opens only after the programme, for people who want an introduction. Learning how to build a home is the purpose.",
  },
  {
    q: "How does the 30-day programme work?",
    a: "Each day has short lessons, written reflections, questions and, on some days, a realistic scenario you answer in writing. The four weeks move from foundations, to money and home, to family and communication, to faith, honesty and the decision.",
  },
  {
    q: "Can I skip ahead or finish it quickly?",
    a: "No. One day opens at a time, and a day opens only when the one before it is finished. Lessons also have a minimum reading time, so the programme cannot be ticked through.",
  },
  {
    q: "Who reads my written answers?",
    a: "AI helps assess them against a rubric. People make every consequential decision. AI never bans, excludes or closes anything on its own, and each consequential action is recorded.",
  },
  {
    q: "Who can see my information?",
    a: "Your assessment answers are never shown to a match. Only what the current stage needs is shared, and nobody can browse the member list.",
  },
  {
    q: "What happens if an introduction does not move forward?",
    a: "The pairing closes quietly. The message says only that it did not meet the requirements for the next stage, and it says nothing about you. You can be introduced to someone else later.",
  },
  {
    q: "Is there a newsletter?",
    a: (
      <>
        Yes. It is on Substack and is about building the foundations of a strong marriage.{" "}
        <Link href="/newsletter" className="font-semibold text-turquoise underline underline-offset-4 hover:text-white">
          Read about the newsletter
        </Link>
        , or go straight to{" "}
        <a href={SUBSTACK} target="_blank" rel="noopener noreferrer" className="font-semibold text-turquoise underline underline-offset-4 hover:text-white">
          Substack
        </a>
        .
      </>
    ),
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-white/15 border-y border-white/15">
      {items.map((it) => (
        <details key={it.q} className="faq group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-lg font-semibold text-white transition-colors hover:text-turquoise [&::-webkit-details-marker]:hidden">
            {it.q}
            <span aria-hidden className="faq-icon relative h-6 w-6 shrink-0 rounded-full border-2 border-white/40 transition-all duration-300 group-open:rotate-45 group-open:border-turquoise group-open:bg-turquoise">
              <span className="absolute left-1/2 top-1/2 h-0.5 w-2.5 -translate-x-1/2 -translate-y-1/2 bg-white group-open:bg-nile" />
              <span className="absolute left-1/2 top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white group-open:bg-nile" />
            </span>
          </summary>
          <div className="faq-body max-w-[62ch] pb-6 pr-10 text-white/75">{it.a}</div>
        </details>
      ))}
    </div>
  );
}
