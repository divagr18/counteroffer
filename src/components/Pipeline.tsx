import { AnimatePresence, motion } from "framer-motion";
import type { PipelineRow, Stage } from "../lib/types";
import { formatDuration, formatINR } from "../lib/format";
import { Badge } from "./ui";

const COLUMNS: { key: string; label: string; stages: Stage[] }[] = [
  { key: "discovered", label: "Discovered", stages: ["discovered"] },
  { key: "qualified", label: "Qualified", stages: ["qualified"] },
  { key: "contacted", label: "Contacted", stages: ["contacted"] },
  { key: "replied", label: "Replied", stages: ["replied"] },
  { key: "negotiating", label: "Negotiating", stages: ["negotiating"] },
  { key: "finalists", label: "Finalists", stages: ["finalist", "selected"] },
];

function VendorCard({
  row,
  onOpenThread,
  onOpenVendor,
  onSelectVendor,
}: {
  row: PipelineRow;
  onOpenThread?: () => void;
  onOpenVendor?: () => void;
  onSelectVendor?: () => void;
}) {
  const { cv, vendor, offer, firstOffer } = row;
  if (!vendor) return null;

  const dropped =
    offer && firstOffer && firstOffer.estimatedTotal > offer.estimatedTotal;
  const latency =
    cv.contactedAt && cv.repliedAt ? cv.repliedAt - cv.contactedAt : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="rounded-xl border border-line bg-surface p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onOpenVendor}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-ink hover:text-brand hover:underline"
          title={`${vendor.name} — open profile`}
        >
          {vendor.name}
        </button>
        {vendor.isDemoVendor && (
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-ink-faint">
            demo
          </span>
        )}
      </div>

      {offer ? (
        <div className="mt-2">
          {dropped ? (
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="tabular text-xs text-ink-faint line-through">
                {formatINR(firstOffer.estimatedTotal)}
              </span>
              <span className="text-[11px] text-brand">→</span>
              <motion.span
                key={offer.estimatedTotal}
                initial={{ backgroundColor: "rgba(16,185,129,0.35)" }}
                animate={{ backgroundColor: "rgba(16,185,129,0)" }}
                transition={{ duration: 1.2 }}
                className="tabular break-all rounded px-1 text-sm font-bold text-money"
              >
                {formatINR(offer.estimatedTotal)}
              </motion.span>
            </div>
          ) : (
            <motion.div
              key={offer.estimatedTotal}
              initial={{ backgroundColor: "rgba(16,185,129,0.35)" }}
              animate={{ backgroundColor: "rgba(16,185,129,0)" }}
              transition={{ duration: 1.2 }}
              className="tabular break-all rounded px-1 text-sm font-bold text-ink"
            >
              {formatINR(offer.estimatedTotal)}
            </motion.div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {cv.availability === true && (
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-money">
                Available ✓
              </span>
            )}
            {offer.missingFields.length > 0 && (
              <Badge tone="warn">missing {offer.missingFields.length}</Badge>
            )}
          </div>
        </div>
      ) : cv.stage === "eliminated" ? (
        <div className="mt-2 text-[11px] text-danger">
          {cv.eliminationReason ?? "eliminated"}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] text-ink-faint">
          {latency !== null && <span>replied in {formatDuration(latency)}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {cv.stage === "finalist" && onSelectVendor && (
            <button
              onClick={onSelectVendor}
              className="text-[11px] font-semibold text-money hover:underline"
            >
              Select
            </button>
          )}
          {row.thread && (
            <button
              onClick={onOpenThread}
              className="text-[11px] font-semibold text-brand hover:underline"
            >
              Thread
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function Pipeline({
  rows,
  onOpenThread,
  onOpenVendor,
  onSelectVendor,
}: {
  rows: PipelineRow[];
  onOpenThread?: (row: PipelineRow) => void;
  onOpenVendor?: (row: PipelineRow) => void;
  onSelectVendor?: (cvId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {COLUMNS.map((col) => {
        const items = rows.filter((r) => col.stages.includes(r.cv.stage));
        return (
          <div
            key={col.key}
            className="rounded-2xl border border-line bg-slate-50/60 p-2"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {col.label}
              </span>
              <span className="tabular rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-1">
              <AnimatePresence initial={false}>
                {items.map((row) => (
                  <VendorCard
                    key={row.cv._id}
                    row={row}
                    onOpenThread={() => onOpenThread?.(row)}
                    onOpenVendor={() => onOpenVendor?.(row)}
                    onSelectVendor={
                      onSelectVendor ? () => onSelectVendor(row.cv._id) : undefined
                    }
                  />
                ))}
              </AnimatePresence>
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-line px-2 py-4 text-center text-[11px] text-ink-faint">
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
