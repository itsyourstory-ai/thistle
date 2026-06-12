-- Atomic fixed-window increment for edge_rate_limits.
-- Returns true if the call is within the limit, false if exceeded.
-- A single INSERT ... ON CONFLICT ... RETURNING avoids the read-then-write
-- race in application code and halves round-trips vs. SELECT + UPSERT.

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_user_id      uuid,
  p_fn           text,
  p_window_start timestamptz,
  p_limit        int
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  new_count int;
BEGIN
  INSERT INTO public.edge_rate_limits (user_id, fn, window_start, count)
  VALUES (p_user_id, p_fn, p_window_start, 1)
  ON CONFLICT (user_id, fn, window_start) DO UPDATE
    -- Cap at p_limit + 1 to prevent unbounded growth on hammered windows.
    SET count = LEAST(edge_rate_limits.count + 1, p_limit + 1)
  RETURNING count INTO new_count;
  RETURN new_count <= p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_rate_limit FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit TO service_role;
