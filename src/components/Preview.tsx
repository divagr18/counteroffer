import { useState } from "react";
import {
  fixtureCampaignView,
  fixtureEvents,
  fixtureMemory,
  fixtureMessages,
  fixtureNetwork,
  fixturePipeline,
  fixtureVendorProfile,
} from "../fixtures/demo";
import { CampaignLive } from "./CampaignLive";
import { Compare } from "./Compare";
import { Home } from "./Home";
import { RequirementReview } from "./RequirementReview";
import { Thread } from "./Thread";
import { VendorProfile } from "./VendorProfile";
import { Network } from "./Network";

const SCREENS = [
  "home",
  "requirements",
  "campaign",
  "compare",
  "thread",
  "vendor",
  "network",
] as const;

type Screen = (typeof SCREENS)[number];

export function Preview() {
  const [screen, setScreen] = useState<Screen>("campaign");
  const [spec, setSpec] = useState(fixtureCampaignView.campaign.spec!);
  const [approvals, setApprovals] = useState(fixtureCampaignView.approvals);
  const samarth = fixturePipeline.find((r) => r.vendor?.name === "Samarth Weddings")!;

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-line bg-surface/90 px-4 py-2 backdrop-blur">
        <span className="mr-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          Preview mode (no backend)
        </span>
        {SCREENS.map((s) => (
          <button
            key={s}
            onClick={() => setScreen(s)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize ${
              screen === s
                ? "bg-brand text-white"
                : "text-ink-soft hover:bg-slate-100"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {screen === "home" && <Home onCreate={() => setScreen("requirements")} />}

      {screen === "requirements" && (
        <RequirementReview
          title={fixtureCampaignView.campaign.title}
          spec={spec}
          onStart={() => setScreen("campaign")}
          onSave={(_t, s) => setSpec(s)}
        />
      )}
      {screen === "campaign" && (
        <CampaignLive
          view={{ ...fixtureCampaignView, approvals }}
          rows={fixturePipeline}
          events={fixtureEvents}
          onOpenThread={() => setScreen("thread")}
          onOpenCompare={() => setScreen("compare")}
          onOpenVendor={() => setScreen("vendor")}
          onResolveApproval={(id) =>
            setApprovals((prev) => prev.filter((a) => a._id !== id))
          }
          onSelectVendor={() => {}}
          onCloseCampaign={() => {}}
        />
      )}

      {screen === "compare" && (
        <div className="mx-auto w-full max-w-7xl px-4 py-6">
          <h2 className="mb-4 text-xl font-bold tracking-tight">Compare offers</h2>
          <Compare rows={fixturePipeline} requirements={spec.requirements} />
        </div>
      )}

      {screen === "thread" && (
        <Thread
          vendorName="Samarth Weddings"
          inboxEmail={fixtureCampaignView.mailboxEmail ?? ""}
          messages={fixtureMessages}
          offer={samarth.offer}
        />
      )}

      {screen === "vendor" && (
        <VendorProfile
          vendor={fixtureVendorProfile.vendor}
          metrics={fixtureVendorProfile.metrics}
          evidence={[
            {
              claim: "Offers services: wedding photography, candid photography, highlight films",
              sourceUrl: "https://samarthweddings.in",
              snippet: "Samarth Weddings — candid wedding photography in Mumbai…",
              confidence: 0.92,
            },
            {
              claim: "Pricing signal: ₹38,000 (website packages page)",
              sourceUrl: "https://samarthweddings.in/packages",
              snippet: "Our signature package starts at ₹38,000…",
              confidence: 0.6,
            },
          ]}
        />
      )}

      {screen === "network" && (
        <Network entries={fixtureNetwork} memory={fixtureMemory} />
      )}
    </div>
  );
}
