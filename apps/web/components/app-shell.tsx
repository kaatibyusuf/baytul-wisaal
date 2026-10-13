"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, type Me } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/programme", label: "Programme" },
  { href: "/preferences", label: "Preferences" },
  { href: "/matches", label: "Matches" },
  { href: "/profile", label: "Profile" },
];

/** Frame for every signed-in page. */
export function AppShell({ children, width = "max-w-4xl" }: { children: ReactNode; width?: string }) {
  const router = useRouter();
  const path = usePathname();
  const [role, setRole] = useState<string | null>(null);

  // Only used to show the Reviews link. The API enforces who may actually review.
  useEffect(() => {
    api<Me>("/users/me")
      .then((m) => setRole(m.role))
      .catch(() => undefined);
  }, []);
  const isReviewer = role === "MODERATOR" || role === "ADMIN" || role === "SUPER_ADMIN";
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  async function signOut() {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="lattice sticky top-0 z-30 border-b-2 border-turquoise/60 bg-nile text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/dashboard" aria-label="Baytul Wisaal dashboard">
            <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} className="h-10 w-auto" priority />
          </Link>
          <nav aria-label="Main" className="-mx-1 flex max-w-full items-center gap-5 overflow-x-auto px-1 text-sm">
            {[...links, ...(isReviewer ? [{ href: "/admin/reviews", label: "Reviews" }] : []), ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={path === l.href || (l.href !== "/admin" ? path.startsWith(`${l.href}/`) : path.startsWith("/admin/") && !path.startsWith("/admin/reviews") && !path.startsWith("/admin/compatibility")) ? "page" : undefined}
                className="whitespace-nowrap border-b-2 border-transparent py-1 text-white/80 transition-colors hover:text-white aria-[current=page]:border-soft-gold-on-dark aria-[current=page]:font-semibold aria-[current=page]:text-white"
              >
                {l.label}
              </Link>
            ))}
            <button onClick={signOut} className="whitespace-nowrap py-1 text-white/70 hover:text-white">
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main id="main" className={`mx-auto ${width} px-6 py-10 sm:py-14`}>
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
