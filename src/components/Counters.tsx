import type { Counts } from "../lib/types";
import { Stat } from "./ui";

export function Counters({ counts }: { counts: Counts }) {
  return (
    <div className="flex flex-wrap items-center divide-x divide-line rounded-2xl border border-line bg-surface">
      <Stat value={counts.discoveredTotal} label="found" />
      <Stat value={counts.qualified} label="qualified" />
      <Stat value={counts.contacted} label="contacted" />
      <Stat value={counts.replied} label="replied" />
      <Stat value={counts.negotiating} label="negotiating" accent />
      <Stat value={counts.finalist + counts.selected} label="finalists" accent />
    </div>
  );
}
