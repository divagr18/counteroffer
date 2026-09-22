import type { Approval, PipelineRow } from "../lib/types";
import { Button, Panel } from "./ui";

export function Approvals({
  approvals,
  rows,
  onResolve,
}: {
  approvals: Approval[];
  rows: PipelineRow[];
  onResolve: (approvalId: string, approve: boolean) => void;
}) {
  const pending = approvals.filter((a) => a.status === "pending");
  if (pending.length === 0) return null;

  return (
    <Panel
      title="Waiting on you"
      className="shrink-0 border-brand/40"
      bodyClassName="divide-y divide-line-soft"
    >
      {pending.map((a) => {
        const vendorName = rows.find((r) => r.cv._id === a.campaignVendorId)
          ?.vendor?.name;
        const label =
          a.kind === "select_finalist"
            ? `Go ahead with ${vendorName ?? "this vendor"}`
            : a.kind === "send_outreach"
              ? "Start emailing vendors"
              : "Share your contact details";
        const detail =
          a.kind === "select_finalist"
            ? "Nothing is committed until you say so."
            : a.kind === "send_outreach"
              ? "Real businesses will receive this request."
              : "Only what a vendor needs to reply to you.";
        return (
          <div key={a._id} className="px-3.5 py-3">
            <div className="text-[13px] font-medium text-ink">{label}</div>
            <p className="mt-0.5 text-[11.5px] text-ink-faint">{detail}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => onResolve(a._id, true)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onResolve(a._id, false)}
              >
                Not now
              </Button>
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
