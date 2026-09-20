import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import type { PipelineRow } from "../lib/types";
import { explainRanking } from "../lib/explain";
import { formatDuration, formatINR, pct } from "../lib/format";
import { Badge, Button } from "./ui";

const STAGE_BADGE: Record<string, { label: string; tone: "neutral" | "brand" | "money" | "warn" }> = {
  replied: { label: "Replied", tone: "neutral" },
  negotiating: { label: "Negotiating", tone: "brand" },
  finalist: { label: "Finalist", tone: "money" },
  selected: { label: "Selected", tone: "money" },
  contacted: { label: "Awaiting reply", tone: "neutral" },
  eliminated: { label: "Eliminated", tone: "warn" },
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
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-ink-faint">
        Offers will appear here as vendors reply.
      </div>
    );
  }

  const best = ranked[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-semibold">Quote leaderboard</span>
        {best.offer && (
          <span className="text-[12px] text-ink-soft">
            Best offer{" "}
            <span className="tabular font-bold text-money">
              {formatINR(best.offer.estimatedTotal)}
            </span>
          </span>
        )}
      </div>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-2 font-semibold">Vendor</th>
            <th className="px-3 py-2 text-right font-semibold">Initial</th>
            <th className="px-3 py-2 text-right font-semibold">Current</th>
            <th className="px-3 py-2 text-right font-semibold">Requirements</th>
            <th className="px-3 py-2 text-right font-semibold">Response</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, index) => {
            const offer = row.offer!;
            const first = row.firstOffer ?? offer;
            const dropped = first.estimatedTotal > offer.estimatedTotal;
            const latency =
              row.cv.contactedAt && row.cv.repliedAt
                ? row.cv.repliedAt - row.cv.contactedAt
                : null;
            const badge = STAGE_BADGE[row.cv.stage] ?? {
              label: row.cv.stage,
              tone: "neutral" as const,
            };
            const coverage =
              requiredCount > 0
                ? Math.min(row.cv.satisfiedRequirements.length, requiredCount) /
                  requiredCount
                : 1;
            const bullets = explainRanking(row, best, requiredCount);
            return (
              <Fragment key={row.cv._id}>
                <motion.tr
                  layout
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className={`border-b border-line/60 last:border-0 ${
                    index === 0 ? "bg-emerald-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {index === 0 && <span title="Best offer">🏆</span>}
                      <div>
                        <div className="font-semibold text-ink">
                          {row.vendor?.name ?? "—"}
                        </div>
                        {offer.missingFields.length > 0 && (
                          <div className="text-[11px] text-warn">
                            missing: {offer.missingFields.slice(0, 2).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-faint">
                    {formatINR(first.estimatedTotal)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    <motion.span
                      key={offer.estimatedTotal}
                      initial={{ backgroundColor: "rgba(16,185,129,0.35)" }}
                      animate={{ backgroundColor: "rgba(16,185,129,0)" }}
                      transition={{ duration: 1.2 }}
                      className={`rounded px-1 ${
                        dropped ? "font-bold text-money" : "font-semibold text-ink"
                      }`}
                    >
                      {formatINR(offer.estimatedTotal)}
                    </motion.span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">
                    <span
                      className={
                        coverage === 1 ? "font-semibold text-money" : "text-warn"
                      }
                    >
                      {pct(coverage)}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-ink-soft">
                    {latency !== null ? formatDuration(latency) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      {row.cv.stage === "finalist" && onSelectVendor && (
                        <Button
                          variant="secondary"
                          onClick={() => onSelectVendor(row.cv._id)}
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() =>
                        setExpanded(expanded === row.cv._id ? null : row.cv._id)
                      }
                      className="text-[11px] text-ink-faint underline hover:text-ink-soft"
                    >
                      why?
                    </button>
                  </td>
                </motion.tr>
                {expanded === row.cv._id && (
                  <tr className="border-b border-line/60 bg-slate-50/60">
                    <td colSpan={7} className="px-6 py-2">
                      <ul className="space-y-0.5 text-[12px] text-ink-soft">
                        {bullets.map((b, i) => (
                          <li key={i}>• {b}</li>
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
      <div className="border-t border-line bg-slate-50/60 px-4 py-2 text-[11px] text-ink-faint">
        Ranked by offer score — price fit, requirement coverage, completeness,
        availability and responsiveness. Cheaper but incomplete offers do not
        automatically win.
      </div>
    </div>
  );
}
