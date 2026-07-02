/* eslint-disable */
/**
 * A utility for referencing Convex functions in your app's API.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as profiles from "../profiles.js";
import type * as stats from "../stats.js";

declare const fullApi: ApiFromModules<{
  profiles: typeof profiles;
  stats: typeof stats;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<"query" | "mutation" | "action", "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<"query" | "mutation" | "action", "internal">
>;
export declare const components: {};
