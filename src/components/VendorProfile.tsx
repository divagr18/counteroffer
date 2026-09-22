import type { Evidence, Vendor, VendorMetrics } from "../lib/types";
import { formatDuration, formatINR } from "../lib/format";
import { Badge, Num, Panel } from "./ui";

export function VendorProfile({
  vendor,
  metrics,
  evidence = [],
}: {
  vendor: Vendor;
  metrics: VendorMetrics | null;
  evidence?: Evidence[];
}) {
  const replyRate =
    metrics && metrics.timesContacted > 0
      ? metrics.replies / metrics.timesContacted
      : null;

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">
              {vendor.name}
            </h1>
            {vendor.isDemoVendor ? (
              <Badge>scripted demo vendor</Badge>
            ) : (
              <Badge tone="money">real mailbox</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[12.5px] text-ink-soft">
            {vendor.website && <span>{vendor.website}</span>}
            {vendor.locations.length > 0 && (
              <span>{vendor.locations.join(", ")}</span>
            )}
          </div>
          {vendor.services.length > 0 && (
            <div className="mt-1 text-[12px] text-ink-faint">
              {vendor.services.join(" · ")}
            </div>
          )}
        </div>
        {metrics?.userRating !== undefined && (
          <div className="rounded-md border border-line px-3.5 py-2 text-center">
            <Num className="text-[18px] font-semibold text-ink">
              {metrics.userRating.toFixed(1)}
            </Num>
            <div className="text-[10.5px] text-ink-faint">your rating</div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="How they have actually behaved" bodyClassName="p-3.5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Metric
              label="campaigns seen"
              value={String(metrics?.campaignsSeen ?? 1)}
            />
            <Metric
              label="reply rate"
              value={replyRate !== null ? `${Math.round(replyRate * 100)}%` : "—"}
            />
            <Metric
              label="usual reply time"
              value={
                metrics?.medianResponseMs
                  ? formatDuration(metrics.medianResponseMs)
                  : "—"
              }
            />
            <Metric
              label="usual opening quote"
              value={
                metrics?.medianInitialQuote
                  ? formatINR(metrics.medianInitialQuote)
                  : "—"
              }
            />
            <Metric
              label="usual final quote"
              value={
                metrics?.medianFinalQuote
                  ? formatINR(metrics.medianFinalQuote)
                  : "—"
              }
              accent
            />
            <Metric
              label="how far they move"
              value={
                metrics?.typicalDiscountPct
                  ? `${metrics.typicalDiscountPct.toFixed(1)}%`
                  : "—"
              }
              accent
            />
          </dl>
          <p className="mt-3.5 border-t border-line-soft pt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
            Built from every campaign where this vendor was contacted. The next
            campaign ranks them on this, not on their own marketing.
          </p>
        </Panel>

        {evidence.length > 0 && (
          <Panel title="Where these claims came from" bodyClassName="p-2.5" scroll>
            <ul className="flex flex-col gap-1.5">
              {evidence.map((ev, i) => (
                <li key={i} className="rounded-md bg-soft px-3 py-2">
                  <div className="text-[12.5px] text-ink">{ev.claim}</div>
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-0.5 block truncate font-mono text-[10.5px] text-ink-faint hover:text-brand"
                  >
                    {ev.sourceUrl}
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <Num
        className={`text-[16px] font-semibold ${accent ? "text-money" : "text-ink"}`}
      >
        {value}
      </Num>
      <div className="mt-0.5 text-[11px] text-ink-faint">{label}</div>
    </div>
  );
}
