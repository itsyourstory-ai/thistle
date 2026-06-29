-- ── order email send stamps ──────────────────────────────────────────────────
-- Nullable stamps keep Loops transactional sends idempotent per order.
-- `refunded` is introduced as a free-text orders.status value; no enum or
-- constraint change is needed for the current text status column.

ALTER TABLE public.orders
  ADD COLUMN receipt_email_sent_at timestamptz,
  ADD COLUMN payment_failed_email_sent_at timestamptz,
  ADD COLUMN refund_email_sent_at timestamptz,
  ADD COLUMN abandoned_email_sent_at timestamptz;
