-- ── order_book_inputs ─────────────────────────────────────────────────────────
-- What the server needs to start a book for a paid order without the buyer's
-- browser (THI-38): the story brief and the approved character portrait.
-- create-payment-intent saves them at checkout; generate-book reads them when
-- stripe-webhook starts the book after payment.
--
-- A separate table (not columns on orders) because the portrait is a
-- multi-megabyte base64 image, and orders is readable by the buyer and read
-- with select(*) elsewhere. service_role only; no client access.
--
-- Apply by hand before the function deploy (see docs/deploy.md).

CREATE TABLE public.order_book_inputs (
  order_id               uuid        PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  brief                  jsonb       NOT NULL,
  seed_portrait_data_url text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_book_inputs ENABLE ROW LEVEL SECURITY;

-- No policies: service_role bypasses RLS and is the only reader/writer.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.order_book_inputs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_book_inputs TO service_role;
