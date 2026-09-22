import type { ReactNode } from "react";
import type { PipelineRow, Requirement } from "../lib/types";
import { formatDuration, formatINR } from "../lib/format";
import { Check, Meter, Num } from "./ui";

export function Compare({
  rows,
  requirements,
}: {
  rows: PipelineRow[];
  requirements: Requirement[];
}) {
  const cols = rows
    .filter((r) => r.offer)
    .sort((a, b) => (b.cv.offerScore ?? -1) - (a.cv.offerScore ?? -1));

  if (cols.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-[13px] text-ink-faint">
        Nothing to compare until at least one vendor has quoted.
      </div>
    );
  }

  const required = requirements.filter((r) => r.kind === "required");

  return (
    <table className="w-full text-[13px]">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="border-b border-line">
          <th className="w-48 px-4 py-2.5 text-left font-mono text-[11px] font-medium text-ink-faint">
            Criterion
          </th>
          {cols.map((c, i) => (
            <th key={c.cv._id} className="min-w-[150px] px-4 py-2.5 text-left">
              <div className="flex items-baseline gap-1.5">
                <Num
                  className={`text-[11px] ${i === 0 ? "text-money" : "text-ink-faint"}`}
                >
                  {i + 1}
                </Num>
                <span className="font-semibold text-ink">{c.vendor?.name}</span>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <Row label="Price now" emphasis>
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              <Num className="font-semibold text-ink">
                {formatINR(c.offer!.estimatedTotal)}
              </Num>
            </Cell>
          ))}
        </Row>
        <Row label="Opening price">
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              <Num className="text-ink-faint">
                {formatINR((c.firstOffer ?? c.offer!).estimatedTotal)}
              </Num>
            </Cell>
          ))}
        </Row>
        <Row label="Available on the date">
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              {c.cv.availability === true ? (
                <span className="text-money">confirmed</span>
              ) : c.cv.availability === false ? (
                <span className="text-danger">not available</span>
              ) : (
                <span className="text-ink-faint">not stated</span>
              )}
            </Cell>
          ))}
        </Row>
        {required.map((req) => (
          <Row key={req.id} label={req.label}>
            {cols.map((c) => (
              <Cell key={c.cv._id}>
                <Check ok={c.cv.satisfiedRequirements.includes(req.id)} />
              </Cell>
            ))}
          </Row>
        ))}
        <Row label="Taxes">
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              {c.offer!.taxesIncluded ? (
                <span className="text-money">included</span>
              ) : (
                <span className="text-warn">extra</span>
              )}
            </Cell>
          ))}
        </Row>
        <Row label="Travel">
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              {c.offer!.travelIncluded === true ? (
                <span className="text-money">included</span>
              ) : c.offer!.travelIncluded === false ? (
                <span className="text-warn">
                  extra <Num>{formatINR(c.offer!.travelAmount ?? 0)}</Num>
                </span>
              ) : (
                <span className="text-ink-faint">not stated</span>
              )}
            </Cell>
          ))}
        </Row>
        <Row label="Replied in">
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              <Num className="text-ink-soft">
                {c.cv.contactedAt && c.cv.repliedAt
                  ? formatDuration(c.cv.repliedAt - c.cv.contactedAt)
                  : "—"}
              </Num>
            </Cell>
          ))}
        </Row>
        <Row label="Delivery">
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              <Num className="text-ink-soft">
                {c.offer!.deliveryTimelineDays
                  ? `${c.offer!.deliveryTimelineDays} days`
                  : "—"}
              </Num>
            </Cell>
          ))}
        </Row>
        <Row label="How complete the quote is">
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              <Meter value={c.offer!.completenessScore} />
            </Cell>
          ))}
        </Row>
        <Row label="Left unanswered">
          {cols.map((c) => (
            <Cell key={c.cv._id}>
              {c.offer!.missingFields.length > 0 ? (
                <span className="text-[11.5px] text-warn">
                  {c.offer!.missingFields.join(", ")}
                </span>
              ) : (
                <span className="text-money">nothing</span>
              )}
            </Cell>
          ))}
        </Row>
      </tbody>
    </table>
  );
}

function Row({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <tr
      className={`border-b border-line-soft last:border-0 ${emphasis ? "bg-soft" : ""}`}
    >
      <th
        scope="row"
        className="px-4 py-2.5 text-left text-[12px] font-medium text-ink-soft first-letter:uppercase"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-2.5">{children}</td>;
}
