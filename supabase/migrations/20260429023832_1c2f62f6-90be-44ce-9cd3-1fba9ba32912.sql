CREATE TABLE public.generated_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  framework_id text NOT NULL,
  brief jsonb NOT NULL,
  raw_output text,
  parsed jsonb,
  model text NOT NULL,
  prompt_hash text,
  generation_ms integer,
  status text NOT NULL DEFAULT 'ok'
);

ALTER TABLE public.generated_books ENABLE ROW LEVEL SECURITY;

-- Open access for the prototype: this table holds no PII (just wizard inputs +
-- generated story prose for QA). Tighten when auth ships.
CREATE POLICY "Anyone can read generated_books"
  ON public.generated_books FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert generated_books"
  ON public.generated_books FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_generated_books_created_at ON public.generated_books(created_at DESC);