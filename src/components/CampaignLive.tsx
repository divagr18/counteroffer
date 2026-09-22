import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { CampaignEvent, CampaignView, PipelineRow } from "../lib/types";
import { formatDate, formatINR } from "../lib/format";
import { ActivityFeed } from "./ActivityFeed";
import { Approvals } from "./Approvals";
import { Counters } from "./Counters";
import { Leaderboard } from "./Leaderboard";
import { Pipeline } from "./Pipeline";
import { Badge, Button, LiveDot, Num, Panel } from "./ui";

export function CampaignLive({
  view,
  rows,
  events,
  tab = "live",
  onTab,
  compare,
  onOpenThread,
  onOpenVendor,
  onResolveApproval,
  onSelectVendor,
  onCloseCampaign,
  onContactVendors,
}: {
  view: CampaignView;
  rows: PipelineRow[];
  events: CampaignEvent[];
  tab?: "live" | "compare";
  onTab?: (tab: "live" | "compare") => void;
  compare?: ReactNode;
  onOpenThread?: (row: PipelineRow) => void;
  onOpenVendor?: (row: PipelineRow) => void;
  onResolveApproval?: (approvalId: string, approve: boolean) => void;
  onSelectVendor?: (cvId: string) => void;
  onCloseCampaign?: () => void;
  onContactVendors?: () => void;
}) {
  const { campaign, counts, bestOffer } = view;
  const spec = campaign.spec;
  const requiredCount = (spec?.requirements ?? []).filter(
    (r) => r.kind === "required",
  ).length;
  const eliminated = rows.filter((r) => r.cv.stage === "eliminated");
  const qualified = rows.filter((r) => r.cv.stage === "qualified");

  const initials = rows
    .filter((r) => r.firstOffer)
    .map((r) => r.firstOffer!.estimatedTotal);
  const avgInitial =
    initials.length > 0
      ? initials.reduce((a, b) => a + b, 0) / initials.length
      : null;
  const savings =
    bestOffer && avgInitial
      ? Math.max(0, avgInitial - bestOffer.offer.estimatedTotal)
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Top bar: identity, money, and live counts on one horizontal line. */}
      <header className="shrink-0 border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-semibold text-ink">
                {campaign.title}
              </h1>
              <Badge tone={campaign.status === "closed" ? "neutral" : "brand"}>
                {campaign.status}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-soft">
              <span>{spec?.location ?? campaign.location}</span>
              {spec?.targetDate && <span>{formatDate(spec.targetDate)}</span>}
              <span>
                budget{" "}
                <Num className="text-ink">
                  {formatINR(campaign.targetBudget)}–
                  {formatINR(campaign.hardBudget)}
                </Num>
              </span>
              {view.mailboxEmail && (
                <span className="text-ink-faint">
                  inbox <Num>{view.mailboxEmail}</Num>
                </span>
              )}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
            {onContactVendors && qualified.length > 0 && counts.contacted === 0 && (
              <Button onClick={onContactVendors}>
                Contact {qualified.length} vendors
              </Button>
            )}
            {rows.some((r) => r.cv.stage === "selected") &&
              campaign.status !== "closed" &&
              onCloseCampaign && (
                <Button variant="secondary" onClick={onCloseCampaign}>
                  Close campaign
                </Button>
              )}
            {onTab && (
              <div className="flex items-center rounded-md border border-line p-0.5">
                {(["live", "compare"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onTab(t)}
                    className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      tab === t
                        ? "bg-brand-soft text-brand"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {t === "live" ? "Board" : "Compare"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line-soft px-4 py-1">
          <Counters counts={counts} />
          {savings !== null && savings > 0 && bestOffer ? (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-[12px]"
            >
              <span className="text-ink-soft">
                Best offer{" "}
                <Num className="font-semibold text-money">
                  {formatINR(bestOffer.offer.estimatedTotal)}
                </Num>{" "}
                from {bestOffer.vendorName}
              </span>
              <span className="h-3 w-px bg-line" />
              <span className="text-money">
                <Num className="font-semibold">{formatINR(savings)}</Num> under
                the average opening quote
              </span>
            </motion.div>
          ) : (
            <span className="text-[12px] text-ink-faint">
              Offers appear here as vendors reply.
            </span>
          )}
        </div>
      </header>

      {/* Board: fluid centre, fixed tape on the right. Neither scrolls the page. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col gap-2.5 p-2.5">
          {tab === "compare" ? (
            <Panel
              title="Offers side by side"
              className="min-h-0 flex-1"
              scroll
              bodyClassName="p-0"
            >
              {compare}
            </Panel>
          ) : (
            <>
              <Panel
                title="Pipeline"
                aside={
                  eliminated.length > 0 ? (
                    <span className="text-[12px] text-ink-faint">
                      <Num>{eliminated.length}</Num> rejected
                    </span>
                  ) : undefined
                }
                className="shrink-0"
                bodyClassName="p-2.5"
              >
                <Pipeline
                  rows={rows}
                  onOpenThread={onOpenThread}
                  onOpenVendor={onOpenVendor}
                  onSelectVendor={onSelectVendor}
                />
                {eliminated.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-2.5">
                    {eliminated.map((r) => (
                      <button
                        key={r.cv._id}
                        onClick={() => r.vendor && onOpenVendor?.(r)}
                        title={r.cv.eliminationReason ?? undefined}
                        className="flex items-center gap-1.5 rounded border border-line px-2 py-0.5 text-[11px] text-ink-faint transition-colors hover:border-ink-faint hover:text-ink-soft"
                      >
                        <span className="font-medium line-through">
                          {r.vendor?.name}
                        </span>
                        <span>{r.cv.eliminationReason ?? "low fit"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Quote board"
                aside={
                  bestOffer && (
                    <span className="text-[12px] text-ink-soft">
                      best{" "}
                      <Num className="font-semibold text-money">
                        {formatINR(bestOffer.offer.estimatedTotal)}
                      </Num>
                    </span>
                  )
                }
                className="min-h-0 flex-1"
                scroll
                bodyClassName="p-0"
              >
                <Leaderboard
                  rows={rows}
                  requiredCount={requiredCount}
                  onSelectVendor={onSelectVendor}
                />
              </Panel>
            </>
          )}
        </main>

        <aside className="flex w-[340px] shrink-0 flex-col gap-2.5 border-l border-line bg-canvas p-2.5">
          {onResolveApproval && (
            <Approvals
              approvals={view.approvals}
              rows={rows}
              onResolve={onResolveApproval}
            />
          )}

          <Panel
            title="Activity"
            aside={<LiveDot />}
            className="min-h-0 flex-1"
            scroll
            bodyClassName="p-1.5"
          >
            <ActivityFeed events={events} />
          </Panel>

          <Panel title="What the agent may do on its own" className="shrink-0">
            <div className="divide-y divide-line-soft">
              {[
                ["Find vendors", "auto" as const],
                ["Email vendors", campaign.permissions.outreach],
                ["Ask follow-up questions", campaign.permissions.clarification],
                ["Negotiate price", campaign.permissions.negotiation],
                ["Accept the final offer", campaign.permissions.selection],
              ].map(([label, mode]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between px-3.5 py-1.5 text-[12px]"
                >
                  <span className="text-ink-soft">{label as string}</span>
                  {mode === "auto" ? (
                    <span className="font-mono text-[11px] text-money">
                      on its own
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-brand">
                      asks you
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
