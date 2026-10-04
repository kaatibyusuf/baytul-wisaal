"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthShell, Button, FormMessage, TextField } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.") });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await api("/auth/forgot-password", { body: values });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      intro="Enter your email and we will send you a link to choose a new one."
      footer={
        <Link href="/login" className="font-semibold text-aqua-ink underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <FormMessage tone="success">
          If an account exists for that address, a reset link is on its way. It works once and expires in 1 hour.
        </FormMessage>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
