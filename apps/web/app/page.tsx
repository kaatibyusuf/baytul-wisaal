import Image from "next/image";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { Reveal } from "@/components/reveal";
import { ScenarioTeaser } from "@/components/scenario-teaser";

const steps = [
  {
    title: "Prepare",
    body: "Complete a 30-day marriage-readiness programme. Daily lessons, written reflections and realistic scenarios, each checked by the platform. You cannot tick your way through it.",
  },
  {
    title: "Reflect",
    body: "Your written decisions are read against a rubric you never see. AI assists the assessment. People make the consequential calls.",
  },
  {
    title: "Define",
    body: "Say what you are seeking in a spouse, and mark each point as a non-negotiable, a preference, or something flexible. The month should have changed how you answer.",
  },
  {
    title: "Match",
    body: "There is no browsing. The platform proposes a pairing based on your hard requirements, your preferences, and who has completed the programme.",
  },
  {
    title: "Respond",
    body: "Each person sets out their expectations. The other responds to every point and explains the response, so a quick yes never counts as agreement.",
  },
  {
    title: "Proceed",
    body: "Where expectations align, the pairing moves to the next stage. Where they do not, the pairing closes quietly and both of you stay eligible for other matches.",
  },
];

const weeks = [
  { title: "Foundations", days: "Days 1 to 7", topics: ["Why marriage deserves preparation", "Compatibility, not perfection", "Rights and duties in marriage"] },
  { title: "Money and home", days: "Days 8 to 14", topics: ["Money values", "Debt, savings and generosity", "Household roles"] },
  { title: "Family, children and communication", days: "Days 15 to 21", topics: ["In-laws and family boundaries", "Children: wanting, timing and uncertainty", "Conflict and repair"] },
  { title: "Faith, honesty and the decision", days: "Days 22 to 30", topics: ["Faith in the home", "Hardship, illness and sacrifice", "Your covenant"] },
];

const facts = [
  { value: "30 days", label: "Programme length", icon: "calendar" },
  { value: "4 weeks", label: "Of lessons and scenarios", icon: "layers" },
  { value: "One day at a time", label: "Each opens after the last", icon: "door" },
  { value: "Written answers", label: "Read against a rubric", icon: "pen" },
] as const;

function FactIcon({ name }: { name: (typeof facts)[number]["icon"] }) {
  const common = { width: 34, height: 34, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (name === "calendar") return (<svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /><path d="M9 15l2 2 4-4" /></svg>);
  if (name === "layers") return (<svg {...common}><path d="M12 4l8.5 4.5L12 13 3.5 8.5z" /><path d="M3.5 12.5L12 17l8.5-4.5" /><path d="M3.5 16.5L12 21l8.5-4.5" /></svg>);
  if (name === "door") return (<svg {...common}><path d="M6 21V10a6 6 0 0112 0v11" /><path d="M3.5 21h17" /><circle cx="15" cy="15" r="0.8" fill="currentColor" /></svg>);
  return (<svg {...common}><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z" /><path d="M14.5 6.5l3 3" /></svg>);
}

const notHere = [
  "Swiping",
  "Like counts or follower counts",
  "Public profile browsing",
  "Attractiveness scores",
  "A single score that reduces you to a number",
];

export default function Home() {
  return (
    <>
      <noscript>
        <style>{".reveal{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <div className="lattice bg-nile text-white">
        <header>
          <div className="mx-auto flex max-w-6xl items-start justify-between gap-6 px-6 py-5">
            <Link href="/" aria-label="Baytul Wisaal home">
              <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} priority className="h-12 w-auto" />
            </Link>
            <div className="flex items-start gap-8">
              <nav aria-label="Primary" className="hidden h-12 items-center gap-7 text-sm md:flex">
                <a href="#programme" className="hover:underline">The 30 days</a>
                <a href="#how-it-works" className="hover:underline">How it works</a>
                <a href="#privacy" className="hover:underline">Privacy</a>
                <a href="#faq" className="hover:underline">FAQ</a>
                <Link href="/newsletter" className="hover:underline">Newsletter</Link>
              </nav>
              <div className="-mt-5 flex items-center gap-3 whitespace-nowrap rounded-b-[1.75rem] bg-gradient-to-b from-soft-gold-on-dark to-[#b98a2e] px-4 pb-3 pt-8 text-sm font-semibold text-nile shadow-lg shadow-black/20 sm:gap-5 sm:px-7">
                <Link href="/login" className="underline-offset-4 hover:underline">Sign in</Link>
                <span aria-hidden className="h-4 w-px bg-nile/40" />
                <Link href="/register" className="underline-offset-4 hover:underline">Create account</Link>
              </div>
            </div>
          </div>
        </header>

        <div id="main">
          <section>
            <div className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12 lg:pb-20 lg:pt-10">
              <div>
                <h1 className="editorial rise text-balance text-[2.6rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
                  Marriage is a big deal. Treat it like one.
                </h1>
                <p className="rise rise-2 mt-7 max-w-lg text-lg leading-relaxed text-white/80">
                  Baytul Wisaal is a space where people learn how to build a strong, beautiful and
                  formidable home. Start with a 30-day programme on what a marriage asks of you.
                </p>
                <div className="rise rise-3 mt-10 flex flex-wrap items-center gap-4">
                  <Link href="/register" className="btn-anim btn-pulse rounded-md bg-turquoise px-7 py-3.5 text-base font-semibold text-nile hover:bg-white">
                    Begin your journey
                  </Link>
                  <a href="#how-it-works" className="px-2 py-3 text-base font-semibold text-white underline decoration-white/40 underline-offset-8 transition-colors hover:decoration-turquoise">
                    See how it works
                  </a>
                </div>
              </div>
              <div className="rise rise-2">
                <ScenarioTeaser />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-12 max-w-6xl px-6">
        <Reveal className="grid items-center gap-6 rounded-2xl bg-white p-6 shadow-xl shadow-nile/15 ring-1 ring-border sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto] lg:gap-8 lg:px-8">
          {facts.map((f) => (
            <div key={f.value} className="flex items-center gap-4">
              <span className="text-aqua-ink"><FactIcon name={f.icon} /></span>
              <div>
                <p className="font-semibold leading-tight text-nile">{f.value}</p>
                <p className="text-sm text-text-muted">{f.label}</p>
              </div>
            </div>
          ))}
          <Link href="/register" className="btn-anim rounded-md bg-gradient-to-b from-soft-gold-on-dark to-[#b98a2e] px-6 py-3 text-center font-semibold text-nile sm:col-span-2 lg:col-span-1">
            Begin your journey
          </Link>
        </Reveal>
      </div>

      <main>
        <section className="bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-28 lg:grid-cols-[1.2fr_1fr] lg:gap-20 lg:pb-28 lg:pt-36">
            <div>
              <h2 className="editorial text-balance text-3xl font-semibold leading-tight text-nile sm:text-5xl">
                Baytul Wisaal is not a matchmaking platform.
              </h2>
              <p className="editorial mt-7 max-w-[62ch] text-lg text-nile/90">
It is a space where people learn how to build a strong, beautiful and formidable home. The
                30-day programme and our newsletter come from that one purpose. Matching is one part of
                what we do, for people who finish the programme and want an introduction. We do not look
                for a perfect spouse. Two people can both be responsible, religious and mature, and
                still want different lives.
              </p>
            </div>
            <div className="lg:pt-3">
              <h3 className="text-lg font-semibold text-nile">What you will not find here</h3>
              <ul className="mt-5 space-y-3">
                {notHere.map((item) => (
                  <li key={item} className="text-xl text-nile/70 line-through decoration-soft-gold decoration-2">
                    <span className="sr-only">Not offered: </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="programme" className="scroll-mt-4 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
            <h2 className="editorial text-balance text-3xl font-semibold leading-tight text-nile sm:text-5xl">
              What the 30 days cover
            </h2>
            <p className="mt-4 max-w-xl text-lg text-text-muted">
              One day opens at a time. Each week builds on the one before it.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {weeks.map((w, i) => (
                <Reveal key={w.title} delay={(i % 2) * 140} className="group rounded-2xl border border-border bg-surface p-7 transition-all duration-300 hover:-translate-y-1 hover:border-aqua hover:bg-aqua-tint hover:shadow-lg hover:shadow-nile/10">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="editorial text-2xl font-semibold leading-snug text-nile">{w.title}</h3>
                    <span className="shrink-0 rounded-full bg-nile px-3 py-1 text-xs font-semibold text-white">Week {i + 1}</span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{w.days}</p>
                  <ul className="mt-5 space-y-2.5">
                    {w.topics.map((t) => (
                      <li key={t} className="flex items-start gap-3 text-nile">
                        <span aria-hidden className="arch mt-1.5 h-3.5 w-2.5 shrink-0 bg-turquoise transition-transform duration-300 group-hover:scale-125" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-4 bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
            <h2 className="editorial text-balance text-3xl font-semibold leading-tight text-nile sm:text-5xl">
              Six stages, in order
            </h2>
            <p className="mt-4 max-w-xl text-lg text-text-muted">
              Each stage opens only when the one before it is complete. From Define onward the stages are about matching, which is only one part of what we do.
            </p>
            <ol className="mt-14 max-w-3xl">
              {steps.map((step, i) => (
                <Reveal as="li" key={step.title} className="stage relative grid grid-cols-[3.5rem_1fr] gap-x-6 pb-12 last:pb-0">
                  {i < steps.length - 1 && (
                    <span aria-hidden className="step-line absolute left-[1.35rem] top-16 h-[calc(100%-4rem)] w-0.5 bg-gradient-to-b from-nile to-border" />
                  )}
                  <span className="stage-badge arch flex h-16 w-11 items-end justify-center pb-2 text-base font-semibold">
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <h3 className="editorial text-2xl font-semibold text-nile sm:text-3xl">{step.title}</h3>
                    <p className="mt-2 max-w-[56ch] text-lg text-text-muted">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="privacy" className="privacy-bg relative scroll-mt-4 overflow-hidden text-white">
          <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 hidden -translate-y-1/2 lg:block">
            <div className="arch h-[30rem] w-80 border border-white/15 p-8"><div className="arch h-full w-full border border-white/15 p-8"><div className="arch h-full w-full border border-turquoise/30" /></div></div>
          </div>
          <div className="relative mx-auto max-w-6xl px-6 py-20 lg:py-28">
            <h2 className="editorial text-balance text-3xl font-semibold leading-tight sm:text-5xl">
              Private by design
            </h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              <Reveal className="glass rounded-2xl border-t-2 border-t-soft-gold-on-dark p-6">
                <h3 className="editorial text-2xl font-semibold">Your answers stay yours</h3>
                <p className="mt-3 leading-relaxed text-white/90">
                  Assessment answers are never shown to a match. Only what the current stage needs
                  is shared, and nobody can browse the member list.
                </p>
              </Reveal>
              <Reveal delay={140} className="glass rounded-2xl border-t-2 border-t-soft-gold-on-dark p-6">
                <h3 className="editorial text-2xl font-semibold">Closing is gentle</h3>
                <p className="mt-3 leading-relaxed text-white/90">
                  When a pairing does not move forward, the message says only that it did not meet
                  the requirements for the next stage. It says nothing about you.
                </p>
              </Reveal>
              <Reveal delay={280} className="glass rounded-2xl border-t-2 border-t-soft-gold-on-dark p-6">
                <h3 className="editorial text-2xl font-semibold">People make the calls</h3>
                <p className="mt-3 leading-relaxed text-white/90">
                  AI helps assess written answers. It never bans, excludes or closes anything on
                  its own, and every consequential action is recorded.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-4 bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-20 lg:py-28">
            <div>
              <h2 className="editorial text-balance text-3xl font-semibold leading-tight text-nile sm:text-5xl">
                Questions
              </h2>
              <p className="mt-4 max-w-sm text-lg text-text-muted">
                Straight answers about how Baytul Wisaal works.
              </p>
            </div>
            <Reveal>
              <Faq />
            </Reveal>
          </div>
        </section>
      </main>

      <div className="lattice bg-nile text-white">
        <section>
          <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
            <p className="editorial max-w-3xl text-balance text-2xl leading-snug sm:text-4xl">
              {[
                "Think about the home.",
                "The children.",
                "The money.",
                "The difficult years.",
                "The ordinary Tuesday nights, and who this person will be when life stops being exciting.",
              ].map((line, i) => (
                <Reveal key={line} as="span" delay={i * 750} className="reveal-slow mr-[0.3em] inline-block">
                  {line}
                </Reveal>
              ))}
            </p>
            <Reveal delay={4300} className="reveal-slow">
              <p className="mt-6 text-xl text-soft-gold-on-dark">And who you will be.</p>
            </Reveal>
            <Reveal delay={5200} className="reveal-slow">
              <Link href="/register" className="btn-anim mt-10 inline-block rounded-md bg-turquoise px-7 py-3.5 text-base font-semibold text-nile hover:bg-white">
                Begin your journey
              </Link>
            </Reveal>
          </div>
        </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} className="h-10 w-auto self-start object-contain" />
          <div className="flex flex-col gap-3 sm:items-end">
            <nav aria-label="Footer" className="flex gap-6 text-sm">
              <Link href="/newsletter" className="hover:underline">Newsletter</Link>
              <a href="https://baytulwisaal.substack.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">Substack</a>
              <Link href="/login" className="hover:underline">Sign in</Link>
            </nav>
            <p className="text-sm text-white/70">Marriage is a big deal, and we are going to treat it as such.</p>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
