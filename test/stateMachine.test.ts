import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  nextStages,
} from "../convex/lib/stateMachine";

describe("campaign-vendor stage machine (doc §64)", () => {
  it("allows the canonical happy path", () => {
    expect(canTransition("discovered", "qualified")).toBe(true);
    expect(canTransition("qualified", "contacted")).toBe(true);
    expect(canTransition("contacted", "replied")).toBe(true);
    expect(canTransition("replied", "negotiating")).toBe(true);
    expect(canTransition("negotiating", "finalist")).toBe(true);
    expect(canTransition("finalist", "selected")).toBe(true);
  });

  it("allows elimination from any active stage", () => {
    for (const stage of [
      "discovered",
      "qualified",
      "contacted",
      "replied",
      "negotiating",
      "finalist",
    ] as const) {
      expect(canTransition(stage, "eliminated")).toBe(true);
    }
  });

  it("allows a complete offer to go straight from replied to finalist", () => {
    expect(canTransition("replied", "finalist")).toBe(true);
  });

  it("rejects skipping qualification (doc §64 invalid transition)", () => {
    expect(canTransition("discovered", "contacted")).toBe(false);
  });

  it("rejects negotiating before any reply", () => {
    expect(canTransition("contacted", "negotiating")).toBe(false);
  });

  it("terminal stages cannot move", () => {
    expect(canTransition("eliminated", "qualified")).toBe(false);
    expect(canTransition("selected", "finalist")).toBe(false);
    expect(canTransition("eliminated", "contacted")).toBe(false);
  });

  it("assertTransition throws a descriptive error on invalid moves", () => {
    expect(() => assertTransition("discovered", "contacted")).toThrowError(
      /discovered.*contacted|invalid/i,
    );
    expect(() => assertTransition("discovered", "qualified")).not.toThrow();
  });

  it("nextStages lists legal successors", () => {
    expect(nextStages("discovered")).toContain("qualified");
    expect(nextStages("discovered")).toContain("eliminated");
    expect(nextStages("discovered")).not.toContain("contacted");
    expect(nextStages("selected")).toHaveLength(0);
  });
});
