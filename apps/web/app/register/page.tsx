"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthShell, Button, FormMessage, SelectField, TextField } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

function ageOn(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age;
}

// Client checks are for convenience only. The API enforces every rule again.
const schema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    preferredName: z.string().trim().max(60).optional(),
    email: z.string().trim().email("Enter a valid email address."),
    gender: z.enum(["MALE", "FEMALE"], { message: "Select one." }),
    dateOfBirth: z
      .string()
      .min(1, "Enter your date of birth.")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Enter a valid date.")
      .refine((v) => ageOn(v) >= 18, "You must be at least 18 to register."),
    maritalStatus: z.enum(["NEVER_MARRIED", "DIVORCED", "WIDOWED"], { message: "Select one." }),
    password: z.string().min(10, "Use at least 10 characters.").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit({ confirm: _confirm, preferredName, ...rest }: Values) {
    setError(null);
    try {
      await api("/auth/register", { body: { ...rest, ...(preferredName ? { preferredName } : {}) } });
      setDone(rest.email);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  }

  async function resend() {
    if (!done) return;
    await api("/auth/resend-verification", { body: { email: done } }).catch(() => undefined);
    setResent(true);
  }

  if (done) {
    return (
      <AuthShell title="Check your email">
        <div className="space-y-4">
          <p className="text-nile">
            We sent a confirmation link to <strong>{done}</strong>. Open it to finish creating your account. The link is
            valid for 24 hours.
          </p>
          <p className="text-sm text-text-muted">
            Nothing there? Check your spam folder, then request a new link.
          </p>
          {resent ? (
            <FormMessage tone="success">If that address needs confirming, a new link is on its way.</FormMessage>
          ) : (
            <Button variant="secondary" onClick={resend}>
              Send a new link
            </Button>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Begin your journey"
      intro="We ask only what we need to start. The rest comes later, as you progress."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-aqua-ink underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <TextField label="Full name" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
        <TextField
          label="Preferred name (optional)"
          autoComplete="nickname"
          hint="What we should call you in emails and on your dashboard."
          error={errors.preferredName?.message}
          {...register("preferredName")}
        />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Gender" error={errors.gender?.message} defaultValue="" {...register("gender")}>
            <option value="" disabled>
              Select
            </option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </SelectField>
          <TextField label="Date of birth" type="date" autoComplete="bday" error={errors.dateOfBirth?.message} {...register("dateOfBirth")} />
        </div>
        <SelectField label="Marital status" error={errors.maritalStatus?.message} defaultValue="" {...register("maritalStatus")}>
          <option value="" disabled>
            Select
          </option>
          <option value="NEVER_MARRIED">Never married</option>
          <option value="DIVORCED">Divorced</option>
          <option value="WIDOWED">Widowed</option>
        </SelectField>
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters. A few ordinary words strung together works well."
          error={errors.password?.message}
          {...register("password")}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register("confirm")}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Creating your account..." : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
