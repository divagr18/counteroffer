import type { NetworkEntry, UserMemory } from "../lib/types";
import { formatDuration, formatINR, pct } from "../lib/format";
import { Badge, Num, Panel } from "./ui";

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
    <div className="grid grid-cols-1 items-start gap-3 p-3 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Panel
        title="What it has learned about you"
        bodyClassName="p-3.5"
        className="xl:sticky xl:top-3"
      >
        {!memory || memory.totalSelections === 0 ? (
          <p className="text-[13px] text-ink-soft">
            Finish a campaign and choose a vendor. From then on it knows how you
            actually decide.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
            <li>
              You have chosen a vendor{" "}
              <Num className="font-medium text-ink">{memory.totalSelections}</Num>{" "}
              times, across{" "}
              {memory.categoryCounts
                .map((c) => `${c.category} (${c.count})`)
                .join(", ")}
              .
            </li>
            {memory.nonCheapestSelections > 0 && (
              <li>
                In{" "}
                <Num className="font-medium text-ink">
                  {memory.nonCheapestSelections}
                </Num>{" "}
                of them you passed on the cheapest quote, so it weights a
                complete quote over a low one.
              </li>
            )}
            {memory.medianSelectedResponseMs !== null && (
              <li>
                The vendors you pick reply in about{" "}
                <Num className="font-medium text-ink">
                  {formatDuration(memory.medianSelectedResponseMs)}
                </Num>
                .
              </li>
            )}
          </ul>
        )}
      </Panel>

      <div className="flex min-w-0 flex-col gap-3">
      {entries.length === 0 ? (
        <Panel title="Suppliers" bodyClassName="p-8">
          <p className="text-center text-[13px] text-ink-faint">
            No suppliers yet. Run a campaign and everyone it contacts lands here.
          </p>
        </Panel>
      ) : (
        categories.map((cat) => {
          const inCategory = entries.filter((e) => e.vendor.category === cat);
          return (
            <Panel
              key={cat}
              title={<span className="first-letter:uppercase">{cat}</span>}
              aside={
                <span className="text-[11.5px] text-ink-faint">
                  <Num>{inCategory.length}</Num> suppliers
                </span>
              }
              bodyClassName="p-0"
            >
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line font-mono text-[11px] text-ink-faint">
                    <th className="px-3.5 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 text-right font-medium">Replies</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Usual reply time
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Opening → final
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Movement</th>
                    <th className="px-3 py-2 text-right font-medium">Chosen</th>
                    <th className="px-3 py-2 text-right font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {inCategory.map((e) => {
                    const m = e.metrics;
                    return (
                      <tr
                        key={e.vendor._id}
                        onClick={() => onOpenVendor?.(e.vendor._id)}
                        className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-soft"
                      >
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-ink">
                              {e.vendor.name}
                            </span>
                            {e.vendor.isDemoVendor && (
                              <span className="font-mono text-[9px] text-ink-faint">
                                demo
                              </span>
                            )}
                            {!e.vendor.isDemoVendor && (
                              <Badge tone="money">real</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Num className="text-ink-soft">
                            {m
                              ? pct(m.replies / Math.max(1, m.timesContacted))
                              : "—"}
                          </Num>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Num className="text-ink-soft">
                            {m?.medianResponseMs !== undefined
                              ? formatDuration(m.medianResponseMs)
                              : "—"}
                          </Num>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {m?.medianInitialQuote !== undefined &&
                          m?.medianFinalQuote !== undefined ? (
                            <Num className="text-ink">
                              {formatINR(m.medianInitialQuote)} →{" "}
                              {formatINR(m.medianFinalQuote)}
                            </Num>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Num className="font-medium text-money">
                            {m?.typicalDiscountPct !== undefined
                              ? `${m.typicalDiscountPct}%`
                              : "—"}
                          </Num>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Num className="text-ink-soft">
                            {m?.timesSelected ?? 0}
                          </Num>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Num className="text-ink-soft">
                            {m?.userRating !== undefined
                              ? m.userRating.toFixed(1)
                              : "—"}
                          </Num>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Panel>
          );
        })
      )}
      </div>
    </div>
  );
}
