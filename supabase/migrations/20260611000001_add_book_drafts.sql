-- ── book_drafts ──────────────────────────────────────────────────────────────
-- One row per in-progress wizard session. Auto-created on the first answer
-- that has a childName; deleted when book generation completes.

CREATE TABLE public.book_drafts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_name   text,
  answers      jsonb       NOT NULL DEFAULT '{}',
  current_step text        NOT NULL DEFAULT '/step/1-name',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_book_drafts_user_id ON public.book_drafts(user_id);

ALTER TABLE public.book_drafts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read, write, update, and delete their own drafts.
CREATE POLICY "Users manage own drafts"
  ON public.book_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
