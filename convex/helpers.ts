// Plain helper functions shared across Convex modules (no Convex function
// definitions here, so this module stays out of the generated api).
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Append an immutable event to the campaign timeline. */
export async function recordEvent(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  type: string,
  summary: string,
  campaignVendorId?: Id<"campaignVendors">,
  payload?: unknown,
): Promise<void> {
  await ctx.db.insert("campaignEvents", {
    campaignId,
    campaignVendorId,
    type,
    summary,
    payload,
    createdAt: Date.now(),
  });
}

/** Insert an agent action audit row; returns its id. */
export async function logAgentAction(
  ctx: MutationCtx,
  campaignId: Id<"campaigns">,
  type: string,
  summary: string,
  campaignVendorId?: Id<"campaignVendors">,
): Promise<Id<"agentActions">> {
  return await ctx.db.insert("agentActions", {
    campaignId,
    campaignVendorId,
    type,
    status: "done",
    summary,
    createdAt: Date.now(),
    finishedAt: Date.now(),
  });
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

// --- base64 helpers (environment-independent, used for Svix verification) ---

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/=+$/, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const value = B64_CHARS.indexOf(ch);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      result += B64_CHARS[(buffer >> bits) & 63];
    }
  }
  if (bits > 0) {
    result += B64_CHARS[(buffer << (6 - bits)) & 63];
  }
  while (result.length % 4 !== 0) result += "=";
  return result;
}

/** Constant-time-ish string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function domainOfUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function domainOfEmail(email: string): string | null {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[1]) return null;
  return parts[1].replace(/^www\./, "");
}

export function randomSlug(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
