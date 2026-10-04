"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthShell, FormMessage } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [message, setMessage] = useState(token ? "" : "This link is missing its token.");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // React Strict Mode runs effects twice in development
    api("/auth/verify-email", { body: { token } })
      .then(() => setState("ok"))
      .catch((e) => {
        setState("error");
        setMessage(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <AuthShell title="Confirming your email">
      {state === "working" && <p className="text-nile">One moment...</p>}
      {state === "ok" && (
        <div className="space-y-4">
          <FormMessage tone="success">Your email is confirmed and your account is ready.</FormMessage>
          <Link href="/login" className="inline-block rounded-md bg-nile px-5 py-3 font-semibold text-white hover:bg-aqua">
            Sign in
          </Link>
        </div>
      )}
      {state === "error" && (
        <div className="space-y-4">
          <FormMessage tone="error">{message}</FormMessage>
          <p className="text-sm text-text-muted">
            Links work once and expire after 24 hours. Sign in to request a new one.
          </p>
          <Link href="/login" className="inline-block font-semibold text-aqua-ink underline underline-offset-4">
            Go to sign in
          </Link>
        </div>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}
