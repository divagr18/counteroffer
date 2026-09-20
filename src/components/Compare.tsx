import type { ReactNode } from "react";
import type { PipelineRow, Requirement } from "../lib/types";
import { formatDuration, formatINR } from "../lib/format";
import { Check } from "./ui";

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
      <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-ink-faint">
        Nothing to compare yet.
      </div>
    );
  }

  const required = requirements.filter((r) => r.kind === "required");

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="w-44 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Criterion
            </th>
            {cols.map((c) => (
              <th key={c.cv._id} className="px-4 py-3 text-left">
                <div className="text-sm font-bold text-ink">
                  {c.vendor?.name}
                </div>
                <div className="tabular text-[11px] font-medium text-ink-faint">
                  score {Math.round(c.cv.offerScore ?? 0)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          <Row label="Current price">
            {cols.map((c) => (
              <td key={c.cv._id} className="tabular px-4 py-2.5 font-bold text-ink">
                {formatINR(c.offer!.estimatedTotal)}
              </td>
            ))}
          </Row>
          <Row label="Initial price">
            {cols.map((c) => (
              <td key={c.cv._id} className="tabular px-4 py-2.5 text-ink-faint">
                {formatINR((c.firstOffer ?? c.offer!).estimatedTotal)}
              </td>
            ))}
          </Row>
          <Row label="Assumptions">
            {cols.map((c) => (
              <td key={c.cv._id} className="px-4 py-2.5 text-[11px] text-ink-soft">
                {c.offer!.assumptions.length > 0
                  ? c.offer!.assumptions.join("; ")
                  : "none"}
              </td>
            ))}
          </Row>
          <Row label="Availability">
            {cols.map((c) => (
              <td key={c.cv._id} className="px-4 py-2.5">
                {c.cv.availability === true ? (
                  <span className="font-semibold text-money">Confirmed ✓</span>
                ) : c.cv.availability === false ? (
                  <span className="font-semibold text-danger">Unavailable</span>
                ) : (
                  <span className="text-ink-faint">Unknown</span>
                )}
              </td>
            ))}
          </Row>
          {required.map((req) => (
            <Row key={req.id} label={req.label}>
              {cols.map((c) => (
                <td key={c.cv._id} className="px-4 py-2.5">
                  <Check ok={c.cv.satisfiedRequirements.includes(req.id)} />
                </td>
              ))}
            </Row>
          ))}
          <Row label="Taxes">
            {cols.map((c) => (
              <td key={c.cv._id} className="px-4 py-2.5">
                {c.offer!.taxesIncluded ? (
                  <span className="text-money">included</span>
                ) : (
                  <span className="text-warn">extra</span>
                )}
              </td>
            ))}
          </Row>
          <Row label="Travel">
            {cols.map((c) => (
              <td key={c.cv._id} className="px-4 py-2.5">
                {c.offer!.travelIncluded === true ? (
                  <span className="text-money">included</span>
                ) : c.offer!.travelIncluded === false ? (
                  <span className="text-warn">
                    +{formatINR(c.offer!.travelAmount ?? 0)}
                  </span>
                ) : (
                  <span className="text-ink-faint">unknown</span>
                )}
              </td>
            ))}
          </Row>
          <Row label="Response time">
            {cols.map((c) => (
              <td key={c.cv._id} className="tabular px-4 py-2.5 text-ink-soft">
                {c.cv.contactedAt && c.cv.repliedAt
                  ? formatDuration(c.cv.repliedAt - c.cv.contactedAt)
                  : "—"}
              </td>
            ))}
          </Row>
          <Row label="Delivery">
            {cols.map((c) => (
              <td key={c.cv._id} className="tabular px-4 py-2.5 text-ink-soft">
                {c.offer!.deliveryTimelineDays
                  ? `${c.offer!.deliveryTimelineDays} days`
                  : "—"}
              </td>
            ))}
          </Row>
          <Row label="Completeness">
            {cols.map((c) => (
              <td key={c.cv._id} className="px-4 py-2.5">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round(c.offer!.completenessScore * 100)}%` }}
                  />
                </div>
              </td>
            ))}
          </Row>
        </tbody>
      </table>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </td>
      {children}
    </tr>
  );
}
