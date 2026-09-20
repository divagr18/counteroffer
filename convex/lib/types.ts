// Shared pure-logic types (mirror schema.ts unions but usable in tests
// without Convex runtime imports).

export type Stage =
  | "discovered"
  | "qualified"
  | "eliminated"
  | "contacted"
  | "replied"
  | "negotiating"
  | "finalist"
  | "selected";

export type BudgetType = "fixed" | "per_person" | "per_hour" | "package";

export interface OfferLineItem {
  label: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  required: boolean;
  included: boolean;
  isAddon: boolean;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
