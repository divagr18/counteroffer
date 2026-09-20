// AgentMail v0 client helper for Convex actions (raw fetch — no SDK).
// Powers per-campaign inboxes, outbound RFQs, replies, thread reads and
// webhook registration (doc §11, §34).

import { fetchWithRetry, requireEnv } from "./lib/httpUtil";

const BASE = "https://api.agentmail.to/v0";

interface AgentMailResponse<T> {
  data?: T;
  [key: string]: unknown;
}

function headers(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

// ---------------------------------------------------------------------------
// Inboxes
// ---------------------------------------------------------------------------

export interface AgentMailInbox {
  inboxId: string;
  email: string;
}

/** Create one inbox per campaign. client_id makes the call idempotent. */
export async function createInbox(opts: {
  username: string;
  displayName: string;
  clientId: string;
  metadata?: Record<string, string>;
}): Promise<AgentMailInbox> {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");

  const res = await fetchWithRetry(
    `${BASE}/inboxes`,
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        username: opts.username,
        display_name: opts.displayName,
        client_id: opts.clientId,
        metadata: opts.metadata ?? {},
      }),
    },
    { label: "AgentMail createInbox" },
  );

  const body = (await res.json()) as AgentMailResponse<{
    inbox_id?: string;
    email?: string;
  }>;
  const data = body.data ?? {};
  const inboxId = data.inbox_id;
  const email = data.email;
  if (!inboxId || !email) {
    throw new Error(
      `AgentMail createInbox: unexpected response ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return { inboxId, email };
}

// ---------------------------------------------------------------------------
// Webhooks (inbound notifications)
// ---------------------------------------------------------------------------

export interface AgentMailWebhook {
  webhookId: string;
  secret: string;
}

/**
 * Register a webhook for inbound mail events. The returned secret is used to
 * verify Svix signatures on deliveries.
 */
export async function registerWebhook(opts: {
  inboxId: string;
  url: string;
  eventTypes?: string[];
  clientId: string;
}): Promise<AgentMailWebhook> {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");

  const res = await fetchWithRetry(
    `${BASE}/inboxes/${opts.inboxId}/webhooks`,
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        url: opts.url,
        event_types: opts.eventTypes ?? [
          "message.received",
          "message.bounced",
        ],
        client_id: opts.clientId,
      }),
    },
    { label: "AgentMail registerWebhook" },
  );

  const body = (await res.json()) as AgentMailResponse<{
    webhook_id?: string;
    secret?: string;
  }>;
  const data = body.data ?? {};
  const webhookId = data.webhook_id;
  const secret = data.secret;
  if (!webhookId || !secret) {
    throw new Error(
      `AgentMail registerWebhook: unexpected response ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return { webhookId, secret };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface AgentMailMessageRef {
  messageId: string;
  threadId: string;
}

/** Send an outbound message (RFQ / follow-up / counteroffer). */
export async function sendMessage(opts: {
  inboxId: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  labels?: string[];
}): Promise<AgentMailMessageRef> {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");

  const res = await fetchWithRetry(
    `${BASE}/inboxes/${opts.inboxId}/messages/send`,
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html ?? `<p>${escapeHtml(opts.text).replace(/\n/g, "<br/>")}</p>`,
        labels: opts.labels ?? [],
      }),
    },
    { label: "AgentMail sendMessage" },
  );

  const body = (await res.json()) as AgentMailResponse<{
    message_id?: string;
    thread_id?: string;
  }>;
  const data = body.data ?? {};
  if (!data.message_id || !data.thread_id) {
    throw new Error(
      `AgentMail sendMessage: unexpected response ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return { messageId: data.message_id, threadId: data.thread_id };
}

/** Reply within an existing thread (subject inherited automatically). */
export async function replyToMessage(opts: {
  inboxId: string;
  messageId: string;
  text: string;
  html?: string;
}): Promise<AgentMailMessageRef> {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");

  const res = await fetchWithRetry(
    `${BASE}/inboxes/${opts.inboxId}/messages/${opts.messageId}/reply`,
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        text: opts.text,
        html: opts.html ?? `<p>${escapeHtml(opts.text).replace(/\n/g, "<br/>")}</p>`,
      }),
    },
    { label: "AgentMail replyToMessage" },
  );

  const body = (await res.json()) as AgentMailResponse<{
    message_id?: string;
    thread_id?: string;
  }>;
  const data = body.data ?? {};
  if (!data.message_id || !data.thread_id) {
    throw new Error(
      `AgentMail replyToMessage: unexpected response ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return { messageId: data.message_id, threadId: data.thread_id };
}

// ---------------------------------------------------------------------------
// Threads / reading
// ---------------------------------------------------------------------------

export interface AgentMailMessage {
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  extractedText: string | null;
  timestamp: string;
  inReplyTo: string | null;
}

export interface AgentMailThread {
  threadId: string;
  subject: string;
  messageCount: number;
  messages: AgentMailMessage[];
}

/** Fetch a full thread with all messages (fallback when webhook body is trimmed). */
export async function getThread(opts: {
  inboxId: string;
  threadId: string;
}): Promise<AgentMailThread | null> {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");

  const res = await fetchWithRetry(
    `${BASE}/inboxes/${opts.inboxId}/threads/${opts.threadId}`,
    { method: "GET", headers: headers(apiKey) },
    { label: "AgentMail getThread" },
  );

  const body = (await res.json()) as AgentMailResponse<{
    thread_id?: string;
    subject?: string;
    message_count?: number;
    messages?: {
      message_id?: string;
      thread_id?: string;
      from?: string;
      to?: string[];
      subject?: string;
      text?: string;
      extracted_text?: string;
      timestamp?: string;
      in_reply_to?: string;
    }[];
  }>;
  const data = body.data;
  if (!data?.thread_id) return null;

  return {
    threadId: data.thread_id,
    subject: data.subject ?? "",
    messageCount: data.message_count ?? data.messages?.length ?? 0,
    messages: (data.messages ?? []).map((m) => ({
      messageId: m.message_id ?? "",
      threadId: m.thread_id ?? data.thread_id ?? "",
      from: m.from ?? "",
      to: m.to ?? [],
      subject: m.subject ?? "",
      text: m.text ?? "",
      extractedText: m.extracted_text ?? null,
      timestamp: m.timestamp ?? "",
      inReplyTo: m.in_reply_to ?? null,
    })),
  };
}

/**
 * List recent inbound messages for an inbox (cron polling fallback so a
 * missed webhook never stalls a campaign).
 */
export async function listInboundMessages(opts: {
  inboxId: string;
  limit?: number;
  after?: string;
}): Promise<AgentMailMessage[]> {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");

  const params = new URLSearchParams();
  params.set("labels", "received");
  params.set("limit", String(opts.limit ?? 20));
  if (opts.after) params.set("after", opts.after);

  const res = await fetchWithRetry(
    `${BASE}/inboxes/${opts.inboxId}/messages?${params.toString()}`,
    { method: "GET", headers: headers(apiKey) },
    { label: "AgentMail listInboundMessages" },
  );

  const body = (await res.json()) as AgentMailResponse<{
    messages?: {
      message_id?: string;
      thread_id?: string;
      from?: string;
      to?: string[];
      subject?: string;
      preview?: string;
      timestamp?: string;
      in_reply_to?: string;
    }[];
  }>;

  return (body.data?.messages ?? []).map((m) => ({
    messageId: m.message_id ?? "",
    threadId: m.thread_id ?? "",
    from: m.from ?? "",
    to: m.to ?? [],
    subject: m.subject ?? "",
    // List responses only carry preview; callers needing full text must
    // fetch the thread/message explicitly.
    text: m.preview ?? "",
    extractedText: null,
    timestamp: m.timestamp ?? "",
    inReplyTo: m.in_reply_to ?? null,
  }));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
