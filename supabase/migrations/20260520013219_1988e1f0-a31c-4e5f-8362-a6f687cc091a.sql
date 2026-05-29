ALTER TABLE public.generated_books
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_url text,
  ADD COLUMN IF NOT EXISTS drive_doc_id text,
  ADD COLUMN IF NOT EXISTS drive_doc_url text,
  ADD COLUMN IF NOT EXISTS drive_export_status text,
  ADD COLUMN IF NOT EXISTS drive_export_error text;