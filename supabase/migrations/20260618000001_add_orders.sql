-- ── orders ────────────────────────────────────────────────────────────────────
-- One row per checkout attempt, created when the PaymentIntent is created.
-- All writes are via service_role (edge functions). Authenticated users can
-- read their own rows only.

CREATE TABLE public.orders (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                    text        NOT NULL DEFAULT 'pending',
  product                   text        NOT NULL,
  base_amount_cents         int         NOT NULL,
  discount_code             text,
  discount_cents            int         NOT NULL DEFAULT 0,
  amount_cents              int         NOT NULL,
  currency                  text        NOT NULL DEFAULT 'usd',
  buyer_name                text,
  buyer_email               text,
  shipping                  jsonb,
  stripe_payment_intent_id  text        NOT NULL UNIQUE,
  stripe_customer_id        text,
  draft_id                  uuid        REFERENCES public.book_drafts(id) ON DELETE SET NULL,
  book_id                   uuid        REFERENCES public.generated_books(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  paid_at                   timestamptz
);

-- Upsert key: one active order per (user, draft)
CREATE UNIQUE INDEX idx_orders_user_draft ON public.orders(user_id, draft_id);

CREATE INDEX idx_orders_user_id ON public.orders(user_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- No client INSERT/UPDATE/DELETE — all writes via service_role (bypasses RLS).
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;

-- ── stripe_webhook_events ─────────────────────────────────────────────────────
-- Idempotency ledger. service_role only; no client access.

CREATE TABLE public.stripe_webhook_events (
  event_id    text        PRIMARY KEY,
  type        text        NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies: service_role bypasses RLS and is the only writer/reader.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.stripe_webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_webhook_events TO service_role;
