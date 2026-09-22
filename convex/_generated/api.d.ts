/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentmail from "../agentmail.js";
import type * as agents from "../agents.js";
import type * as campaigns from "../campaigns.js";
import type * as crons from "../crons.js";
import type * as firecrawl from "../firecrawl.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as lib_components from "../lib/components.js";
import type * as lib_httpUtil from "../lib/httpUtil.js";
import type * as lib_llmSchemas from "../lib/llmSchemas.js";
import type * as lib_negotiate from "../lib/negotiate.js";
import type * as lib_normalize from "../lib/normalize.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_score from "../lib/score.js";
import type * as lib_stateMachine from "../lib/stateMachine.js";
import type * as lib_types from "../lib/types.js";
import type * as offers from "../offers.js";
import type * as openai from "../openai.js";
import type * as seed from "../seed.js";
import type * as threads from "../threads.js";
import type * as users from "../users.js";
import type * as vendors from "../vendors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentmail: typeof agentmail;
  agents: typeof agents;
  campaigns: typeof campaigns;
  crons: typeof crons;
  firecrawl: typeof firecrawl;
  helpers: typeof helpers;
  http: typeof http;
  "lib/components": typeof lib_components;
  "lib/httpUtil": typeof lib_httpUtil;
  "lib/llmSchemas": typeof lib_llmSchemas;
  "lib/negotiate": typeof lib_negotiate;
  "lib/normalize": typeof lib_normalize;
  "lib/prompts": typeof lib_prompts;
  "lib/score": typeof lib_score;
  "lib/stateMachine": typeof lib_stateMachine;
  "lib/types": typeof lib_types;
  offers: typeof offers;
  openai: typeof openai;
  seed: typeof seed;
  threads: typeof threads;
  users: typeof users;
  vendors: typeof vendors;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  actionRetrier: import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
};
