export type Stage =
  | "discovered"
  | "qualified"
  | "eliminated"
  | "contacted"
  | "replied"
  | "negotiating"
  | "finalist"
  | "selected";

export type CampaignStatus =
  | "draft"
  | "requirements_review"
  | "sourcing"
  | "active"
  | "finalists"
  | "selected"
  | "closed";

export interface Requirement {
  id: string;
  label: string;
  kind: "required" | "preferred";
}

export interface CampaignSpec {
  category: string;
  location: string;
  targetDate?: string;
  quantity?: number;
  budgetType: "fixed" | "per_person" | "per_hour" | "package";
  targetBudget: number;
  hardBudget: number;
  currency: string;
  requirements: Requirement[];
  negotiable: string[];
}

export interface Permissions {
  outreach: "auto" | "ask";
  clarification: "auto" | "ask";
  negotiation: "auto" | "ask";
  selection: "auto" | "ask";
}

export interface Campaign {
  _id: string;
  title: string;
  category: string;
  description: string;
  status: CampaignStatus;
  location: string;
  currency: string;
  targetBudget: number;
  hardBudget: number;
  spec?: CampaignSpec;
  permissions: Permissions;
  createdAt: number;
  updatedAt: number;
}

export interface Vendor {
  _id: string;
  name: string;
  category: string;
  description?: string;
  locations: string[];
  services: string[];
  email?: string;
  phone?: string;
  website?: string;
  aliases: string[];
  sourceUrls: string[];
  confidence: number;
  isDemoVendor: boolean;
  demoBehavior?: string;
}

export interface OfferLineItem {
  label: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  required: boolean;
  included: boolean;
  isAddon: boolean;
}

export interface Offer {
  _id: string;
  revisionNumber: number;
  currency: string;
  lineItems: OfferLineItem[];
  subtotal: number;
  taxAmount?: number;
  taxesIncluded: boolean;
  travelIncluded?: boolean;
  travelAmount?: number;
  estimatedTotal: number;
  assumptions: string[];
  coverageHours?: number;
  deliverables: string[];
  deliveryTimelineDays?: number;
  completenessScore: number;
  missingFields: string[];
  status: "draft" | "active" | "superseded" | "withdrawn";
}

export interface ThreadInfo {
  _id: string;
  subject: string;
  state: string;
  lastMessageAt: number;
}

export interface CampaignVendor {
  _id: string;
  stage: Stage;
  qualificationScore: number;
  offerScore?: number;
  availability?: boolean;
  contactedAt?: number;
  repliedAt?: number;
  satisfiedRequirements: string[];
  missingRequirements: string[];
  eliminationReason?: string;
}

export interface PipelineRow {
  cv: CampaignVendor;
  vendor: Vendor | null;
  offer: Offer | null;
  firstOffer?: Offer | null;
  thread: ThreadInfo | null;
}

export interface Counts {
  discovered: number;
  qualified: number;
  eliminated: number;
  contacted: number;
  replied: number;
  negotiating: number;
  finalist: number;
  selected: number;
  discoveredTotal: number;
}

export interface CampaignEvent {
  _id?: string;
  type: string;
  summary: string;
  createdAt: number;
}

export interface Approval {
  _id: string;
  kind: "select_finalist" | "share_personal_details" | "send_outreach";
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  campaignVendorId?: string | null;
}

export interface Message {
  _id?: string;
  direction: "inbound" | "outbound";
  fromAddress: string;
  subject: string;
  bodyText: string;
  kind?: string;
  timestamp: number;
}

export interface Evidence {
  claim: string;
  sourceUrl: string;
  snippet: string;
  confidence: number;
}

export interface VendorMetrics {
  campaignsSeen: number;
  timesContacted: number;
  replies: number;
  medianResponseMs?: number;
  medianInitialQuote?: number;
  medianFinalQuote?: number;
  typicalDiscountPct?: number;
  timesSelected: number;
  userRating?: number;
}

export interface CampaignView {
  campaign: Campaign;
  mailboxEmail?: string;
  counts: Counts;
  approvals: Approval[];
  bestOffer: { offer: Offer; vendorName: string } | null;
}

export interface UserMemory {
  totalSelections: number;
  nonCheapestSelections: number;
  medianSelectedResponseMs: number | null;
  categoryCounts: { category: string; count: number }[];
}

export interface NetworkEntry {
  vendor: Vendor;
  metrics: VendorMetrics | null;
}
