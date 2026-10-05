import { ProviderError } from "./types";

/** fetch with a timeout and a small retry on rate limits and server errors. */
export async function postJson(
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: { timeoutMs?: number; retries?: number; retryDelayMs?: number } = {},
): Promise<any> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const retries = opts.retries ?? 2;
  const delay = opts.retryDelayMs ?? Number(process.env.AI_RETRY_DELAY_MS ?? 1500);
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.ok) return await res.json();

      // Never log the request: it contains personal answers. Keep only the status and the vendor's error type.
      const detail = await res.text().catch(() => "");
      const type = detail.match(/"(?:type|status|code)"\s*:\s*"([^"]{1,60})"/)?.[1];
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new ProviderError(provider, `HTTP ${res.status}${type ? ` (${type})` : ""}`, retryable);
      if (!retryable) throw lastError;
    } catch (e) {
      if (e instanceof ProviderError && !e.retryable) throw e;
      lastError =
        e instanceof ProviderError
          ? e
          : new ProviderError(provider, (e as Error).name === "AbortError" ? "request timed out" : `network error: ${(e as Error).message}`, true);
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, delay * (attempt + 1)));
  }
  throw lastError ?? new ProviderError(provider, "unknown error", true);
}

/** Models sometimes wrap JSON in markdown fences. Strip them, then parse. */
export function parseJsonLoose(provider: string, text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new ProviderError(provider, "response was not valid JSON", true);
  }
}
