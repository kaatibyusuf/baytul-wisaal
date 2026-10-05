/** Shared HTTP helper for provider adapters: timeout, retry on 429/5xx, and no secrets in errors. */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public status?: number,
  ) {
    super(`${provider}: ${message}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function postJson(opts: {
  provider: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
}): Promise<any> {
  const retries = opts.retries ?? 2;
  let last: ProviderError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep((opts.backoffMs ?? 1000) * attempt);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
    try {
      const res = await fetch(opts.url, {
        method: "POST",
        headers: { "content-type": "application/json", ...opts.headers },
        body: JSON.stringify(opts.body),
        signal: ctrl.signal,
      });
      if (res.ok) return await res.json();

      // Keep only a short vendor message. Never echo the request, which contains candidate text.
      let detail = "";
      try {
        const j: any = await res.json();
        detail = String(j?.error?.message ?? j?.message ?? "").slice(0, 200);
      } catch {
        /* no body */
      }
      last = new ProviderError(opts.provider, `HTTP ${res.status}${detail ? ` ${detail}` : ""}`, res.status);
      if (res.status !== 429 && res.status < 500) throw last; // a 4xx will not fix itself
    } catch (e) {
      if (e instanceof ProviderError && e.status && e.status !== 429 && e.status < 500) throw e;
      last = e instanceof ProviderError ? e : new ProviderError(opts.provider, (e as Error).name === "AbortError" ? "timed out" : "network error");
    } finally {
      clearTimeout(timer);
    }
  }
  throw last ?? new ProviderError(opts.provider, "request failed");
}
