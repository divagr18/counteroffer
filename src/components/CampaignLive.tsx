import type {
  CampaignEvent,
  CampaignView,
  PipelineRow,
} from "../lib/types";
import { formatINR } from "../lib/format";
import { motion } from "framer-motion";
import { ActivityFeed } from "./ActivityFeed";
import { Approvals } from "./Approvals";
import { Counters } from "./Counters";
import { Leaderboard } from "./Leaderboard";
import { Pipeline } from "./Pipeline";
import { Badge } from "./ui";

export function CampaignLive({
  view,
  rows,
  events,
  onOpenThread,
  onOpenCompare,
  onOpenVendor,
  onResolveApproval,
  onSelectVendor,
  onCloseCampaign,
}: {
  view: CampaignView;
  rows: PipelineRow[];
  events: CampaignEvent[];
  onOpenThread?: (row: PipelineRow) => void;
  onOpenCompare?: () => void;
  onOpenVendor?: (row: PipelineRow) => void;
  onResolveApproval?: (approvalId: string, approve: boolean) => void;
  onSelectVendor?: (cvId: string) => void;
  onCloseCampaign?: () => void;
}) {
  const { campaign, counts, bestOffer } = view;
  const spec = campaign.spec;
  const requiredCount = (spec?.requirements ?? []).filter(
    (r) => r.kind === "required",
  ).length;
  const eliminated = rows.filter((r) => r.cv.stage === "eliminated");

  const initials = rows
    .filter((r) => r.firstOffer)
    .map((r) => r.firstOffer!.estimatedTotal);
  const avgInitial =
    initials.length > 0
      ? initials.reduce((a, b) => a + b, 0) / initials.length
      : null;
  const savings =
    bestOffer && avgInitial ? Math.max(0, avgInitial - bestOffer.offer.estimatedTotal) : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-ink">
              {campaign.title}
            </h2>
            <Badge tone="brand">{campaign.status}</Badge>
          </div>
          <div className="mt-0.5 text-[13px] text-ink-soft">
            {spec?.location ?? campaign.location}
            {spec?.targetDate ? ` · ${spec.targetDate}` : ""} · budget{" "}
            <span className="tabular font-semibold">
              {formatINR(campaign.targetBudget)}–{formatINR(campaign.hardBudget)}
            </span>
            {view.mailboxEmail && (
              <span className="text-ink-faint"> · inbox {view.mailboxEmail}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rows.some((r) => r.cv.stage === "selected") &&
            campaign.status !== "closed" &&
            onCloseCampaign && (
              <button
                onClick={onCloseCampaign}
                className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                Close campaign →
              </button>
            )}
          {onOpenCompare && (
            <button
              onClick={onOpenCompare}
              className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              Compare offers →
            </button>
          )}
        </div>
      </div>

      {savings !== null && savings > 0 && bestOffer && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
        >
          <span className="text-xl">🎉</span>
          <div className="text-sm text-emerald-900">
            <span className="font-bold">
              New best offer {formatINR(bestOffer.offer.estimatedTotal)}.
            </span>{" "}
            You've saved{" "}
            <span className="tabular font-bold">
              {formatINR(savings)}
            </span>{" "}
            against the average initial quote.
          </div>
        </motion.div>
      )}

      <div className="mt-4">
        <Counters counts={counts} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Pipeline
            rows={rows}
            onOpenThread={onOpenThread}
            onOpenVendor={onOpenVendor}
            onSelectVendor={onSelectVendor}
          />
          {eliminated.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {eliminated.length} rejected
              </span>
              {eliminated.map((r) => (
                <button
                  key={r.cv._id}
                  onClick={() => r.vendor && onOpenVendor?.(r)}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-ink-soft hover:bg-slate-200"
                  title={r.cv.eliminationReason ?? undefined}
                >
                  <span className="font-semibold">{r.vendor?.name}</span>
                  <span className="text-ink-faint">
                    {r.cv.eliminationReason ?? "low fit"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Leaderboard rows={rows} requiredCount={requiredCount} />
        </div>
        <div className="flex flex-col gap-4">
          {onResolveApproval && (
            <Approvals
              approvals={view.approvals}
              rows={rows}
              onResolve={onResolveApproval}
            />
          )}
          <ActivityFeed events={events} />
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Agent permissions
            </div>
            <div className="mt-2 space-y-1.5 text-[12px] text-ink-soft">
              <div className="flex justify-between">
                <span>Discovery</span>
                <Badge tone="brand">AUTO</Badge>
              </div>
              <div className="flex justify-between">
                <span>Vendor outreach</span>
                <Badge tone={campaign.permissions.outreach === "auto" ? "brand" : "warn"}>
                  {campaign.permissions.outreach.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Clarification</span>
                <Badge tone={campaign.permissions.clarification === "auto" ? "brand" : "warn"}>
                  {campaign.permissions.clarification.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Negotiation</span>
                <Badge tone={campaign.permissions.negotiation === "auto" ? "brand" : "warn"}>
                  {campaign.permissions.negotiation.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Accept final offer</span>
                <Badge tone="warn">
                  {campaign.permissions.selection.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
