-- ── Profiles ──────────────────────────────────────────────────────────────────
-- One row per auth user, auto-seeded on signup by the trigger below.

CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  display_name text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-populate a profile row whenever a new auth user is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── generated_books: per-user ownership ───────────────────────────────────────

ALTER TABLE public.generated_books
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_generated_books_user_id ON public.generated_books(user_id);

-- Swap the open "anyone can read" policy for a per-user one.
-- The open SELECT policy was created in the initial migration.
DROP POLICY IF EXISTS "Anyone can read generated_books" ON public.generated_books;

CREATE POLICY "Users read own generated_books"
  ON public.generated_books FOR SELECT
  USING (auth.uid() = user_id);
