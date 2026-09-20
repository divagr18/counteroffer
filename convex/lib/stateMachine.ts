import type { Stage } from "./types";

export const STAGES: readonly Stage[] = [
  "discovered",
  "qualified",
  "eliminated",
  "contacted",
  "replied",
  "negotiating",
  "finalist",
  "selected",
];

/**
 * Legal campaign-vendor stage transitions (doc §64). Invalid transitions are
 * rejected so the pipeline cannot skip qualification or negotiation state.
 */
const TRANSITIONS: Record<Stage, readonly Stage[]> = {
  discovered: ["qualified", "eliminated"],
  qualified: ["contacted", "eliminated"],
  contacted: ["replied", "eliminated"],
  // A complete offer can skip straight to finalist.
  replied: ["negotiating", "finalist", "eliminated"],
  negotiating: ["finalist", "eliminated"],
  finalist: ["selected", "eliminated"],
  // Terminal states.
  selected: [],
  eliminated: [],
};

export function canTransition(from: Stage, to: Stage): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: Stage, to: Stage): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid stage transition: ${from} -> ${to} ` +
        `(allowed from ${from}: ${TRANSITIONS[from].join(", ") || "none"})`,
    );
  }
}

/** Legal successor stages from a given stage. */
export function nextStages(from: Stage): Stage[] {
  return [...TRANSITIONS[from]];
}
