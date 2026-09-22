import type { CampaignEvent } from "../lib/types";
import { formatClock, timeAgo } from "../lib/format";

/**
 * Each event type gets a colour rather than an icon: the feed reads as a tape
 * of what the agent did, and colour carries whether it was an action, an
 * arrival, money, or a refusal.
 */
function toneFor(type: string): string {
  if (type.startsWith("offer") || type === "negotiation.target_met") {
    return "bg-money";
  }
  if (
    type.startsWith("outreach") ||
    type.startsWith("negotiation") ||
    type.startsWith("clarification") ||
    type.startsWith("follow_up")
  ) {
    return "bg-brand";
  }
  if (
    type.startsWith("vendor.rejected") ||
    type.startsWith("vendor.eliminated") ||
    type.endsWith("throttled") ||
    type.endsWith("failed")
  ) {
    return "bg-warn";
  }
  if (type.startsWith("approval")) return "bg-brand";
  return "bg-line";
}

export function ActivityFeed({ events }: { events: CampaignEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="px-2 py-8 text-center text-[12px] text-ink-faint">
        Nothing yet. Every step the agent takes shows up here.
      </div>
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, i) => (
        <li
          key={`${event._id ?? i}`}
          className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-soft"
        >
          <span
            aria-hidden
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${toneFor(event.type)}`}
          />
          <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-soft">
            {event.summary}
          </span>
          <time
            className="tabular shrink-0 text-[10.5px] text-ink-faint"
            title={formatClock(event.createdAt)}
          >
            {timeAgo(event.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}
