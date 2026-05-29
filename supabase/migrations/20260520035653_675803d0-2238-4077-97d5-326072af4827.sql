CREATE TABLE public.book_image_upload_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_image_id uuid NOT NULL,
  book_id uuid NOT NULL,
  kind text NOT NULL,
  slot integer NOT NULL,
  attempt integer NOT NULL,
  source text NOT NULL,
  outcome text NOT NULL,
  http_status integer,
  duration_ms integer,
  error text,
  drive_file_id text,
  drive_file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bi_upload_attempts_book ON public.book_image_upload_attempts (book_id, created_at DESC);
CREATE INDEX idx_bi_upload_attempts_image ON public.book_image_upload_attempts (book_image_id, created_at DESC);

ALTER TABLE public.book_image_upload_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read book_image_upload_attempts"
  ON public.book_image_upload_attempts FOR SELECT USING (true);

CREATE POLICY "Anyone can insert book_image_upload_attempts"
  ON public.book_image_upload_attempts FOR INSERT WITH CHECK (true);
