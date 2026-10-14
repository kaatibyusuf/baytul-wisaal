import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Newsletter",
  description: "Writing on building the foundations of a strong marriage, from Baytul Wisaal.",
};

const SUBSTACK = "https://baytulwisaal.substack.com/";

export default function NewsletterPage() {
  return (
    <div className="min-h-screen bg-nile text-white">
      <div className="lattice">
        <header>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
            <Link href="/" aria-label="Baytul Wisaal home">
              <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} priority className="h-12 w-auto" />
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/login" className="btn-anim rounded-md border border-white/40 px-4 py-2 font-semibold hover:border-white hover:bg-white/10">Sign in</Link>
            </nav>
          </div>
        </header>

        <main id="main">
          <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-10 lg:grid-cols-[1.2fr_1fr] lg:pb-32 lg:pt-16">
            <div>
              <h1 className="editorial rise text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
                The Baytul Wisaal newsletter
              </h1>
              <p className="rise rise-2 mt-7 max-w-xl text-lg leading-relaxed text-white/80">
                Writing on building the foundations of a strong marriage, for people who want a home
                grounded in love, trust and understanding, even when life gets hard. Written by Kaatib.
              </p>
              <div className="rise rise-3 mt-10 flex flex-wrap items-center gap-4">
                <a
                  href={`${SUBSTACK}subscribe`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-anim btn-pulse rounded-md bg-soft-gold-on-dark px-7 py-3.5 text-base font-semibold text-nile hover:bg-white"
                >
                  Subscribe on Substack
                </a>
                <a
                  href={SUBSTACK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-3 text-base font-semibold text-white underline decoration-white/40 underline-offset-8 transition-colors hover:decoration-turquoise"
                >
                  Read the latest posts
                </a>
              </div>
              <p className="mt-6 text-sm text-white/60">Both links open Substack in a new tab.</p>
            </div>

            <div className="rise rise-2 mx-auto w-full max-w-sm">
              <div className="arch bg-gradient-to-b from-[#1f4a66] to-night px-8 pb-10 pt-28 text-center shadow-2xl shadow-black/40 ring-1 ring-white/15">
                <p className="editorial text-2xl leading-snug">
                  A strong, beautiful and formidable home starts with learning.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>

      <section className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
          <p className="editorial max-w-xl text-xl">Prefer to learn step by step? The 30-day programme takes you through it in order.</p>
          <Link href="/register" className="btn-anim rounded-md bg-turquoise px-6 py-3 font-semibold text-nile hover:bg-white">
            Begin your journey
          </Link>
        </div>
      </section>
    </div>
  );
}
