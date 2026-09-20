import { describe, expect, test } from "vitest";
import { completeJson } from "../convex/openai";
import { REPLY_PARSE_SYSTEM } from "../convex/lib/prompts";
import { replyParseSchema, type ParsedReply } from "../convex/lib/llmSchemas";
import { EMAIL_FIXTURES } from "./fixtures/emails";

const hasKey = Boolean(process.env.OPENAI_API_KEY);

describe.runIf(hasKey)("reply extraction accuracy (doc §64)", () => {
  for (const fixture of EMAIL_FIXTURES) {
    test(
      fixture.name,
      async () => {
        const parsed = await completeJson<ParsedReply>({
          system: REPLY_PARSE_SYSTEM,
          user: JSON.stringify({
            original_request:
              "Wedding photographer in Mumbai on October 18, 8 hours, highlight video, under ₹40,000",
            requirements: [
              "Available October 18 (required)",
              "8 hours coverage (required)",
              "Highlight video (required)",
            ],
            date: "2026-10-18",
            quantity: null,
            reply_subject: "Re: RFQ",
            reply_body: fixture.body,
          }),
          schemaName: "parsed_reply",
          schema: replyParseSchema,
        });

        const intents = Array.isArray(fixture.expect.intent)
          ? fixture.expect.intent
          : [fixture.expect.intent];
        expect(intents).toContain(parsed.intent);

        if (fixture.expect.taxesIncluded !== undefined) {
          expect(parsed.taxes_included).toBe(fixture.expect.taxesIncluded);
        }
        if (fixture.expect.minLineItems !== undefined) {
          expect(parsed.line_items.length).toBeGreaterThanOrEqual(
            fixture.expect.minLineItems,
          );
        }
        if (fixture.expect.missingIncludes !== undefined) {
          const joined = parsed.missing_fields.join(" ").toLowerCase();
          for (const part of fixture.expect.missingIncludes) {
            expect(joined).toContain(part);
          }
        }
        if (fixture.expect.available !== undefined) {
          expect(parsed.available).toBe(fixture.expect.available);
        }
        if (fixture.expect.maxTotal !== undefined) {
          const totals = parsed.line_items.map((li) => li.total_price);
          expect(Math.min(...totals)).toBeLessThanOrEqual(
            fixture.expect.maxTotal,
          );
        }
      },
      60_000,
    );
  }
});
