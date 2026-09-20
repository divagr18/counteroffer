import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Safety net so a missed webhook never stalls a campaign (doc §71).
crons.interval(
  "poll campaign inboxes",
  { minutes: 5 },
  internal.agents.pollAllInboxes,
);

// Detect vendors that went quiet after outreach and send one polite nudge.
crons.interval(
  "follow up stalled vendors",
  { minutes: 30 },
  internal.agents.followUpAllActive,
);

export default crons;
