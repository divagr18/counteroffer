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
import { Badge, Num } from "./components/ui";
import { formatINR, timeAgo } from "./lib/format";
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

/**
 * Left rail. Persistent, so the window's left edge carries navigation instead
 * of empty margin, and the board itself gets the rest of the width.
 */
function Rail({
  active,
  onHome,
  onNetwork,
}: {
  active: "home" | "network" | "campaign";
  onHome: () => void;
  onNetwork: () => void;
}) {
  const item = (
    key: "home" | "network",
    label: string,
    glyph: ReactNode,
    onClick: () => void,
  ) => (
    <button
      key={key}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active === key ? "page" : undefined}
      className={`flex h-10 w-10 items-center justify-center rounded-md text-[15px] transition-colors ${
        active === key
          ? "bg-brand-soft text-brand"
          : "text-ink-faint hover:bg-raise hover:text-ink"
      }`}
    >
      {glyph}
    </button>
  );

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
      <button
        onClick={onHome}
        title="Counteroffer"
        className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-brand text-[15px] font-bold text-white"
      >
        C
      </button>
      {item(
        "home",
        "Campaigns",
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden>
          <rect
            x="2.5"
            y="3.5"
            width="15"
            height="13"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M8 3.5v13" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 7.5h4M11 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>,
        onHome,
      )}
      {item(
        "network",
        "Supplier network",
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden>
          <circle cx="10" cy="4.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="4.5" cy="15" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="15.5" cy="15" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8.5 6.4 6 12.9m5.5-6.5L14 12.9M6.7 15h6.6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>,
        onNetwork,
      )}
    </nav>
  );
}

function LiveApp() {
  const [route, setRoute] = useState<Route>({ name: "home" });

  const goHome = () => setRoute({ name: "home" });
  const goNetwork = () => setRoute({ name: "network" });

  return (
    <div className="flex h-full overflow-hidden bg-canvas">
      <Rail
        active={
          route.name === "network"
            ? "network"
            : route.name === "home"
              ? "home"
              : "campaign"
        }
        onHome={goHome}
        onNetwork={goNetwork}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {route.name === "review" ? (
          <ReviewScreen
            campaignId={route.campaignId}
            onStart={() =>
              setRoute({ name: "campaign", campaignId: route.campaignId })
            }
          />
        ) : route.name === "campaign" ? (
          <CampaignScreen campaignId={route.campaignId} />
        ) : route.name === "network" ? (
          <NetworkScreen />
        ) : (
          <HomeScreen
            onCreated={(campaignId) => setRoute({ name: "review", campaignId })}
            onOpen={(campaignId) => setRoute({ name: "campaign", campaignId })}
          />
        )}
      </div>
    </div>
  );
}

/** Shared screen header: title on the left, actions on the right. */
function ScreenBar({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[15px] font-semibold text-ink">{title}</h1>
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[12px] text-ink-soft">{subtitle}</div>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
    </header>
  );
}

function HomeScreen({
  onCreated,
  onOpen,
}: {
  onCreated: (id: Id<"campaigns">) => void;
  onOpen: (id: Id<"campaigns">) => void;
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
    <div className="scroll-region flex min-h-0 flex-1 flex-col">
      <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-1 content-center gap-10 px-8 py-12 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <Home onCreate={handleCreate} />

        <div className="min-w-0 xl:pt-2">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[13px] font-semibold text-ink">Your campaigns</h2>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 font-mono text-[11px] text-ink-faint">
                seed a demo
              </span>
            {[
              ["Wedding photographer", () => void seedDemo({})],
              ["Live pipeline", () => void seedInstant({})],
              ["Catering", () => void seedCatering({})],
            ].map(([label, fn]) => (
                <button
                  key={label as string}
                  onClick={fn as () => void}
                  className="rounded-md border border-line px-2 py-1 text-[12px] text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>

        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {(list ?? []).length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-ink-faint">
              {list
                ? "No campaigns yet. Describe what you need above, or seed a demo."
                : "Loading campaigns…"}
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line font-mono text-[11px] text-ink-faint">
                  <th className="px-4 py-2 font-medium">Campaign</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Found</th>
                  <th className="px-3 py-2 text-right font-medium">Replied</th>
                  <th className="px-3 py-2 text-right font-medium">Best offer</th>
                  <th className="px-3 py-2 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(list ?? []).map((entry) => (
                  <tr
                    key={entry.campaign._id}
                    onClick={() => onOpen(entry.campaign._id)}
                    className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-soft"
                  >
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {entry.campaign.title}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={
                          entry.campaign.status === "closed" ? "neutral" : "brand"
                        }
                      >
                        {entry.campaign.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Num className="text-ink-soft">
                        {entry.counts.discoveredTotal}
                      </Num>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Num className="text-ink-soft">{entry.counts.replied}</Num>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {entry.bestOffer ? (
                        <Num className="font-semibold text-money">
                          {formatINR(entry.bestOffer.offer.estimatedTotal)}
                        </Num>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Num className="text-ink-faint">
                        {timeAgo(entry.campaign.updatedAt)}
                      </Num>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkScreen() {
  const network = useQuery(api.vendors.network);
  const memory = useQuery(api.users.memory);
  const [vendorId, setVendorId] = useState<Id<"vendors"> | null>(null);

  return (
    <>
      <ScreenBar
        title="Supplier network"
        subtitle="Everything learned from past campaigns, carried into the next one"
      />
      {!network ? (
        <LoadingNote text="Loading your supplier network…" />
      ) : (
        <div className="scroll-region flex-1">
          <Network
            entries={network as unknown as NetworkEntry[]}
            memory={memory ?? null}
            onOpenVendor={(id) => setVendorId(id as Id<"vendors">)}
          />
        </div>
      )}
      {vendorId && (
        <VendorModal vendorId={vendorId} onClose={() => setVendorId(null)} />
      )}
    </>
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
    return <LoadingNote text="Reading your requirements…" />;
  }

  return (
    <div className="scroll-region flex-1">
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
    </div>
  );
}

function CampaignScreen({ campaignId }: { campaignId: Id<"campaigns"> }) {
  const [tab, setTab] = useState<"live" | "compare">("live");
  const [threadCvId, setThreadCvId] = useState<Id<"campaignVendors"> | null>(null);
  const [vendorId, setVendorId] = useState<Id<"vendors"> | null>(null);

  const data = useQuery(api.campaigns.get, { campaignId });
  const pipelineRows = useQuery(api.campaigns.pipeline, { campaignId });
  const events = useQuery(api.campaigns.activity, { campaignId });
  const resolveApproval = useMutation(api.campaigns.resolveApproval);
  const selectVendor = useMutation(api.campaigns.selectVendor);
  const closeCampaign = useMutation(api.campaigns.closeCampaign);
  const contactVendors = useMutation(api.campaigns.contactVendors);

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
    <>
      <CampaignLive
        view={view}
        rows={rows}
        events={events}
        tab={tab}
        onTab={setTab}
        compare={
          <Compare rows={rows} requirements={spec?.requirements ?? []} />
        }
        onOpenThread={(row) =>
          setThreadCvId(row.cv._id as Id<"campaignVendors">)
        }
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
        onContactVendors={() => void contactVendors({ campaignId })}
      />

      {threadCvId && (
        <ThreadModal campaignVendorId={threadCvId} onClose={() => setThreadCvId(null)} />
      )}
      {vendorId && <VendorModal vendorId={vendorId} onClose={() => setVendorId(null)} />}
    </>
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
          isDemoVendor={detail.vendor?.isDemoVendor ?? false}
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#262626]/25 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="scroll-region my-6 max-h-[calc(100vh-3rem)] w-full max-w-6xl rounded-lg border border-line bg-canvas"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex justify-end border-b border-line bg-canvas/95 px-3 py-2 backdrop-blur">
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:bg-raise hover:text-ink"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LoadingNote({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex items-center gap-2 text-[13px] text-ink-soft">
        <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse-dot" />
        {text}
      </div>
    </div>
  );
}

export { ScreenBar };
