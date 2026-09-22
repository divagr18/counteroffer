import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpAction } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { base64ToBytes, bytesToBase64, safeEqual } from "./helpers";

const http = httpRouter();

async function verifySvixSignature(
  secret: string,
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const keyMaterial = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;

  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(keyMaterial);
  } catch {
    return false;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const payload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(payload),
  );
  const computed = bytesToBase64(new Uint8Array(signatureBuffer));

  return svixSignature.split(" ").some((entry) => {
    const [version, digest] = entry.split(",");
    return version === "v1" && digest !== undefined && safeEqual(digest, computed);
  });
}

http.route({
  path: "/agentmail-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();

    let payload: {
      event_type?: string;
      message?: {
        inbox_id?: string;
        thread_id?: string;
        message_id?: string;
        from?: string;
        to?: string[];
        subject?: string;
        text?: string;
        extracted_text?: string;
        timestamp?: string;
      };
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("invalid JSON", { status: 400 });
    }

    const inboxId = payload.message?.inbox_id;
    if (!inboxId) return new Response("missing inbox_id", { status: 400 });

    const mailbox = await ctx.runQuery(internal.campaigns.mailboxByInboxId, {
      inboxId,
    });
    if (!mailbox) return new Response("unknown inbox", { status: 404 });

    if (mailbox.webhookSecret) {
      const valid = await verifySvixSignature(
        mailbox.webhookSecret,
        request.headers,
        rawBody,
      );
      if (!valid) return new Response("invalid signature", { status: 401 });
    }

    const eventType = payload.event_type;
    const message = payload.message;
    if (eventType !== "message.received" || !message) {
      return new Response(null, { status: 200 });
    }

    await ctx.runAction(internal.agents.processInbound, {
      campaignId: mailbox.campaignId,
      externalThreadId: message.thread_id,
      externalMessageId: message.message_id,
      fromAddress: message.from ?? "",
      subject: message.subject ?? "",
      text: message.text ?? "",
      extractedText: message.extracted_text,
      timestamp: message.timestamp ? Date.parse(message.timestamp) : undefined,
    });

    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/agentmail-webhook",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, svix-id, svix-timestamp, svix-signature",
      }),
    });
  }),
});

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
    });
  }),
});

// The built frontend, served from this same deployment at
// https://<deployment>.convex.site. Registered LAST: the exact routes above
// (the AgentMail webhook and /health) win over the static catch-all, so the
// webhook URL registered with AgentMail never moves.
registerStaticRoutes(http, components.staticHosting);

export default http;
