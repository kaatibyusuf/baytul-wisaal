"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthShell, Button, FormMessage, TextField } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [resent, setResent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    setResent(false);
    try {
      await api("/auth/login", { body: values });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? { code: e.code, message: e.message } : { code: "ERROR", message: "Something went wrong." });
    }
  }

  async function resend() {
    await api("/auth/resend-verification", { body: { email: getValues("email") } }).catch(() => undefined);
    setResent(true);
  }

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="font-semibold text-aqua-ink underline underline-offset-4">
            Begin your journey
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {error && (
          <FormMessage tone="error">
            {error.message}
            {error.code === "EMAIL_NOT_VERIFIED" && (
              <span className="mt-2 block">
                {resent ? (
                  "A new link is on its way."
                ) : (
                  <button type="button" onClick={resend} className="font-semibold underline underline-offset-4">
                    Send a new confirmation link
                  </button>
                )}
              </span>
            )}
          </FormMessage>
        )}
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="text-aqua-ink underline underline-offset-4">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
