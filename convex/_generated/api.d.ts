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
import type * as matches from "../matches.js";
import type * as moves from "../moves.js";
import type * as profiles from "../profiles.js";
import type * as rooms from "../rooms.js";
import type * as stats from "../stats.js";

declare const fullApi: ApiFromModules<{
  matches: typeof matches;
  moves: typeof moves;
  profiles: typeof profiles;
  rooms: typeof rooms;
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
