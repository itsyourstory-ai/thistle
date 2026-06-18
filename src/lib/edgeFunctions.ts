/**
 * Central wrapper for all Supabase edge-function calls.
 *
 * Returns the same { data, error } shape as supabase.functions.invoke so
 * every call site is a near-identical one-line change.
 *
 * In DEV with test mode on, returns fixture responses instead of calling
 * Supabase (fixture lookup added in Phase B). With test mode off, always
 * calls live — production behaviour is byte-identical.
 *
 * AIDEV-NOTE: All six AI edge-function calls in the app route through here.
 * This is the single choke point for mock/live/cache decisions.
 */

import { supabase } from "@/integrations/supabase/client";
import { getTestMode, isForcedError, isPerFnLive } from "./testMode";
import { getFixture } from "@/test/fixtures";
import { cacheGet, cachePut } from "./edgeCache";

export type EdgeFnName =
  | "create-payment-intent"
  | "generate-summary"
  | "generate-cover"
  | "generate-character-portrait"
  | "extract-appearance-traits"
  | "generate-book"
  | "generate-book-images";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call a Supabase edge function.
 *
 * @param name  The edge function name.
 * @param body  Request body (passed as-is to the function).
 */
export async function callEdge(
  name: EdgeFnName,
  body: Record<string, unknown>,
): Promise<{ data: any; error: any }> {
  // ── Test mode (DEV only) ────────────────────────────────────────────────────
  if (import.meta.env.DEV) {
    const mode = getTestMode();

    if (mode.enabled && !isPerFnLive(name)) {
      const { delayMs } = mode;

      // Fake latency so loading/error UI states are visible.
      if (delayMs > 0) await sleep(delayMs);

      // Forced error — lets you test error-handling UI on demand.
      if (isForcedError(name)) {
        return {
          data: null,
          error: new Error(`[test mode] Forced error on ${name}`),
        };
      }

      // Return a fixture if one is defined for this function + profile.
      const fixture = getFixture(name, mode.profileId);
      if (fixture !== null) return fixture;
    }
  }

  // ── Cache — replay hit (test mode off also benefits from this) ─────────────
  if (import.meta.env.DEV) {
    const { cacheMode } = getTestMode();
    if (cacheMode === "replay") {
      const hit = await cacheGet(name, body);
      if (hit) return hit;
      // Miss: fall through to live and record.
    }
  }

  // ── Live call ───────────────────────────────────────────────────────────────
  const result = await supabase.functions.invoke(name, { body });

  // ── Cache — record (store the response for future replay) ──────────────────
  if (import.meta.env.DEV) {
    const { cacheMode } = getTestMode();
    if (cacheMode === "record" || cacheMode === "replay") {
      void cachePut(name, body, result);
    }
  }

  return result;
}
