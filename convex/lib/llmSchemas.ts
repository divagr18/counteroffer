// JSON Schemas (OpenAI Structured Outputs, strict mode) for every LLM task.
// strict mode rules: all fields required, additionalProperties: false,
// nullable via "type": ["string", "null"].

export type JsonSchema = Record<string, unknown>;

// ---------------------------------------------------------------------------
// 1. Natural-language request → structured procurement spec (doc §5.1)
// ---------------------------------------------------------------------------

export interface ParsedRequirement {
  label: string;
  kind: "required" | "preferred";
}

export interface ParsedProcurementRequest {
  title: string;
  category: string;
  location: string;
  target_date: string | null;
  quantity: number | null;
  budget_type: "fixed" | "per_person" | "per_hour" | "package";
  target_budget: number;
  hard_budget: number;
  currency: string;
  requirements: ParsedRequirement[];
  negotiable: string[];
}

export const procurementRequestSchema: JsonSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Short campaign title, e.g. 'Wedding Photographer — Mumbai'",
    },
    category: {
      type: "string",
      description:
        "Service category slug, e.g. 'photographer', 'catering', 'movers'",
    },
    location: { type: "string" },
    target_date: {
      type: ["string", "null"],
      description: "ISO date (YYYY-MM-DD) if the user gave one, else null",
    },
    quantity: {
      type: ["number", "null"],
      description:
        "Headcount/quantity when relevant (e.g. guests for catering), else null",
    },
    budget_type: {
      type: "string",
      enum: ["fixed", "per_person", "per_hour", "package"],
    },
    target_budget: {
      type: "number",
      description: "The price the user would love to pay",
    },
    hard_budget: {
      type: "number",
      description:
        "Absolute maximum. If the user gave one number, set both to it",
    },
    currency: { type: "string", description: "ISO currency, usually INR" },
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          kind: { type: "string", enum: ["required", "preferred"] },
        },
        required: ["label", "kind"],
        additionalProperties: false,
      },
    },
    negotiable: {
      type: "array",
      items: { type: "string" },
      description: "Aspects the user is willing to negotiate on",
    },
  },
  required: [
    "title",
    "category",
    "location",
    "target_date",
    "quantity",
    "budget_type",
    "target_budget",
    "hard_budget",
    "currency",
    "requirements",
    "negotiable",
  ],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// 2. Search plan (doc §7: multiple search angles)
// ---------------------------------------------------------------------------

export interface SearchPlan {
  queries: string[];
  include_domains: string[];
}

export const searchPlanSchema: JsonSchema = {
  type: "object",
  properties: {
    queries: {
      type: "array",
      items: { type: "string" },
      description:
        "4-6 distinct web search queries approaching the need from different angles (service+city, service+locality, pricing queries, directory queries)",
    },
    include_domains: {
      type: "array",
      items: { type: "string" },
      description:
        "Optional list of trusted directory domains to bias search toward (may be empty)",
    },
  },
  required: ["queries", "include_domains"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// 3. Vendor fact extraction from crawled page markdown (doc §8)
// ---------------------------------------------------------------------------

export interface ExtractedPricingSignal {
  value: number;
  currency: string;
  source: string;
}

export interface ExtractedVendor {
  name: string | null;
  description: string | null;
  services: string[];
  pricing_signals: ExtractedPricingSignal[];
  emails: string[];
  phones: string[];
  locations: string[];
  website: string | null;
  confidence: number;
}

export const vendorExtractionSchema: JsonSchema = {
  type: "object",
  properties: {
    name: {
      type: ["string", "null"],
      description: "Business name, null if not determinable",
    },
    description: {
      type: ["string", "null"],
      description: "One-sentence description of the business",
    },
    services: { type: "array", items: { type: "string" } },
    pricing_signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "number" },
          currency: { type: "string" },
          source: {
            type: "string",
            description: "Where on the page this price came from",
          },
        },
        required: ["value", "currency", "source"],
        additionalProperties: false,
      },
    },
    emails: { type: "array", items: { type: "string" } },
    phones: { type: "array", items: { type: "string" } },
    locations: {
      type: "array",
      items: { type: "string" },
      description: "Cities / areas served",
    },
    website: { type: ["string", "null"] },
    confidence: {
      type: "number",
      description: "0..1 confidence that this is a real matching vendor",
    },
  },
  required: [
    "name",
    "description",
    "services",
    "pricing_signals",
    "emails",
    "phones",
    "locations",
    "website",
    "confidence",
  ],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// 4. Vendor email reply parsing (doc §13-15)
// ---------------------------------------------------------------------------

export interface ExtractedLineItem {
  label: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  required: boolean;
  included: boolean;
  is_addon: boolean;
}

export interface ParsedReply {
  intent:
    | "quote"
    | "needs_clarification"
    | "negotiation"
    | "unavailable"
    | "declined"
    | "acknowledgement"
    | "unrelated";
  available: boolean | null;
  currency: string;
  line_items: ExtractedLineItem[];
  taxes_included: boolean | null;
  travel_included: boolean | null;
  travel_amount: number | null;
  coverage_hours: number | null;
  deliverables: string[];
  delivery_timeline_days: number | null;
  missing_fields: string[];
  confidence: number;
}

export const replyParseSchema: JsonSchema = {
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: [
        "quote",
        "needs_clarification",
        "negotiation",
        "unavailable",
        "declined",
        "acknowledgement",
        "unrelated",
      ],
    },
    available: {
      type: ["boolean", "null"],
      description: "Vendor availability for the requested date, null if unstated",
    },
    currency: { type: "string" },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "number" },
          total_price: { type: "number" },
          required: {
            type: "boolean",
            description: "Whether the buyer asked for this item",
          },
          included: {
            type: "boolean",
            description: "Whether the vendor included it in this quote",
          },
          is_addon: { type: "boolean" },
        },
        required: [
          "label",
          "quantity",
          "unit_price",
          "total_price",
          "required",
          "included",
          "is_addon",
        ],
        additionalProperties: false,
      },
    },
    taxes_included: {
      type: ["boolean", "null"],
      description: "null if the email does not say",
    },
    travel_included: {
      type: ["boolean", "null"],
      description: "null if the email does not say",
    },
    travel_amount: { type: ["number", "null"] },
    coverage_hours: { type: ["number", "null"] },
    deliverables: { type: "array", items: { type: "string" } },
    delivery_timeline_days: { type: ["number", "null"] },
    missing_fields: {
      type: "array",
      items: { type: "string" },
      description:
        "Fields a complete quote must state but this email does not (e.g. 'taxes', 'travel', 'exact price', 'coverage hours')",
    },
    confidence: { type: "number" },
  },
  required: [
    "intent",
    "available",
    "currency",
    "line_items",
    "taxes_included",
    "travel_included",
    "travel_amount",
    "coverage_hours",
    "deliverables",
    "delivery_timeline_days",
    "missing_fields",
    "confidence",
  ],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// 5. Outbound email drafts (RFQ / clarification / negotiation)
// ---------------------------------------------------------------------------

export interface EmailDraft {
  subject: string;
  body: string;
}

export const emailDraftSchema: JsonSchema = {
  type: "object",
  properties: {
    subject: { type: "string" },
    body: {
      type: "string",
      description: "Plain-text email body. No markdown, no signatures.",
    },
  },
  required: ["subject", "body"],
  additionalProperties: false,
};
