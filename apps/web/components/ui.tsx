import Image from "next/image";
import Link from "next/link";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

const fieldBase =
  "mt-1.5 block w-full rounded-md border border-border bg-white px-3.5 py-2.5 text-base text-nile placeholder:text-text-muted/70 focus:border-aqua focus:outline-none focus:ring-2 focus:ring-turquoise aria-[invalid=true]:border-destructive";

type FieldProps = { label: string; error?: string; hint?: string };

export const TextField = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, error, hint, id, ...props }, ref) {
    const fieldId = id ?? props.name ?? label;
    return (
      <div>
        <label htmlFor={fieldId} className="block text-sm font-semibold text-nile">
          {label}
        </label>
        <input
          id={fieldId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={fieldBase}
          {...props}
        />
        {hint && !error && (
          <p id={`${fieldId}-hint`} className="mt-1.5 text-sm text-text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${fieldId}-error`} className="mt-1.5 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);

export const SelectField = forwardRef<
  HTMLSelectElement,
  FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }
>(function SelectField({ label, error, id, children, ...props }, ref) {
  const fieldId = id ?? props.name ?? label;
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-semibold text-nile">
        {label}
      </label>
      <select
        id={fieldId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={fieldBase}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={`${fieldId}-error`} className="mt-1.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

export function Button({
  children,
  variant = "primary",
  ...props
}: { variant?: "primary" | "secondary" | "quiet" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-nile text-white shadow-sm hover:bg-aqua",
    secondary: "border border-nile text-nile hover:bg-aqua-tint",
    quiet: "text-aqua-ink underline underline-offset-4 hover:text-nile",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-md px-5 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-destructive/40 bg-[#fef3f2] text-[#912018]",
    success: "border-aqua/40 bg-aqua-tint text-nile",
    info: "border-border bg-surface text-nile",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}

/** Shared frame for sign-up, sign-in and recovery pages. */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="lattice bg-nile text-white lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-12 lg:py-10">
        <div className="flex px-6 py-4 lg:px-0 lg:py-0">
          <Link href="/" aria-label="Baytul Wisaal home" className="inline-block">
            <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} className="h-10 w-auto lg:h-14" priority />
          </Link>
        </div>
        <div className="hidden lg:block">
          <div className="arch mb-8 h-24 w-16 border-2 border-turquoise/70" aria-hidden />
          <p className="editorial max-w-sm text-3xl leading-snug">
            Prepare for the home first. Meet someone second.
          </p>
        </div>
        <p className="hidden text-sm text-white/60 lg:block">A 30-day marriage-readiness programme.</p>
      </aside>
      <main id="main" className="px-6 py-10 sm:py-14 lg:flex lg:items-center lg:justify-center">
        <div className="mx-auto w-full max-w-md">
          <h1 className="editorial text-3xl font-semibold leading-tight text-nile sm:text-4xl">{title}</h1>
          {intro && <p className="mt-3 text-base leading-relaxed text-text-muted">{intro}</p>}
          <div className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
