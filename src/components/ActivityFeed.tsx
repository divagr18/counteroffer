import type { CampaignEvent } from "../lib/types";
import { formatClock, timeAgo } from "../lib/format";

const EVENT_ICONS: Record<string, string> = {
  "campaign.created": "✨",
  "discovery.planned": "🧭",
  "vendor.discovered": "🔎",
  "vendor.merged": "🔗",
  "vendor.qualified": "✅",
  "vendor.rejected": "⛔",
  "outreach.sent": "📤",
  "message.received": "📩",
  "offer.extracted": "💰",
  "offer.revised": "💰",
  "clarification.sent": "❓",
  "negotiation.counter": "🤝",
  "offer.within_target": "🎯",
  "vendor.selected": "🏆",
};

export function ActivityFeed({ events }: { events: CampaignEvent[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-semibold">Activity</span>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-money">
          <span className="h-1.5 w-1.5 rounded-full bg-money animate-pulse-dot" />
          live
        </span>
      </div>
      <div className="max-h-[480px] overflow-y-auto px-2 py-2">
        {events.map((event, i) => (
          <div
            key={`${event._id ?? i}`}
            className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50"
          >
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs">
              {EVENT_ICONS[event.type] ?? "•"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] leading-snug text-ink">{event.summary}</div>
              <div className="tabular text-[11px] text-ink-faint">
                {formatClock(event.createdAt)} · {timeAgo(event.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
