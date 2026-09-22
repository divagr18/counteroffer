import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import actionRetrier from "@convex-dev/action-retrier/convex.config.js";

const app = defineApp();

// Static hosting serves the built frontend from <deployment>.convex.site.
// Registered WITHOUT an httpPrefix so the component's catch-all is mounted
// inside our own router (convex/http.ts) and the AgentMail webhook keeps its
// existing root URL (/agentmail-webhook). Exact routes win over the catch-all.
app.use(staticHosting);

// Application-level throttles on outbound email and paid discovery calls.
app.use(rateLimiter);

// Exponential-backoff retries for third-party writes (AgentMail sends).
app.use(actionRetrier);

export default app;
