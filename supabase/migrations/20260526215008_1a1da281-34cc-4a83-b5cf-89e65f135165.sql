
-- generated_books: drop wide-open INSERT/UPDATE policies (only edge functions write, using service_role which bypasses RLS).
DROP POLICY IF EXISTS "Anyone can insert generated_books" ON public.generated_books;
DROP POLICY IF EXISTS "Anyone can update generated_books" ON public.generated_books;

-- Revoke client write privileges on generated_books; keep SELECT for progress polling.
REVOKE INSERT, UPDATE, DELETE ON public.generated_books FROM anon, authenticated;

-- Hide buyer contact columns from anon/authenticated; service_role still sees everything.
REVOKE SELECT (buyer_email, buyer_name) ON public.generated_books FROM anon, authenticated;

-- book_images: drop all public policies. Edge functions use service_role and bypass RLS.
DROP POLICY IF EXISTS "Anyone can read book_images" ON public.book_images;
DROP POLICY IF EXISTS "Anyone can insert book_images" ON public.book_images;
DROP POLICY IF EXISTS "Anyone can update book_images" ON public.book_images;
DROP POLICY IF EXISTS "Anyone can delete book_images" ON public.book_images;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.book_images FROM anon, authenticated;

-- book_image_upload_attempts: same lockdown. Only server writes/reads.
DROP POLICY IF EXISTS "Anyone can read book_image_upload_attempts" ON public.book_image_upload_attempts;
DROP POLICY IF EXISTS "Anyone can insert book_image_upload_attempts" ON public.book_image_upload_attempts;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.book_image_upload_attempts FROM anon, authenticated;
