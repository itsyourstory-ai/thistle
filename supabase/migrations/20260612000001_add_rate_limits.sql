-- ── edge_rate_limits: per-user fixed-window rate limiting ─────────────────────
-- Written/read only by edge functions using service_role (bypasses RLS).

CREATE TABLE public.edge_rate_limits (
  user_id      uuid        NOT NULL,
  fn           text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        int         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, fn, window_start)
);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: only service_role touches this table, and
-- service_role bypasses RLS. Lock out client roles entirely.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.edge_rate_limits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edge_rate_limits TO service_role;
