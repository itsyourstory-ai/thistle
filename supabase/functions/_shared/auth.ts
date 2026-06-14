// Shared auth helpers for Supabase edge functions.
// All helpers are header-only — they never call req.json().

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";

export type GetUserFn = () => Promise<{ data: { user: User | null } }>;

/**
 * Returns the authenticated Supabase user from the request's Authorization
 * header, or null if no valid user session is present.
 *
 * Replicates generate-book's anon-key resolution: tries SUPABASE_ANON_KEY
 * first, then falls back to SUPABASE_PUBLISHABLE_KEYS.default for newer
 * projects where the legacy env var is absent.
 *
 * Accepts an optional getUserFn for unit testing (avoids network calls).
 */
export async function requireAuthedUser(
  req: Request,
  getUserFn?: GetUserFn,
): Promise<User | null> {
  if (getUserFn) {
    const { data: { user } } = await getUserFn();
    return user;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ||
    (JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? "");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

/**
 * Returns true if the request's Authorization bearer matches the
 * SUPABASE_SERVICE_ROLE_KEY — i.e., this is a trusted server-to-server
 * invoke (not a browser client call).
 *
 * Accepts an explicit serviceRoleKey for unit testing.
 */
export function isServiceRoleRequest(
  req: Request,
  serviceRoleKey?: string,
): boolean {
  const key = serviceRoleKey ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) return false;

  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return bearer === key;
}

/**
 * Returns a JSON error Response with CORS headers.
 * Always spreads corsHeaders — browser-invoked functions need CORS on
 * 401/403 or the browser surfaces an opaque network error instead.
 */
export function unauthorized(
  corsHeaders: Record<string, string>,
  status: 401 | 403,
  message: string,
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Returns a 429 rate-limit Response with CORS headers. */
export function rateLimitExceeded(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Creates a Supabase client authenticated as service_role. */
export function createServiceRoleClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
