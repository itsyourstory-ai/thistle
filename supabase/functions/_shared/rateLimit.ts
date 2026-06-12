// Fixed-window per-user rate limiter backed by the edge_rate_limits table.
// Returns true if the call is allowed, false if the limit is exceeded.
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
  // Atomic-ish upsert + increment. Read current, then upsert.
  const { data } = await supabase
    .from("edge_rate_limits")
    .select("count")
    .eq("user_id", userId).eq("fn", fn).eq("window_start", windowStart)
    .maybeSingle();
  const current = data?.count ?? 0;
  if (current >= limit) return false;
  await supabase.from("edge_rate_limits").upsert(
    { user_id: userId, fn, window_start: windowStart, count: current + 1 },
    { onConflict: "user_id,fn,window_start" },
  );
  return true;
}
