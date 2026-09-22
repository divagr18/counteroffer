import { AnimatePresence, motion } from "framer-motion";
import type { PipelineRow, Stage } from "../lib/types";
import { formatDuration, formatINR } from "../lib/format";
import { Num } from "./ui";

const COLUMNS: { key: string; label: string; stages: Stage[] }[] = [
  { key: "discovered", label: "Found", stages: ["discovered"] },
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
  const isFinalist = cv.stage === "finalist" || cv.stage === "selected";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={`rounded-md border bg-surface px-2.5 py-2 ${
        isFinalist ? "border-money/40" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <button
          onClick={onOpenVendor}
          className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium text-ink hover:text-brand"
          title={`${vendor.name} — open profile`}
        >
          {vendor.name}
        </button>
        {vendor.isDemoVendor && (
          <span
            title="Scripted demo vendor"
            className="shrink-0 font-mono text-[9px] text-ink-faint"
          >
            demo
          </span>
        )}
      </div>

      {offer ? (
        <div className="mt-1.5">
          {dropped ? (
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <Num className="text-[11px] text-ink-faint line-through">
                {formatINR(firstOffer.estimatedTotal)}
              </Num>
              <motion.span
                key={offer.estimatedTotal}
                initial={{ backgroundColor: "#fff3eb" }}
                animate={{ backgroundColor: "rgba(0,0,0,0)" }}
                transition={{ duration: 1.2 }}
                className="tabular rounded px-0.5 text-[13px] font-semibold text-money"
              >
                {formatINR(offer.estimatedTotal)}
              </motion.span>
            </div>
          ) : (
            <motion.div
              key={offer.estimatedTotal}
              initial={{ backgroundColor: "#fff3eb" }}
              animate={{ backgroundColor: "rgba(0,0,0,0)" }}
              transition={{ duration: 1.2 }}
              className="tabular rounded px-0.5 text-[13px] font-semibold text-ink"
            >
              {formatINR(offer.estimatedTotal)}
            </motion.div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]">
            {cv.availability === true && (
              <span className="text-money">date confirmed</span>
            )}
            {offer.missingFields.length > 0 && (
              <span className="text-warn" title={offer.missingFields.join(", ")}>
                {offer.missingFields.length} unanswered
              </span>
            )}
          </div>
        </div>
      ) : cv.stage === "eliminated" ? (
        <div className="mt-1 text-[11px] text-danger">
          {cv.eliminationReason ?? "eliminated"}
        </div>
      ) : null}

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[10.5px] text-ink-faint">
          {latency !== null && (
            <>
              replied in <Num>{formatDuration(latency)}</Num>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] font-medium">
          {cv.stage === "finalist" && onSelectVendor && (
            <button
              onClick={onSelectVendor}
              className="text-money hover:underline"
            >
              Choose
            </button>
          )}
          {row.thread && (
            <button onClick={onOpenThread} className="text-brand hover:underline">
              Emails
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
  const counts = COLUMNS.map(
    (col) => rows.filter((r) => col.stages.includes(r.cv.stage)).length,
  );
  // An empty stage keeps its label but gives its width back: the funnel
  // visibly narrows where nothing is waiting.
  const template = counts
    .map((n) => (n === 0 ? "minmax(82px, 0.42fr)" : "minmax(150px, 1fr)"))
    .join(" ");

  return (
    <div
      className="grid gap-2 max-lg:!grid-cols-2 max-lg:!grid-rows-none"
      style={{ gridTemplateColumns: template }}
    >
      {COLUMNS.map((col, colIndex) => {
        const items = rows.filter((r) => col.stages.includes(r.cv.stage));
        return (
          <div key={col.key} className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-line pb-1">
              <span className="text-[11.5px] font-medium text-ink-soft">
                {col.label}
              </span>
              <Num
                className={`text-[11px] ${counts[colIndex] > 0 ? "text-ink-soft" : "text-ink-faint"}`}
              >
                {items.length}
              </Num>
            </div>
            <div className="flex flex-col gap-1.5">
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
                <div className="rounded-md border border-dashed border-line px-1.5 py-3 text-center text-[11px] text-ink-faint">
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
