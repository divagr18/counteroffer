import type { Approval, PipelineRow } from "../lib/types";
import { Button, Card, SectionLabel } from "./ui";

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
    <Card className="p-4">
      <SectionLabel>Needs your approval</SectionLabel>
      <div className="mt-2 space-y-3">
        {pending.map((a) => {
          const vendorName = rows.find(
            (r) => r.cv._id === a.campaignVendorId,
          )?.vendor?.name;
          const label =
            a.kind === "select_finalist"
              ? `Select ${vendorName ?? "this vendor"} as your vendor`
              : a.kind === "send_outreach"
                ? "Start vendor outreach"
                : "Share your contact details";
          return (
            <div
              key={a._id}
              className="rounded-xl border border-amber-200 bg-amber-50 p-3"
            >
              <div className="text-[13px] font-semibold text-amber-900">
                {label}
              </div>
              <div className="mt-2 flex gap-2">
                <Button onClick={() => onResolve(a._id, true)}>Approve</Button>
                <Button
                  variant="secondary"
                  onClick={() => onResolve(a._id, false)}
                >
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
