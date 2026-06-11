# Auth Implementation Plan

## Decisions
- **Sign-in methods:** Email/password + Google OAuth. Defer Apple (requires paid Apple Developer account, only needed for App Store).
- **Access model:** Login required — all `/step/*` routes are gated. No guest flow.
- **Data ownership:** Full per-user ownership from the start. Every book has an owner.

## External setup (dashboard work, do once before coding)
1. **Supabase dashboard → Authentication → Providers:** enable Email and Google. Set Site URL + redirect URLs for `http://localhost:8080` and your Vercel staging/production domains.
2. **Google Cloud Console:** create an OAuth 2.0 client ID/secret, paste into the Supabase Google provider config.

---

## Phase A — Frontend auth

### 1. `src/contexts/AuthContext.tsx` (new)
Mirror the `WizardContext` pattern. Provider holds `session`, `user`, `loading`. On mount, call `supabase.auth.getSession()` to resolve the initial session, then subscribe to `supabase.auth.onAuthStateChange`. Expose:

```ts
signIn(email, password)        // → supabase.auth.signInWithPassword
signUp(email, password)        // → supabase.auth.signUp (with emailRedirectTo)
signInWithGoogle()             // → supabase.auth.signInWithOAuth({ provider: 'google', redirectTo })
signOut()                      // → supabase.auth.signOut
```

`loading` stays `true` until `getSession` resolves — this prevents bouncing an authenticated user to `/login` on a cold load.

Wrap `<App>` in `<AuthProvider>` alongside the existing `<WizardProvider>` in `src/App.tsx`.

The Supabase client ([`src/integrations/supabase/client.ts`](../src/integrations/supabase/client.ts)) is already configured with `persistSession: true` and `autoRefreshToken: true` — no changes needed there.

### 2. Wire `src/pages/Login.tsx`
The login UI is already fully designed and styled. Just swap the mock handlers (currently `setTimeout` → navigate):
- `handleSubmit` → call `signIn` or `signUp` depending on `mode`, surface errors via `toast.error(error.message)` (use `sonner`)
- `handleGoogle` → call `signInWithGoogle()` (OAuth redirects the window; only show an error toast if the redirect itself fails)
- Remove the "Skip login (dev preview)" link at the bottom

**Do not change the layout or design.**

### 3. `src/components/ProtectedRoute.tsx` (new)
```tsx
export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen messages={["Loading…"]} />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

In `src/App.tsx`:
- Change the root route `"/"` from `<Login />` to a `<RootRedirect />` component: if `loading` show spinner, if `session` go to `pathForStep(1)`, else go to `/login`.
- Wrap every `/step/*` route element with `<ProtectedRoute>`.
- `/dev/story-preview/:id` stays public (it's intentionally unlinked).

### 4. Logout in `src/components/WizardHeader.tsx`
The "Save & exit" button is already there but non-functional. Wire it:
```tsx
const { signOut } = useAuth();
const navigate = useNavigate();
const handleExit = async () => { await signOut(); navigate('/login'); };
```

---

## Phase B — Database migration (one file)

`supabase/migrations/<timestamp>_add_user_ownership.sql`:

```sql
-- Ownership column on generated_books.
-- Nullable so pre-auth rows survive; they belong to no one and won't surface for any user.
ALTER TABLE public.generated_books
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_generated_books_user_id ON public.generated_books(user_id);

-- Replace the open "anyone can read" policy (added in the first migration) with per-user ownership.
DROP POLICY IF EXISTS "Anyone can read generated_books" ON public.generated_books;

CREATE POLICY "Users read own generated_books"
  ON public.generated_books FOR SELECT
  USING (auth.uid() = user_id);

-- Profiles table: one row per auth user, auto-populated on signup.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Apply with `supabase db push` or via the Supabase SQL editor.

---

## Phase C — Edge function: thread `user_id` into `generate-book`

`supabase.functions.invoke` automatically forwards the logged-in user's JWT in the `Authorization` header. In `supabase/functions/generate-book/index.ts`, at the top of the request handler (after parsing `body`):

```ts
// Resolve caller from forwarded JWT. Login is required; 401 if missing.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
});
const { data: { user } } = await userClient.auth.getUser();
if (!user) {
  return new Response(
    JSON.stringify({ error: "Authentication required." }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
const userId = user.id;
```

Then add `user_id: userId` to the `.insert({...})` payload when creating the stub row.

The `supabaseUrl` variable is already used further down to create the service-role client — pull it up so it can be shared. Remove the duplicate `const supabaseUrl = ...` declaration.

Other functions (`generate-book-images`, `export-book-to-drive`) operate on an existing book by id via service_role — no auth changes needed.

`supabase/config.toml` has `verify_jwt = false` for all functions. Leave it — the in-code 401 check in `generate-book` is sufficient.

---

## Tests to write (TDD — write tests first)

| Test file | What to cover |
|---|---|
| `src/contexts/AuthContext.test.tsx` | `getSession` called on mount; `onAuthStateChange` subscribed/unsubscribed; `signIn` calls `signInWithPassword`; `signUp` calls `signUp`; `signInWithGoogle` uses `provider: 'google'`; `signOut` calls signOut; `useAuth` throws outside provider |
| `src/components/ProtectedRoute.test.tsx` | Shows spinner while `loading`; renders children when session exists; redirects to `/login` when no session |
| `src/pages/Login.test.tsx` | Submitting calls `signIn` with credentials; error surfaces a toast and no navigation; signup mode calls `signUp`; Google button calls `signInWithGoogle`; empty fields don't submit |

Mock `@/integrations/supabase/client` and `@/contexts/AuthContext` in tests (see existing test patterns in `src/test/`).

---

## Verification

1. `npm test` — all tests pass
2. `npm run lint` — 0 errors
3. `npm run build` — succeeds
4. Manual: visit `/` while logged out → redirected to `/login`; visit `/step/3-genre` directly → redirected to `/login`
5. Manual: sign up with email → land on step 1; "Save & exit" signs out and returns to `/login`; sign back in
6. Manual: after Google provider is configured, "Continue with Google" completes OAuth and lands on step 1
7. Manual: generate a book; confirm the `generated_books` row has your `user_id` in Supabase dashboard

---

## Files touched summary

| File | Action |
|---|---|
| `src/contexts/AuthContext.tsx` | **Create** |
| `src/contexts/AuthContext.test.tsx` | **Create** |
| `src/components/ProtectedRoute.tsx` | **Create** |
| `src/components/ProtectedRoute.test.tsx` | **Create** |
| `src/pages/Login.test.tsx` | **Create** |
| `src/pages/Login.tsx` | **Edit** — swap mock handlers, remove dev-skip button |
| `src/App.tsx` | **Edit** — add `AuthProvider`, `RootRedirect`, wrap steps in `ProtectedRoute` |
| `src/components/WizardHeader.tsx` | **Edit** — wire "Save & exit" to `signOut` |
| `supabase/migrations/<ts>_add_user_ownership.sql` | **Create** |
| `supabase/functions/generate-book/index.ts` | **Edit** — resolve user from JWT, add `user_id` to insert |
