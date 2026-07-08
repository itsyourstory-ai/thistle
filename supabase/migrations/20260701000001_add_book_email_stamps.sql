-- ── book generation lifecycle email send stamps ─────────────────────────────
-- Nullable stamps keep Loops transactional sends idempotent per generated book.

ALTER TABLE public.generated_books
  ADD COLUMN creating_email_sent_at timestamptz,
  ADD COLUMN ready_email_sent_at timestamptz,
  ADD COLUMN failed_email_sent_at timestamptz;
