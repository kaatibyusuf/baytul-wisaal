"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/programme", label: "Programme" },
  { href: "/profile", label: "Profile" },
];

/** Frame for every signed-in page. */
export function AppShell({ children, width = "max-w-4xl" }: { children: ReactNode; width?: string }) {
  const router = useRouter();
  const path = usePathname();

  async function signOut() {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-nile text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
          <Link href="/dashboard" aria-label="Baytul Wisaal dashboard">
            <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} className="h-10 w-auto" priority />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-5 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={path === l.href || path.startsWith(`${l.href}/`) ? "page" : undefined}
                className="py-1 hover:underline aria-[current=page]:border-b-2 aria-[current=page]:border-turquoise"
              >
                {l.label}
              </Link>
            ))}
            <button onClick={signOut} className="py-1 hover:underline">
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main id="main" className={`mx-auto ${width} px-6 py-10 sm:py-12`}>
        {children}
      </main>
    </div>
  );
}

export function PageLoading({ error }: { error?: string | null }) {
  return error ? (
    <p role="alert" className="text-destructive">
      {error}
    </p>
  ) : (
    <p className="text-text-muted">Loading...</p>
  );
}
