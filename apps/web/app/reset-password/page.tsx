"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthShell, Button, FormMessage, TextField } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

const schema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters.").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });
type Values = z.infer<typeof schema>;

function Reset() {
  const token = useSearchParams().get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit({ password }: Values) {
    setError(null);
    try {
      await api("/auth/reset-password", { body: { token, password } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <AuthShell title="Choose a new password">
      {!token ? (
        <FormMessage tone="error">
          This link is missing its token. <Link href="/forgot-password" className="font-semibold underline">Request a new one.</Link>
        </FormMessage>
      ) : done ? (
        <div className="space-y-4">
          <FormMessage tone="success">Your password has been changed. You have been signed out everywhere.</FormMessage>
          <Link href="/login" className="inline-block rounded-md bg-nile px-5 py-3 font-semibold text-white hover:bg-aqua">
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {error && (
            <FormMessage tone="error">
              {error} <Link href="/forgot-password" className="font-semibold underline">Request a new link.</Link>
            </FormMessage>
          )}
          <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." error={errors.password?.message} {...register("password")} />
          <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : "Change password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <Reset />
    </Suspense>
  );
}
