// Shared input validation helpers for Supabase edge functions.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Asserts that `value` is a well-formed UUID string and returns it.
 * Throws if it is not — call this before using a client-supplied id in a query.
 */
export function assertUuid(value: unknown, label = "id"): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}
