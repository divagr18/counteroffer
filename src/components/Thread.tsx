import type { Message, Offer } from "../lib/types";
import { formatClock, formatINR, pct } from "../lib/format";
import { Meter, Num, Panel } from "./ui";

const KIND_LABEL: Record<string, string> = {
  rfq: "request for quote",
  clarification: "follow-up question",
  counteroffer: "counteroffer",
  follow_up: "nudge",
  quote: "quote",
};

export function Thread({
  vendorName,
  inboxEmail,
  messages,
  offer,
  isDemoVendor = false,
}: {
  vendorName: string;
  inboxEmail: string;
  messages: Message[];
  offer: Offer | null;
  isDemoVendor?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Panel
        title={`Emails with ${vendorName}`}
        aside={
          <span className="text-[11.5px] text-ink-faint">
            {isDemoVendor ? (
              "scripted vendor, real pipeline"
            ) : (
              <>
                delivered to <Num>{inboxEmail}</Num>
              </>
            )}
          </span>
        }
        bodyClassName="flex flex-col gap-2.5 p-3.5"
      >
        {messages.map((message, i) => {
          const outbound = message.direction === "outbound";
          return (
            <article
              key={`${message._id ?? i}`}
              className={`max-w-[88%] rounded-md border px-3.5 py-2.5 ${
                outbound
                  ? "self-end border-brand/30 bg-brand-soft"
                  : "self-start border-line bg-soft"
              }`}
            >
              <header className="mb-1 flex flex-wrap items-baseline gap-x-2 text-[11px]">
                <span className="font-medium text-ink">
                  {outbound ? "The agent" : vendorName}
                </span>
                {message.kind && (
                  <span className="text-ink-faint">
                    {KIND_LABEL[message.kind] ?? message.kind}
                  </span>
                )}
                <time className="tabular ml-auto text-ink-faint">
                  {formatClock(message.timestamp)}
                </time>
              </header>
              <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">
                {message.bodyText}
              </div>
            </article>
          );
        })}
      </Panel>

      <div className="flex flex-col gap-3">
        <Panel
          title="What the agent understood"
          aside={
            offer ? (
              <span className="text-[11.5px] text-ink-faint">
                revision <Num>{offer.revisionNumber}</Num>
              </span>
            ) : undefined
          }
          bodyClassName="p-3.5"
        >
          {offer ? (
            <>
              <div className="flex items-baseline gap-2">
                <Num className="text-[26px] font-semibold leading-none text-ink">
                  {formatINR(offer.estimatedTotal)}
                </Num>
                <span className="text-[11.5px] text-ink-faint">all in</span>
              </div>

              <dl className="mt-3.5 space-y-1.5 text-[12.5px]">
                {offer.coverageHours !== undefined && (
                  <Line
                    label="Coverage"
                    value={`${offer.coverageHours} hours`}
                    ok
                  />
                )}
                {offer.deliverables.map((d) => (
                  <Line key={d} label={d} value="included" ok />
                ))}
                <Line
                  label="Taxes"
                  value={offer.taxesIncluded ? "included" : "extra"}
                  ok={offer.taxesIncluded}
                />
                <Line
                  label="Travel"
                  value={
                    offer.travelIncluded === true
                      ? "included"
                      : offer.travelIncluded === false
                        ? `extra ${formatINR(offer.travelAmount ?? 0)}`
                        : "not stated"
                  }
                  ok={offer.travelIncluded === true}
                />
                {offer.deliveryTimelineDays !== undefined && (
                  <Line
                    label="Delivery"
                    value={`${offer.deliveryTimelineDays} days`}
                    ok
                  />
                )}
                {offer.missingFields.map((m) => (
                  <Line key={m} label={m} value="never answered" ok={false} />
                ))}
              </dl>

              <div className="mt-3.5 flex items-center justify-between border-t border-line-soft pt-2.5">
                <span className="text-[11.5px] text-ink-soft">
                  How complete this quote is
                </span>
                <div className="flex items-center gap-2">
                  <Meter value={offer.completenessScore} />
                  <Num className="text-[11.5px] font-medium text-ink">
                    {pct(offer.completenessScore)}
                  </Num>
                </div>
              </div>

              {offer.assumptions.length > 0 && (
                <div className="mt-2.5 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-[11.5px] leading-relaxed text-warn">
                  Assumed to compare fairly: {offer.assumptions.join("; ")}
                </div>
              )}
            </>
          ) : (
            <p className="text-[12.5px] text-ink-faint">
              No price in this thread yet.
            </p>
          )}
        </Panel>

        <p className="px-1 text-[11.5px] leading-relaxed text-ink-faint">
          On the left is the email exactly as it arrived. On the right is what the
          agent pulled out of it, with every number converted to the same basis so
          quotes can be compared.
        </p>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-soft first-letter:uppercase">{label}</dt>
      <dd className={ok ? "text-money" : "text-warn"}>{value}</dd>
    </div>
  );
}
