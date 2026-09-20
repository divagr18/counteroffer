// Small fetch helper shared by the external API clients (OpenAI / Firecrawl /
// AgentMail). Runs inside Convex actions. Provides timeout + exponential
// backoff on 429/5xx so we respect provider rate limits (Firecrawl free tier
// is ~10 req/min).

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  /** Label used in error messages. */
  label?: string;
}

export class HttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, label: string) {
    super(`${label}: HTTP ${status} — ${body.slice(0, 500)}`);
    this.status = status;
    this.body = body;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const label = opts.label ?? url;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) return res;

      const body = await res.text().catch(() => "");
      // Retry on rate limit / transient server errors.
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const retryAfter = res.headers.get("retry-after");
        const delay = retryAfter
          ? Number(retryAfter) * 1000
          : baseDelayMs * Math.pow(2, attempt);
        await sleep(Math.min(delay, 30_000));
        lastError = new HttpError(res.status, body, label);
        continue;
      }
      throw new HttpError(res.status, body, label);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof HttpError) throw err;
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label}: request failed`);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it with \`npx convex env set ${name} <value>\`.`,
    );
  }
  return value;
}
