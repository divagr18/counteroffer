import type { Counts } from "../lib/types";
import { useCountUp } from "../lib/useCountUp";

/**
 * The funnel as one horizontal line. Sits in the top bar rather than in its own
 * block, so the width goes to the board instead of to a row of big numbers.
 */
export function Counters({ counts }: { counts: Counts }) {
  const steps: { value: number; label: string; accent?: boolean }[] = [
    { value: counts.discoveredTotal, label: "found" },
    { value: counts.qualified, label: "qualified" },
    { value: counts.contacted, label: "contacted" },
    { value: counts.replied, label: "replied" },
    { value: counts.negotiating, label: "negotiating", accent: true },
    {
      value: counts.finalist + counts.selected,
      label: counts.finalist + counts.selected === 1 ? "finalist" : "finalists",
      accent: true,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[12px]">
      {steps.map((step, i) => (
        <span key={step.label} className="flex items-center gap-1">
          {i > 0 && <span className="px-1 text-line">›</span>}
          <Counted value={step.value} accent={step.accent} />
          <span className="text-ink-faint">{step.label}</span>
        </span>
      ))}
    </div>
  );
}

function Counted({ value, accent }: { value: number; accent?: boolean }) {
  const animated = useCountUp(value);
  return (
    <span
      className={`tabular text-[13px] font-semibold ${
        accent && value > 0 ? "text-brand" : "text-ink"
      }`}
    >
      {animated}
    </span>
  );
}
