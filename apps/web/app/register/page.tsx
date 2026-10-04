import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Begin Your Journey" };

export default function RegisterPage() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold text-nile">Begin your journey</h1>
      <p className="editorial mt-4 text-lg text-nile/90">
        Registration opens in the next milestone. It will ask only for what we need to start, and
        collect the rest as you progress.
      </p>
      <Link href="/" className="mt-8 text-aqua underline underline-offset-4">
        Back to home
      </Link>
    </main>
  );
}
