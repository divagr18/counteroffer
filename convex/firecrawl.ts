// Firecrawl v2 client helper for Convex actions (raw fetch — no SDK).
// Endpoints used: POST /v2/search (discovery), POST /v2/scrape (enrichment).
// NOTE: /extract is deprecated upstream; structured extraction uses scrape
// JSON mode.

import { fetchWithRetry, requireEnv } from "./lib/httpUtil";
import type { JsonSchema } from "./lib/llmSchemas";

const BASE = "https://api.firecrawl.dev/v2";

export interface FirecrawlSearchResult {
  url: string;
  title: string;
  description: string;
  markdown?: string;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  country?: string;
  location?: string;
  includeDomains?: string[];
  /** Fetch page markdown in the same call (costs extra credits). */
  scrapeMarkdown?: boolean;
}

export async function firecrawlSearch(
  opts: SearchOptions,
): Promise<FirecrawlSearchResult[]> {
  const apiKey = requireEnv("FIRECRAWL_API_KEY");

  const body: Record<string, unknown> = {
    query: opts.query,
    limit: opts.limit ?? 10,
    country: opts.country ?? "IN",
    sources: [{ type: "web" }],
  };
  if (opts.location) body.location = opts.location;
  if (opts.includeDomains && opts.includeDomains.length > 0) {
    body.includeDomains = opts.includeDomains;
  }
  if (opts.scrapeMarkdown) {
    body.scrapeOptions = { formats: [{ type: "markdown" }] };
  }

  const res = await fetchWithRetry(
    `${BASE}/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    { label: `Firecrawl search (${opts.query})`, timeoutMs: 90_000 },
  );

  const data: {
    success?: boolean;
    data?: { web?: { url?: string; title?: string; description?: string; markdown?: string }[] };
  } = await res.json();

  const web = data.data?.web ?? [];
  return web
    .filter((r): r is { url: string; title?: string; description?: string; markdown?: string } =>
      typeof r.url === "string" && r.url.length > 0,
    )
    .map((r) => ({
      url: r.url,
      title: r.title ?? "",
      description: r.description ?? "",
      markdown: r.markdown,
    }));
}

export interface ScrapeJsonResult<T> {
  json: T | null;
  sourceUrl: string;
  statusCode: number | null;
  error: string | null;
}

/**
 * Scrape one URL and extract structured JSON via Firecrawl's LLM JSON mode.
 * Returns null json (never throws) when extraction fails — enrichment is
 * best-effort and failures are recorded as evidence gaps.
 */
export async function firecrawlScrapeJson<T>(opts: {
  url: string;
  schema: JsonSchema;
  prompt: string;
}): Promise<ScrapeJsonResult<T>> {
  const apiKey = requireEnv("FIRECRAWL_API_KEY");

  try {
    const res = await fetchWithRetry(
      `${BASE}/scrape`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: opts.url,
          formats: [
            { type: "json", schema: opts.schema, prompt: opts.prompt },
          ],
          onlyMainContent: false,
          timeout: 120000,
        }),
      },
      { label: `Firecrawl scrape (${opts.url})`, timeoutMs: 150_000 },
    );

    const data: {
      success?: boolean;
      data?: { json?: T; metadata?: { statusCode?: number; sourceURL?: string } };
    } = await res.json();

    return {
      json: data.data?.json ?? null,
      sourceUrl: data.data?.metadata?.sourceURL ?? opts.url,
      statusCode: data.data?.metadata?.statusCode ?? null,
      error: null,
    };
  } catch (err) {
    return {
      json: null,
      sourceUrl: opts.url,
      statusCode: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface ScrapeMarkdownResult {
  markdown: string | null;
  sourceUrl: string;
  statusCode: number | null;
  error: string | null;
}

/** Scrape one URL to markdown (for evidence snippets + LLM fallback). */
export async function firecrawlScrapeMarkdown(
  url: string,
): Promise<ScrapeMarkdownResult> {
  const apiKey = requireEnv("FIRECRAWL_API_KEY");

  try {
    const res = await fetchWithRetry(
      `${BASE}/scrape`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: 60000,
        }),
      },
      { label: `Firecrawl markdown (${url})`, timeoutMs: 90_000 },
    );

    const data: {
      data?: { markdown?: string; metadata?: { statusCode?: number; sourceURL?: string } };
    } = await res.json();

    return {
      markdown: data.data?.markdown ?? null,
      sourceUrl: data.data?.metadata?.sourceURL ?? url,
      statusCode: data.data?.metadata?.statusCode ?? null,
      error: null,
    };
  } catch (err) {
    return {
      markdown: null,
      sourceUrl: url,
      statusCode: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
