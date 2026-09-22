import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import type { PipelineRow } from "../lib/types";
import { explainRanking } from "../lib/explain";
import { formatDuration, formatINR, pct } from "../lib/format";
import { Badge, Meter, Num } from "./ui";

const STAGE_BADGE: Record<
  string,
  { label: string; tone: "neutral" | "brand" | "money" | "warn" }
> = {
  replied: { label: "Replied", tone: "neutral" },
  negotiating: { label: "Negotiating", tone: "brand" },
  finalist: { label: "Finalist", tone: "money" },
  selected: { label: "Chosen", tone: "money" },
  contacted: { label: "Waiting", tone: "neutral" },
  eliminated: { label: "Out", tone: "warn" },
};

export function Leaderboard({
  rows,
  requiredCount,
  onSelectVendor,
}: {
  rows: PipelineRow[];
  requiredCount: number;
  onSelectVendor?: (cvId: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const ranked = rows
    .filter((r) => r.offer)
    .sort((a, b) => (b.cv.offerScore ?? -1) - (a.cv.offerScore ?? -1));

  if (ranked.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-[13px] text-ink-faint">
        No quotes yet. They land here the moment a vendor replies.
      </div>
    );
  }

  const best = ranked[0];

  return (
    <div className="flex h-full flex-col">
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-line font-mono text-[11px] text-ink-faint">
            <th className="w-8 py-2 pl-3.5 pr-1 text-right font-medium">#</th>
            <th className="px-3 py-2 font-medium">Vendor</th>
            <th className="px-3 py-2 text-right font-medium">Opening</th>
            <th className="px-3 py-2 text-right font-medium">Now</th>
            <th className="px-3 py-2 text-right font-medium">Change</th>
            <th className="px-3 py-2 text-right font-medium">Requirements</th>
            <th className="px-3 py-2 font-medium">Quote complete</th>
            <th className="px-3 py-2 text-right font-medium">Replied in</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, index) => {
            const offer = row.offer!;
            const first = row.firstOffer ?? offer;
            const delta = offer.estimatedTotal - first.estimatedTotal;
            const latency =
              row.cv.contactedAt && row.cv.repliedAt
                ? row.cv.repliedAt - row.cv.contactedAt
                : null;
            const badge = STAGE_BADGE[row.cv.stage] ?? {
              label: row.cv.stage,
              tone: "neutral" as const,
            };
            const satisfied = Math.min(
              row.cv.satisfiedRequirements.length,
              requiredCount,
            );
            const coverage = requiredCount > 0 ? satisfied / requiredCount : 1;
            const bullets = explainRanking(row, best, requiredCount);
            const isOpen = expanded === row.cv._id;

            return (
              <Fragment key={row.cv._id}>
                <motion.tr
                  layout
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className={`border-b border-line-soft last:border-0 ${
                    index === 0 ? "bg-money-soft/60" : "hover:bg-soft"
                  }`}
                >
                  <td className="py-2.5 pl-3.5 pr-1 text-right">
                    <Num
                      className={`text-[11px] ${index === 0 ? "font-semibold text-money" : "text-ink-faint"}`}
                    >
                      {index + 1}
                    </Num>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-ink">
                        {row.vendor?.name ?? "—"}
                      </span>
                      {row.vendor?.isDemoVendor && (
                        <span
                          title="Scripted demo vendor"
                          className="font-mono text-[9px] text-ink-faint"
                        >
                          demo
                        </span>
                      )}
                    </div>
                    {offer.missingFields.length > 0 && (
                      <div className="mt-0.5 text-[11px] text-warn">
                        still unanswered: {offer.missingFields.slice(0, 2).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Num className="text-ink-faint">
                      {formatINR(first.estimatedTotal)}
                    </Num>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <motion.span
                      key={offer.estimatedTotal}
                      initial={{ backgroundColor: "#fff3eb" }}
                      animate={{ backgroundColor: "rgba(0,0,0,0)" }}
                      transition={{ duration: 1.2 }}
                      className={`tabular rounded px-1 font-semibold ${
                        delta < 0 ? "text-money" : "text-ink"
                      }`}
                    >
                      {formatINR(offer.estimatedTotal)}
                    </motion.span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {delta < 0 ? (
                      <Num className="text-money">−{formatINR(-delta)}</Num>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Num
                      className={
                        coverage === 1 ? "text-money" : "text-warn"
                      }
                    >
                      {satisfied}/{requiredCount}
                    </Num>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Meter value={offer.completenessScore} />
                      <Num className="text-[11px] text-ink-faint">
                        {pct(offer.completenessScore)}
                      </Num>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Num className="text-ink-soft">
                      {latency !== null ? formatDuration(latency) : "—"}
                    </Num>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      {row.cv.stage === "finalist" && onSelectVendor && (
                        <button
                          onClick={() => onSelectVendor(row.cv._id)}
                          className="text-[11px] font-medium text-money hover:underline"
                        >
                          Choose
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setExpanded(isOpen ? null : row.cv._id)}
                      aria-expanded={isOpen}
                      className="text-[11px] text-ink-faint underline decoration-line hover:text-ink-soft"
                    >
                      {isOpen ? "hide" : "why?"}
                    </button>
                  </td>
                </motion.tr>
                {isOpen && (
                  <tr className="border-b border-line-soft bg-soft">
                    <td />
                    <td colSpan={9} className="px-3 py-2">
                      <ul className="space-y-0.5 text-[12px] text-ink-soft">
                        {bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-line-soft px-3.5 py-2 text-[11px] text-ink-faint">
        Ranked on price fit, requirement coverage, how complete the quote is,
        confirmed availability and reply speed. A cheaper quote with gaps in it
        does not win.
      </p>
    </div>
  );
}
