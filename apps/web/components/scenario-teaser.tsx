"use client";

import Link from "next/link";
import { useState } from "react";

const options = [
  "Pay your father's bill from the emergency fund, then tell your spouse.",
  "Sit down with your spouse tonight and agree what to release.",
  "Borrow the ₦250,000 elsewhere and leave the fund alone.",
];

/** Landing hero: the programme's own kind of question, answerable in place. */
export function ScenarioTeaser() {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <div className="arch mx-auto w-full max-w-md bg-night px-6 pb-8 pt-24 shadow-2xl shadow-black/30 sm:px-9 sm:pt-32">
      <p className="text-center text-sm font-semibold text-soft-gold-on-dark">
        48 hours to decide
      </p>
      <div className="editorial mt-5 space-y-3 text-[1.05rem] text-white/95">
        <p>
          You have been married for 14 months. Your spouse has just lost their job. Your father
          urgently needs ₦250,000 for treatment.
        </p>
        <p>
          You have ₦900,000 in savings, and your spouse asked that the emergency fund is not
          touched without talking first.
        </p>
      </div>

      <fieldset className="mt-6">
        <legend className="text-lg font-bold text-white">What do you do?</legend>
        <div className="mt-3 space-y-2">
          {options.map((o, i) => (
            <button
              key={o}
              type="button"
              aria-pressed={picked === i}
              onClick={() => setPicked(i)}
              className="block w-full rounded-md border border-white/25 px-4 py-3 text-left text-[0.95rem] leading-snug text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-turquoise hover:bg-white/5 active:scale-[0.98] aria-pressed:border-turquoise aria-pressed:bg-turquoise aria-pressed:text-nile"
            >
              {o}
            </button>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite" className="mt-5 min-h-[1px]">
        {picked !== null && (
          <div className="rise border-t border-white/20 pt-5">
            <p className="text-sm leading-relaxed text-white/85">
              Each of these can be defended. The programme asks you to say why, and what your choice
              costs the other person. &ldquo;I would communicate&rdquo; is not an answer.
            </p>
            <Link
              href="/register"
              className="mt-4 btn-anim inline-block rounded-md bg-soft-gold-on-dark px-5 py-2.5 text-sm font-semibold text-nile hover:bg-white"
            >
              Start the 30 days
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
