/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agents from "../agents.js";
import type * as agentmail from "../agentmail.js";
import type * as campaigns from "../campaigns.js";
import type * as crons from "../crons.js";
import type * as firecrawl from "../firecrawl.js";
import type * as http from "../http.js";
import type * as offers from "../offers.js";
import type * as openai from "../openai.js";
import type * as seed from "../seed.js";
import type * as threads from "../threads.js";
import type * as users from "../users.js";
import type * as vendors from "../vendors.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  agentmail: typeof agentmail;
  campaigns: typeof campaigns;
  crons: typeof crons;
  firecrawl: typeof firecrawl;
  http: typeof http;
  offers: typeof offers;
  openai: typeof openai;
  seed: typeof seed;
  threads: typeof threads;
  users: typeof users;
  vendors: typeof vendors;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
