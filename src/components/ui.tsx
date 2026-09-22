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
    <div className={`rounded-lg border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}

/**
 * A titled region of the board. Header stays put, body scrolls, so a long
 * activity feed or vendor list never pushes the page down.
 */
export function Panel({
  title,
  aside,
  children,
  bodyClassName = "",
  className = "",
  scroll = false,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface ${className}`}
    >
      {title && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
          <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
          {aside}
        </header>
      )}
      <div
        className={`min-h-0 flex-1 ${scroll ? "scroll-region" : ""} ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}

/** Small sentence-case label. Never all caps. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] font-medium text-ink-faint">
      {children}
    </div>
  );
}

/** Monospaced figure. Every number on the board goes through this. */
export function Num({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`tabular ${className}`}>{children}</span>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "money" | "warn" | "danger";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-raise text-ink-soft",
    brand: "bg-brand-soft text-brand",
    money: "bg-money-soft text-money",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** A live dot. Used once per screen, where something is genuinely streaming. */
export function LiveDot({ label = "live" }: { label?: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-money">
      <span className="h-1.5 w-1.5 rounded-full bg-money animate-pulse-dot" />
      {label}
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
    <div className="flex items-baseline gap-2 px-3.5 py-2">
      <div
        className={`tabular text-lg font-semibold ${accent ? "text-brand" : "text-ink"}`}
      >
        {isNumber ? animated : value}
      </div>
      <div className="text-[12px] text-ink-faint">{label}</div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-brand text-white font-semibold hover:bg-brand-dim disabled:opacity-40 disabled:hover:bg-brand",
    secondary:
      "bg-raise text-ink border border-line hover:border-ink-faint disabled:opacity-40",
    ghost: "bg-transparent text-ink-soft hover:bg-raise hover:text-ink disabled:opacity-40",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1 text-[12px]",
    md: "px-3.5 py-2 text-[13px]",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md font-medium transition-colors ${sizes[size]} ${variants[variant]}`}
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

/** Thin progress meter, used for quote completeness. */
export function Meter({ value }: { value: number }) {
  const pctValue = Math.max(0, Math.min(1, value));
  return (
    <div
      className="h-1 w-20 overflow-hidden rounded-full bg-raise"
      role="progressbar"
      aria-valuenow={Math.round(pctValue * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${pctValue === 1 ? "bg-money" : "bg-warn"}`}
        style={{ width: `${pctValue * 100}%` }}
      />
    </div>
  );
}
