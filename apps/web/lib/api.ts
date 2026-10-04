const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Thin client for the NestJS API. The browser only ever talks to our own backend,
 * and the session lives in an HTTP-only cookie it cannot read.
 */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      credentials: "include",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "We could not reach the server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = data?.message;
    const message = Array.isArray(raw) ? raw[0] : raw;
    throw new ApiError(res.status, data?.code ?? "ERROR", message ?? "Something went wrong. Please try again.");
  }
  return data as T;
}

export type Me = {
  id: string;
  email: string;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  profile: { fullName: string; preferredName: string | null } | null;
  journey: { programme: string };
};
