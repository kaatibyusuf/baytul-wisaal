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
    primary: "bg-nile text-white hover:bg-aqua",
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
    <div className="min-h-screen bg-surface">
      <header className="bg-nile">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <Link href="/" aria-label="Baytul Wisaal home" className="inline-block">
            <Image src="/brand/logo-lockup-on-nile.png" alt="Baytul Wisaal" width={887} height={397} className="h-10 w-auto" priority />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-xl px-6 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold leading-tight text-nile">{title}</h1>
        {intro && <p className="editorial mt-3 text-lg text-nile/90">{intro}</p>}
        <div className="mt-8 rounded-lg border border-border bg-white p-6 sm:p-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>}
      </main>
    </div>
  );
}
