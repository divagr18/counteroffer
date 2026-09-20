import type { Message, Offer } from "../lib/types";
import { formatClock, formatINR, pct } from "../lib/format";
import { Card, SectionLabel } from "./ui";

export function Thread({
  vendorName,
  inboxEmail,
  messages,
  offer,
}: {
  vendorName: string;
  inboxEmail: string;
  messages: Message[];
  offer: Offer | null;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <div className="text-sm font-semibold">Thread with {vendorName}</div>
          <div className="text-[11px] text-ink-faint">via {inboxEmail}</div>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {messages.map((message, i) => {
            const outbound = message.direction === "outbound";
            return (
              <div
                key={`${message._id ?? i}`}
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  outbound
                    ? "self-end rounded-br-md bg-brand text-white"
                    : "self-start rounded-bl-md bg-slate-100 text-ink"
                }`}
              >
                <div
                  className={`mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide ${
                    outbound ? "text-teal-100" : "text-ink-faint"
                  }`}
                >
                  <span>{outbound ? "Agent" : vendorName}</span>
                  <span className="tabular font-normal normal-case">
                    {formatClock(message.timestamp)}
                  </span>
                  {message.kind && (
                    <span
                      className={`rounded-full px-1.5 py-px text-[9px] ${
                        outbound ? "bg-teal-800/60" : "bg-slate-200"
                      }`}
                    >
                      {message.kind}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
                  {message.bodyText}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <SectionLabel>Structured offer</SectionLabel>
          {offer ? (
            <div className="mt-3">
              <div className="tabular text-2xl font-bold text-ink">
                {formatINR(offer.estimatedTotal)}
              </div>
              <div className="text-[11px] text-ink-faint">
                estimated all-in · revision {offer.revisionNumber}
              </div>
              <div className="mt-3 space-y-1.5 text-[13px]">
                {offer.coverageHours !== undefined && (
                  <RowLine label="Coverage" value={`${offer.coverageHours} hours`} ok />
                )}
                {offer.deliverables.map((d) => (
                  <RowLine key={d} label={d} value="✓" ok />
                ))}
                <RowLine
                  label="Taxes"
                  value={offer.taxesIncluded ? "included" : "extra"}
                  ok={offer.taxesIncluded}
                />
                <RowLine
                  label="Travel"
                  value={
                    offer.travelIncluded === true
                      ? "included"
                      : offer.travelIncluded === false
                        ? "extra"
                        : "unknown"
                  }
                  ok={offer.travelIncluded === true}
                />
                {offer.missingFields.map((m) => (
                  <RowLine key={m} label={m} value="missing" ok={false} />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-[11px] text-ink-soft">Completeness</span>
                <span className="tabular text-[12px] font-bold text-brand">
                  {pct(offer.completenessScore)}
                </span>
              </div>
              {offer.assumptions.length > 0 && (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  {offer.assumptions.join(" · ")}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 text-[13px] text-ink-faint">
              No structured offer extracted yet.
            </div>
          )}
        </Card>
        <div className="rounded-2xl border border-dashed border-line p-4 text-[11px] leading-relaxed text-ink-faint">
          The left side is the raw email conversation. The right side is what the
          agent understood from it — every number normalized and comparable.
        </div>
      </div>
    </div>
  );
}

function RowLine({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="capitalize text-ink-soft">{label}</span>
      <span className={ok ? "font-semibold text-money" : "font-semibold text-warn"}>
        {value}
      </span>
    </div>
  );
}
