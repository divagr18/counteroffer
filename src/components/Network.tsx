import type { NetworkEntry, UserMemory } from "../lib/types";
import { formatDuration, formatINR, pct } from "../lib/format";
import { Badge, Card, SectionLabel } from "./ui";

export function Network({
  entries,
  memory,
  onOpenVendor,
}: {
  entries: NetworkEntry[];
  memory: UserMemory | null | undefined;
  onOpenVendor?: (vendorId: string) => void;
}) {
  const categories = [...new Set(entries.map((e) => e.vendor.category))];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <Card className="p-5">
        <SectionLabel>Your procurement memory</SectionLabel>
        {!memory || memory.totalSelections === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            Finish a campaign and select a vendor to start building your
            private supplier intelligence.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            <li>
              • You've selected vendors {memory.totalSelections}× across{" "}
              {memory.categoryCounts
                .map((c) => `${c.category} (${c.count})`)
                .join(", ")}
              .
            </li>
            {memory.nonCheapestSelections > 0 && (
              <li>
                • In {memory.nonCheapestSelections} of {memory.totalSelections}{" "}
                you picked a finalist that wasn't the cheapest — you trade
                price for completeness.
              </li>
            )}
            {memory.medianSelectedResponseMs !== null && (
              <li>
                • Your chosen vendors reply in a median of{" "}
                {formatDuration(memory.medianSelectedResponseMs)}.
              </li>
            )}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <SectionLabel>Supplier network</SectionLabel>
        {categories.map((cat) => (
          <div key={cat} className="mt-4">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              {cat}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {entries
                .filter((e) => e.vendor.category === cat)
                .map((e) => (
                  <Card key={e.vendor._id} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => onOpenVendor?.(e.vendor._id)}
                        className="min-w-0 truncate text-left text-sm font-semibold text-ink hover:text-brand hover:underline"
                      >
                        {e.vendor.name}
                      </button>
                      {e.vendor.isDemoVendor && <Badge>demo</Badge>}
                    </div>
                    {e.metrics ? (
                      <div className="mt-3 space-y-1 text-[12px] text-ink-soft">
                        <div className="flex justify-between">
                          <span>Reply rate</span>
                          <span className="tabular font-semibold text-ink">
                            {pct(
                              e.metrics.replies /
                                Math.max(1, e.metrics.timesContacted),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Median response</span>
                          <span className="tabular font-semibold text-ink">
                            {e.metrics.medianResponseMs !== undefined
                              ? formatDuration(e.metrics.medianResponseMs)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Initial → final quote</span>
                          <span className="tabular font-semibold text-ink">
                            {e.metrics.medianInitialQuote !== undefined &&
                            e.metrics.medianFinalQuote !== undefined
                              ? `${formatINR(e.metrics.medianInitialQuote)} → ${formatINR(e.metrics.medianFinalQuote)}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Typical discount</span>
                          <span className="tabular font-semibold text-money">
                            {e.metrics.typicalDiscountPct !== undefined
                              ? `${e.metrics.typicalDiscountPct}%`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Your rating</span>
                          <span className="tabular font-semibold text-ink">
                            {e.metrics.userRating !== undefined
                              ? `${e.metrics.userRating}★`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-[12px] text-ink-faint">
                        No interaction history yet.
                      </p>
                    )}
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
