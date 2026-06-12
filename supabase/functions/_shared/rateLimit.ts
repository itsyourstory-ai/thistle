// Fixed-window per-user rate limiter backed by the edge_rate_limits table.
// Returns true if the call is allowed, false if the limit is exceeded.
// Uses an atomic Postgres function to avoid the read-then-write race.
export async function checkRateLimit(
  supabase: any,
  userId: string,
  fn: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(
    Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000,
  ).toISOString();
  const { data, error } = await supabase.rpc("increment_rate_limit", {
    p_user_id: userId,
    p_fn: fn,
    p_window_start: windowStart,
    p_limit: limit,
  });
  if (error) {
    // Fail open so the app stays functional if the migration hasn't applied yet.
    console.error("checkRateLimit error:", error.message);
    return true;
  }
  return data === true;
}
