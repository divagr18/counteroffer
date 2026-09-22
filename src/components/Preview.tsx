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

const SCREENS: { key: Screen; label: string }[] = [
  { key: "home", label: "Start" },
  { key: "requirements", label: "Requirements" },
  { key: "campaign", label: "Board" },
  { key: "thread", label: "Emails" },
  { key: "vendor", label: "Supplier" },
  { key: "network", label: "Network" },
];

type Screen =
  | "home"
  | "requirements"
  | "campaign"
  | "thread"
  | "vendor"
  | "network";

export function Preview() {
  const [screen, setScreen] = useState<Screen>("campaign");
  const [tab, setTab] = useState<"live" | "compare">("live");
  const [spec, setSpec] = useState(fixtureCampaignView.campaign.spec!);
  const [approvals, setApprovals] = useState(fixtureCampaignView.approvals);
  const samarth = fixturePipeline.find(
    (r) => r.vendor?.name === "Samarth Weddings",
  )!;

  const scrolls = screen !== "campaign";

  return (
    <div className="flex h-full overflow-hidden bg-canvas">
      <nav className="flex w-40 shrink-0 flex-col gap-1 border-r border-line bg-surface p-2.5">
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[13px] font-bold text-white">
            C
          </span>
          <span className="text-[13px] font-semibold text-ink">Preview</span>
        </div>
        {SCREENS.map((s) => (
          <button
            key={s.key}
            onClick={() => setScreen(s.key)}
            aria-current={screen === s.key ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors ${
              screen === s.key
                ? "bg-brand-soft text-brand"
                : "text-ink-soft hover:bg-raise hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
        <p className="mt-auto px-1 text-[11px] leading-relaxed text-ink-faint">
          Sample data, no backend. Set VITE_CONVEX_URL to run it live.
        </p>
      </nav>

      <div
        className={`flex min-w-0 flex-1 flex-col overflow-hidden ${
          scrolls ? "scroll-region" : ""
        }`}
      >
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
            tab={tab}
            onTab={setTab}
            compare={
              <Compare rows={fixturePipeline} requirements={spec.requirements} />
            }
            onOpenThread={() => setScreen("thread")}
            onOpenVendor={() => setScreen("vendor")}
            onResolveApproval={(id) =>
              setApprovals((prev) => prev.filter((a) => a._id !== id))
            }
            onSelectVendor={() => {}}
            onCloseCampaign={() => {}}
          />
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
                claim:
                  "Offers services: wedding photography, candid photography, highlight films",
                sourceUrl: "https://samarthweddings.in",
                snippet:
                  "Samarth Weddings — candid wedding photography in Mumbai…",
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
    </div>
  );
}
