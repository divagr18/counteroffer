import type { Evidence, Vendor, VendorMetrics } from "../lib/types";
import { formatDuration, formatINR } from "../lib/format";
import { Badge, Card, SectionLabel } from "./ui";

export function VendorProfile({
  vendor,
  metrics,
  evidence = [],
}: {
  vendor: Vendor;
  metrics: VendorMetrics | null;
  evidence?: Evidence[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{vendor.name}</h2>
            {vendor.isDemoVendor && <Badge tone="neutral">demo vendor</Badge>}
          </div>
          <div className="mt-1 text-sm text-ink-soft">
            {vendor.website ?? "—"} · {vendor.locations.join(", ")}
          </div>
          <div className="mt-1 text-[12px] text-ink-faint">
            {vendor.services.join(" · ")}
          </div>
        </div>
        {metrics?.userRating && (
          <div className="rounded-2xl border border-line bg-surface px-4 py-2 text-center">
            <div className="tabular text-xl font-bold text-amber-500">
              {metrics.userRating.toFixed(1)}★
            </div>
            <div className="text-[10px] uppercase tracking-wide text-ink-faint">
              your rating
            </div>
          </div>
        )}
      </div>

      <Card className="mt-6 p-5">
        <SectionLabel>Private supplier intelligence</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Metric label="Campaigns seen" value={String(metrics?.campaignsSeen ?? 1)} />
          <Metric label="Reply rate" value={metrics && metrics.timesContacted > 0 ? `${Math.round((metrics.replies / metrics.timesContacted) * 100)}%` : "—"} />
          <Metric label="Median response" value={metrics?.medianResponseMs ? formatDuration(metrics.medianResponseMs) : "—"} />
          <Metric label="Avg initial quote" value={metrics?.medianInitialQuote ? formatINR(metrics.medianInitialQuote) : "—"} />
          <Metric label="Avg final quote" value={metrics?.medianFinalQuote ? formatINR(metrics.medianFinalQuote) : "—"} accent />
          <Metric label="Typical discount" value={metrics?.typicalDiscountPct ? `${metrics.typicalDiscountPct.toFixed(1)}%` : "—"} accent />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
          This history is compiled from every campaign where this vendor was
          contacted. Future campaigns rank them using real quote behaviour, not
          public marketing.
        </p>
      </Card>

      {evidence.length > 0 && (
        <Card className="mt-4 p-5">
          <SectionLabel>Evidence (from crawled pages)</SectionLabel>
          <ul className="mt-3 space-y-2">
            {evidence.map((ev, i) => (
              <li key={i} className="rounded-xl bg-slate-50 px-3 py-2">
                <div className="text-[13px] font-medium text-ink">{ev.claim}</div>
                <div className="mt-0.5 truncate text-[11px] text-ink-faint">
                  source: {ev.sourceUrl}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
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
      <div className={`tabular text-lg font-bold ${accent ? "text-brand" : "text-ink"}`}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
    </div>
  );
}
