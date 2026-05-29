
ALTER TABLE public.generated_books
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS pipeline_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS pipeline_progress jsonb,
  ADD COLUMN IF NOT EXISTS pipeline_error text;

-- Allow updates on generated_books (previously only insert/select were allowed).
DROP POLICY IF EXISTS "Anyone can update generated_books" ON public.generated_books;
CREATE POLICY "Anyone can update generated_books"
  ON public.generated_books
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.book_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  kind text NOT NULL,
  slot integer NOT NULL,
  prompt text,
  image_data_url text,
  drive_file_id text,
  drive_file_url text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  generated_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (book_id, kind, slot)
);

CREATE INDEX IF NOT EXISTS idx_book_images_book ON public.book_images(book_id);

ALTER TABLE public.book_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read book_images"
  ON public.book_images FOR SELECT USING (true);

CREATE POLICY "Anyone can insert book_images"
  ON public.book_images FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update book_images"
  ON public.book_images FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete book_images"
  ON public.book_images FOR DELETE USING (true);
