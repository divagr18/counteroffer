import type { ReactNode } from "react";
import { useCountUp } from "../lib/useCountUp";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "money" | "warn" | "danger";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-700",
    brand: "bg-brand-soft text-brand",
    money: "bg-emerald-50 text-money",
    warn: "bg-amber-50 text-warn",
    danger: "bg-red-50 text-danger",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  value,
  label,
  accent = false,
}: {
  value: ReactNode;
  label: string;
  accent?: boolean;
}) {
  const isNumber = typeof value === "number";
  const animated = useCountUp(isNumber ? (value as number) : 0);
  return (
    <div className="flex flex-col items-center px-4 py-2">
      <div
        className={`tabular text-2xl font-bold ${accent ? "text-brand" : "text-ink"}`}
      >
        {isNumber ? animated : value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-brand text-white hover:bg-teal-800 disabled:opacity-50 disabled:hover:bg-brand",
    secondary:
      "bg-surface text-ink border border-line hover:bg-slate-50 disabled:opacity-50",
    ghost: "bg-transparent text-ink-soft hover:bg-slate-100 disabled:opacity-50",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function Check({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="text-money">✓</span>
  ) : (
    <span className="text-ink-faint">—</span>
  );
}
