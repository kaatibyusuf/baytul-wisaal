import Image from "next/image";
import Link from "next/link";
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
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
            <Link href="/" aria-label="Baytul Wisaal home">
              <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} priority className="h-12 w-auto" />
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-5 text-sm sm:gap-8">
              <a href="#how-it-works" className="hidden hover:underline sm:inline">How it works</a>
              <a href="#privacy" className="hidden hover:underline sm:inline">Privacy</a>
              <Link href="/login" className="btn-anim rounded-md border border-white/40 px-4 py-2 font-semibold hover:border-white hover:bg-white/10">
                Sign in
              </Link>
            </nav>
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
                  Baytul Wisaal is a 30-day marriage-readiness programme with careful matchmaking at
                  the end of it. You prepare for the home first, and meet someone second.
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

      <main>
        <section className="bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_1fr] lg:gap-20 lg:py-28">
            <div>
              <h2 className="editorial text-balance text-3xl font-semibold leading-tight text-nile sm:text-5xl">
                This is not a dating app with Islamic branding.
              </h2>
              <p className="editorial mt-7 max-w-[62ch] text-lg text-nile/90">
                Two people can both be responsible, religious and mature, and still want different
                lives. So we do not look for a perfect spouse. We look at whether two specific
                people have compatible expectations and approaches to building a home.
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

        <section id="how-it-works" className="scroll-mt-4 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
            <h2 className="editorial text-balance text-3xl font-semibold leading-tight text-nile sm:text-5xl">
              Six stages, in order
            </h2>
            <p className="mt-4 max-w-xl text-lg text-text-muted">
              Each stage opens only when the one before it is complete.
            </p>
            <ol className="mt-14 grid gap-x-12 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {steps.map((step, i) => (
                <Reveal as="li" key={step.title} delay={(i % 3) * 140} className="stage relative">
                  <span className="stage-badge arch flex h-14 w-11 items-end justify-center pb-2 text-base font-semibold">
                    {i + 1}
                  </span>
                  <h3 className="editorial mt-5 text-2xl font-semibold text-nile">{step.title}</h3>
                  <p className="mt-2 max-w-[44ch] text-text-muted">{step.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section id="privacy" className="lattice scroll-mt-4 bg-aqua text-white">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
            <h2 className="editorial text-balance text-3xl font-semibold leading-tight sm:text-5xl">
              Private by design
            </h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              <Reveal>
                <h3 className="text-xl font-semibold">Your answers stay yours</h3>
                <p className="mt-3 leading-relaxed text-white/90">
                  Assessment answers are never shown to a match. Only what the current stage needs
                  is shared, and nobody can browse the member list.
                </p>
              </Reveal>
              <Reveal delay={140}>
                <h3 className="text-xl font-semibold">Closing is gentle</h3>
                <p className="mt-3 leading-relaxed text-white/90">
                  When a pairing does not move forward, the message says only that it did not meet
                  the requirements for the next stage. It says nothing about you.
                </p>
              </Reveal>
              <Reveal delay={280}>
                <h3 className="text-xl font-semibold">People make the calls</h3>
                <p className="mt-3 leading-relaxed text-white/90">
                  AI helps assess written answers. It never bans, excludes or closes anything on
                  its own, and every consequential action is recorded.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="bg-night text-white">
          <div className="mx-auto max-w-4xl px-6 py-24 lg:py-32">
            <p className="editorial text-balance text-2xl leading-snug sm:text-4xl">
              Think about the home. The children. The money. The difficult years. The ordinary
              Tuesday nights, and who this person will be when life stops being exciting.
            </p>
            <p className="mt-6 text-xl text-soft-gold-on-dark">And who you will be.</p>
            <Link href="/register" className="btn-anim mt-10 inline-block rounded-md bg-turquoise px-7 py-3.5 text-base font-semibold text-nile hover:bg-white">
              Begin your journey
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-nile text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} className="h-10 w-auto" />
          <p className="text-sm text-white/70">Marriage is a big deal, and we are going to treat it as such.</p>
        </div>
      </footer>
    </>
  );
}
