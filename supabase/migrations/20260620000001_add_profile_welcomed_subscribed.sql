-- ── profiles: welcomed_at + subscribed ────────────────────────────────────────
-- welcomed_at: nullable timestamp set the first time a welcome email is sent
--   (TIC-28). Guards at-least-once delivery — if not null, skip the welcome.
-- subscribed: mirrors the user's marketing opt-in status in Loops (TIC-31).
--   Defaults to true on signup; user can opt out in account settings.

ALTER TABLE public.profiles ADD COLUMN welcomed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN subscribed boolean NOT NULL DEFAULT true;

-- No new RLS policies or GRANTs needed: the existing "Users read own profile"
-- and "Users update own profile" policies already cover these columns.
