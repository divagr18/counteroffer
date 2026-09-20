import { useMemo, useState, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { CampaignLive } from "./components/CampaignLive";
import { Compare } from "./components/Compare";
import { Home } from "./components/Home";
import { Preview } from "./components/Preview";
import { RequirementReview } from "./components/RequirementReview";
import { Thread } from "./components/Thread";
import { VendorProfile } from "./components/VendorProfile";
import { Badge, Button } from "./components/ui";
import { timeAgo } from "./lib/format";
import type { CampaignView, Counts, PipelineRow } from "./lib/types";
import { Network } from "./components/Network";
import type { NetworkEntry } from "./lib/types";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

export default function App() {
  if (!CONVEX_URL) {
    return <Preview />;
  }
  const convex = new ConvexReactClient(CONVEX_URL);
  return (
    <ConvexProvider client={convex}>
      <LiveApp />
    </ConvexProvider>
  );
}

type Route =
  | { name: "home" }
  | { name: "review"; campaignId: Id<"campaigns"> }
  | { name: "campaign"; campaignId: Id<"campaigns"> }
  | { name: "network" };

function LiveApp() {
  const [route, setRoute] = useState<Route>({ name: "home" });

  if (route.name === "review") {
    return (
      <ReviewScreen
        campaignId={route.campaignId}
        onStart={() =>
          setRoute({ name: "campaign", campaignId: route.campaignId })
        }
      />
    );
  }
  if (route.name === "campaign") {
    return (
      <CampaignScreen
        campaignId={route.campaignId}
        onBack={() => setRoute({ name: "home" })}
      />
    );
  }
  if (route.name === "network") {
    return <NetworkScreen onBack={() => setRoute({ name: "home" })} />;
  }
  return (
    <HomeScreen
      onCreated={(campaignId) => setRoute({ name: "review", campaignId })}
      onOpen={(campaignId) => setRoute({ name: "campaign", campaignId })}
      onOpenNetwork={() => setRoute({ name: "network" })}
    />
  );
}

function HomeScreen({
  onCreated,
  onOpen,
  onOpenNetwork,
}: {
  onCreated: (id: Id<"campaigns">) => void;
  onOpen: (id: Id<"campaigns">) => void;
  onOpenNetwork: () => void;
}) {
  const createDraft = useMutation(api.campaigns.createDraft);
  const seedDemo = useMutation(api.seed.seedDemo);
  const seedInstant = useMutation(api.seed.seedInstantDemo);
  const seedCatering = useMutation(api.seed.seedCateringDemo);
  const list = useQuery(api.campaigns.list);

  const handleCreate = async (description: string) => {
    const id = await createDraft({ description });
    onCreated(id);
  };

  return (
    <div>
      <Home onCreate={handleCreate} />
      <div className="mx-auto w-full max-w-3xl px-6 pb-16">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Your campaigns
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onOpenNetwork}>
              Supplier network →
            </Button>
            <Button variant="secondary" onClick={() => void seedDemo({})}>
              Seed demo campaign
            </Button>
            <Button variant="secondary" onClick={() => void seedInstant({})}>
              Seed live demo
            </Button>
            <Button variant="secondary" onClick={() => void seedCatering({})}>
              Seed catering demo
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {(list ?? []).map((entry) => (
            <button
              key={entry.campaign._id}
              onClick={() => onOpen(entry.campaign._id)}
              className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:border-brand"
            >
              <div>
                <div className="text-sm font-semibold">{entry.campaign.title}</div>
                <div className="text-[11px] text-ink-faint">
                  {entry.campaign.status} · updated {timeAgo(entry.campaign.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ink-soft">
                <Badge tone="neutral">{entry.counts.discoveredTotal} found</Badge>
                <Badge tone="brand">{entry.counts.replied} replied</Badge>
                {entry.bestOffer && (
                  <Badge tone="money">
                    best ₹{Math.round(entry.bestOffer.offer.estimatedTotal).toLocaleString("en-IN")}
                  </Badge>
                )}
              </div>
            </button>
          ))}
          {list && list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
              No campaigns yet — describe what you need above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkScreen({ onBack }: { onBack: () => void }) {
  const network = useQuery(api.vendors.network);
  const memory = useQuery(api.users.memory);
  const [vendorId, setVendorId] = useState<Id<"vendors"> | null>(null);

  if (!network) return <LoadingNote text="Loading your supplier network…" />;

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2 backdrop-blur">
        <button
          onClick={onBack}
          className="text-sm font-semibold text-ink-soft hover:text-ink"
        >
          ← All campaigns
        </button>
        <span className="text-sm font-semibold">Supplier network</span>
      </div>
      <Network
        entries={network as unknown as NetworkEntry[]}
        memory={memory ?? null}
        onOpenVendor={(id) => setVendorId(id as Id<"vendors">)}
      />
      {vendorId && (
        <VendorModal vendorId={vendorId} onClose={() => setVendorId(null)} />
      )}
    </div>
  );
}

function ReviewScreen({
  campaignId,
  onStart,
}: {
  campaignId: Id<"campaigns">;
  onStart: () => void;
}) {
  const data = useQuery(api.campaigns.get, { campaignId });
  const startSourcing = useMutation(api.campaigns.startSourcing);
  const updateSpec = useMutation(api.campaigns.updateSpec);

  if (!data) return <LoadingNote text="Parsing your request…" />;
  const campaign = data.campaign;
  if (!campaign.spec) {
    return <LoadingNote text="The agent is interpreting your requirements…" />;
  }

  return (
    <RequirementReview
      title={campaign.title}
      spec={campaign.spec}
      onSave={(title, spec) => {
        void updateSpec({ campaignId, title, spec });
      }}
      onStart={() => {
        void startSourcing({ campaignId }).then(onStart);
      }}
    />
  );
}

function CampaignScreen({
  campaignId,
  onBack,
}: {
  campaignId: Id<"campaigns">;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"live" | "compare">("live");
  const [threadCvId, setThreadCvId] = useState<Id<"campaignVendors"> | null>(null);
  const [vendorId, setVendorId] = useState<Id<"vendors"> | null>(null);

  const data = useQuery(api.campaigns.get, { campaignId });
  const pipelineRows = useQuery(api.campaigns.pipeline, { campaignId });
  const events = useQuery(api.campaigns.activity, { campaignId });
  const resolveApproval = useMutation(api.campaigns.resolveApproval);
  const selectVendor = useMutation(api.campaigns.selectVendor);
  const closeCampaign = useMutation(api.campaigns.closeCampaign);

  const view: CampaignView | null = useMemo(() => {
    if (!data) return null;
    return {
      campaign: data.campaign,
      mailboxEmail: data.mailbox?.email,
      counts: data.counts as Counts,
      approvals: data.approvals.map((a) => ({
        _id: a._id,
        kind: a.kind,
        status: a.status,
        createdAt: a.createdAt,
        campaignVendorId: a.campaignVendorId ?? null,
      })),
      bestOffer: data.bestOffer
        ? { offer: data.bestOffer.offer, vendorName: data.bestOffer.vendorName }
        : null,
    };
  }, [data]);

  if (!view || !pipelineRows || !events) {
    return <LoadingNote text="Loading campaign…" />;
  }

  const rows = pipelineRows as PipelineRow[];
  const spec = view.campaign.spec;

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2 backdrop-blur">
        <button onClick={onBack} className="text-sm font-semibold text-ink-soft hover:text-ink">
          ← All campaigns
        </button>
        <div className="ml-auto flex gap-1">
          {(["live", "compare"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize ${
                tab === t ? "bg-brand text-white" : "text-ink-soft hover:bg-slate-100"
              }`}
            >
              {t === "live" ? "Live campaign" : "Compare"}
            </button>
          ))}
        </div>
      </div>

      {tab === "live" ? (
        <CampaignLive
          view={view}
          rows={rows}
          events={events}
          onOpenThread={(row) =>
            setThreadCvId(row.cv._id as Id<"campaignVendors">)
          }
          onOpenCompare={() => setTab("compare")}
          onOpenVendor={(row) =>
            row.vendor && setVendorId(row.vendor._id as Id<"vendors">)
          }
          onResolveApproval={(approvalId, approve) =>
            void resolveApproval({
              approvalId: approvalId as Id<"approvalRequests">,
              approve,
            })
          }
          onSelectVendor={(cvId) =>
            void selectVendor({
              campaignVendorId: cvId as Id<"campaignVendors">,
            })
          }
          onCloseCampaign={() => void closeCampaign({ campaignId })}
        />
      ) : (
        <div className="mx-auto w-full max-w-7xl px-4 py-6">
          <h2 className="mb-4 text-xl font-bold tracking-tight">Compare offers</h2>
          <Compare rows={rows} requirements={spec?.requirements ?? []} />
        </div>
      )}

      {threadCvId && (
        <ThreadModal campaignVendorId={threadCvId} onClose={() => setThreadCvId(null)} />
      )}
      {vendorId && <VendorModal vendorId={vendorId} onClose={() => setVendorId(null)} />}
    </div>
  );
}

function ThreadModal({
  campaignVendorId,
  onClose,
}: {
  campaignVendorId: Id<"campaignVendors">;
  onClose: () => void;
}) {
  const data = useQuery(api.threads.byCampaignVendor, { campaignVendorId });
  const detail = useQuery(api.campaigns.campaignVendorDetail, {
    campaignVendorId,
  });

  return (
    <Modal onClose={onClose}>
      {detail && data ? (
        <Thread
          vendorName={detail.vendor?.name ?? "Vendor"}
          inboxEmail={detail.mailbox?.email ?? ""}
          messages={data.messages.map((m) => ({
            _id: m._id,
            direction: m.direction,
            fromAddress: m.fromAddress,
            subject: m.subject,
            bodyText: m.bodyText,
            kind: m.kind,
            timestamp: m.timestamp,
          }))}
          offer={
            detail.offer
              ? {
                  _id: detail.offer._id,
                  revisionNumber: detail.offer.revisionNumber,
                  currency: detail.offer.currency,
                  lineItems: detail.offer.lineItems,
                  subtotal: detail.offer.subtotal,
                  taxAmount: detail.offer.taxAmount,
                  taxesIncluded: detail.offer.taxesIncluded,
                  travelIncluded: detail.offer.travelIncluded,
                  travelAmount: detail.offer.travelAmount,
                  estimatedTotal: detail.offer.estimatedTotal,
                  assumptions: detail.offer.assumptions,
                  coverageHours: detail.offer.coverageHours,
                  deliverables: detail.offer.deliverables,
                  deliveryTimelineDays: detail.offer.deliveryTimelineDays,
                  completenessScore: detail.offer.completenessScore,
                  missingFields: detail.offer.missingFields,
                  status: detail.offer.status,
                }
              : null
          }
        />
      ) : (
        <LoadingNote text="Loading thread…" />
      )}
    </Modal>
  );
}

function VendorModal({
  vendorId,
  onClose,
}: {
  vendorId: Id<"vendors">;
  onClose: () => void;
}) {
  const data = useQuery(api.vendors.get, { vendorId });
  if (!data) return null;
  return (
    <Modal onClose={onClose}>
      <VendorProfile
        vendor={{
          _id: data.vendor._id,
          name: data.vendor.name,
          category: data.vendor.category,
          description: data.vendor.description,
          locations: data.vendor.locations,
          services: data.vendor.services,
          email: data.vendor.email,
          phone: data.vendor.phone,
          website: data.vendor.website,
          aliases: data.vendor.aliases,
          sourceUrls: data.vendor.sourceUrls,
          confidence: data.vendor.confidence,
          isDemoVendor: data.vendor.isDemoVendor,
          demoBehavior: data.vendor.demoBehavior,
        }}
        metrics={
          data.metrics
            ? {
                campaignsSeen: data.metrics.campaignsSeen,
                timesContacted: data.metrics.timesContacted,
                replies: data.metrics.replies,
                medianResponseMs: data.metrics.medianResponseMs,
                medianInitialQuote: data.metrics.medianInitialQuote,
                medianFinalQuote: data.metrics.medianFinalQuote,
                typicalDiscountPct: data.metrics.typicalDiscountPct,
                timesSelected: data.metrics.timesSelected,
                userRating: data.metrics.userRating,
              }
            : null
        }
        evidence={data.evidence.map((e) => ({
          claim: e.claim,
          sourceUrl: e.sourceUrl,
          snippet: e.snippet,
          confidence: e.confidence,
        }))}
      />
    </Modal>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-5xl rounded-2xl bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-bold text-ink-soft hover:bg-slate-100"
          >
            ✕ close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoadingNote({ text }: { text: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-brand animate-pulse-dot" />
        {text}
      </div>
    </div>
  );
}
