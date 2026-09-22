// OpenAI client helper for Convex actions (raw fetch — no SDK dependency).
// Structured Outputs via response_format json_schema (strict mode).

import { fetchWithRetry, requireEnv } from "./lib/httpUtil";
import type { JsonSchema } from "./lib/llmSchemas";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Cheap, fast model for high-volume extraction/parsing. */
export function fastModel(): string {
  return process.env.OPENAI_MODEL_FAST ?? "gpt-5.6-luna";
}

/** Stronger model for negotiation drafting and ranking explanations. */
export function smartModel(): string {
  return process.env.OPENAI_MODEL_SMART ?? "gpt-5.6-luna";
}

export interface CompleteJsonOptions {
  /** Defaults to fastModel(). */
  model?: string;
  system: string;
  user: string;
  schemaName: string;
  schema: JsonSchema;
  /**
   * Sampling temperature. Reasoning models (including the gpt-5.x family)
   * reject every value except the default and fail the request with HTTP 400,
   * so this is only sent when `OPENAI_ALLOW_TEMPERATURE` is set.
   */
  temperature?: number;
  maxTokens?: number;
}

/**
 * Call OpenAI Chat Completions with strict structured outputs and return the
 * parsed JSON typed as T. Throws on refusal/empty content.
 */
export async function completeJson<T>(opts: CompleteJsonOptions): Promise<T> {
  const apiKey = requireEnv("OPENAI_API_KEY");

  const body: Record<string, unknown> = {
    model: opts.model ?? fastModel(),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: opts.schemaName,
        strict: true,
        schema: opts.schema,
      },
    },
  };
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  if (process.env.OPENAI_ALLOW_TEMPERATURE && opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }

  const res = await fetchWithRetry(
    OPENAI_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    { label: "OpenAI chat.completions", timeoutMs: 90_000 },
  );

  const data: {
    choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  } = await res.json();

  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`OpenAI refused: ${message.refusal}`);
  }
  const content = message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }
  return JSON.parse(content) as T;
}
