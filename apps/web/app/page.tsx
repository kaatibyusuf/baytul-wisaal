import Image from "next/image";
import Link from "next/link";

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
      <header className="bg-nile text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <Link href="/" aria-label="Baytul Wisaal home">
            <Image
              src="/brand/logo-lockup-on-nile.png"
              alt="Baytul Wisaal"
              width={887}
              height={397}
              priority
              className="h-12 w-auto"
            />
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-5 text-sm sm:gap-8">
            <a href="#how-it-works" className="hidden hover:underline sm:inline">
              How it works
            </a>
            <a href="#privacy" className="hidden hover:underline sm:inline">
              Privacy
            </a>
            <Link href="/login" className="hover:underline">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="bg-nile text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-16">
            <div>
              <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Marriage is a big deal. Treat it like one.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
                Baytul Wisaal is a structured marriage-readiness and matchmaking platform designed
                to help you think beyond attraction and prepare for the reality of building a
                family.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/register"
                  className="rounded-md bg-turquoise px-6 py-3 text-base font-semibold text-nile transition-colors hover:bg-white"
                >
                  Begin Your Journey
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-md border border-white/40 px-6 py-3 text-base font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
                >
                  How It Works
                </a>
              </div>
            </div>

            <aside
              aria-label="Example scenario from the programme"
              className="rounded-lg border border-white/15 bg-[#1f4560] p-7 sm:p-9"
            >
              <p className="text-sm text-white/70">A scenario from the programme</p>
              <div className="editorial mt-4 space-y-4 text-lg text-white/95">
                <p>
                  You have been married for 14 months. Your spouse has just lost their job.
                </p>
                <p>
                  Your father urgently needs ₦250,000 for medical treatment. You have ₦900,000 in
                  savings, and your spouse asks that the emergency fund is not touched without
                  discussing it together.
                </p>
                <p>You have 48 hours to decide.</p>
                <p className="text-xl font-bold text-soft-gold-on-dark">What do you do?</p>
              </div>
              <p className="mt-6 border-t border-white/15 pt-4 text-sm leading-relaxed text-white/70">
                &ldquo;I would communicate&rdquo; is not an answer here. You decide, and you
                explain why.
              </p>
            </aside>
          </div>
        </section>

        {/* Not a dating app */}
        <section className="bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
            <div>
              <h2 className="text-balance text-3xl font-semibold leading-tight text-nile sm:text-4xl">
                This is not a dating app with Islamic branding.
              </h2>
              <p className="editorial prose-measure mt-6 text-lg text-nile/90">
                Two people can both be responsible, religious and mature, and still want different
                lives. So we do not look for a perfect spouse. We look at whether two specific
                people have compatible expectations and approaches to building a home.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-nile">What you will not find here</h3>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {notHere.map((item) => (
                  <li key={item} className="py-3 text-nile/90">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How it works: a true sequence */}
        <section id="how-it-works" className="scroll-mt-4 bg-white">
          <div className="mx-auto max-w-4xl px-6 py-20 lg:py-24">
            <h2 className="text-balance text-3xl font-semibold leading-tight text-nile sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-text-muted">
              Six stages, in order. Each one opens only when the one before it is complete.
            </p>
            <ol className="mt-12 space-y-0">
              {steps.map((step, i) => (
                <li key={step.title} className="relative grid grid-cols-[3rem_1fr] gap-x-5 pb-10 last:pb-0">
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[1.35rem] top-11 h-[calc(100%-2.75rem)] w-px bg-border"
                    />
                  )}
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-nile text-base font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="pt-1.5">
                    <h3 className="text-xl font-semibold text-nile">{step.title}</h3>
                    <p className="prose-measure mt-2 text-text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="scroll-mt-4 bg-aqua text-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:py-24">
            <h2 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl">
              Private by design.
            </h2>
            <div className="space-y-5 text-lg leading-relaxed text-white/95">
              <p>
                Your assessment answers are never shown to a match. Only what the current stage
                requires is ever shared, and nobody can browse the member list.
              </p>
              <p>
                When a pairing does not move forward, the message is simply that this pairing did
                not meet the requirements for the next stage. It says nothing about you.
              </p>
              <p>
                AI helps assess written answers. It never bans, excludes or closes anything by
                itself, and every consequential action is recorded.
              </p>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:py-28">
            <p className="editorial text-balance text-2xl text-nile sm:text-3xl">
              Think about the home. The children. The money. The difficult years. The ordinary
              Tuesday nights, and who this person will be when life stops being exciting.
            </p>
            <p className="mt-6 text-lg text-text-muted">And who you will be.</p>
            <Link
              href="/register"
              className="mt-10 inline-block rounded-md bg-nile px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-aqua"
            >
              Begin Your Journey
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-nile text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Image
            src="/brand/logo-lockup-on-nile.png"
            alt="Baytul Wisaal"
            width={887}
            height={397}
            className="h-10 w-auto"
          />
          <p className="text-sm text-white/70">
            Marriage is a big deal, and we are going to treat it as such.
          </p>
        </div>
      </footer>
    </>
  );
}
