# What's Next

## Work completed and current state

Branch: `feature/real-auth` — all work below is committed in `e2c9f00`.

**What's done:**
- **Phase 0** (external setup): New Supabase project `uglsyitjasajubfvbiry` created, full schema applied via SQL editor, Email + Google auth providers enabled, redirect URLs set, Google OAuth credentials pasted (user completed this).
- **Phase 1** (auth foundation): `AuthContext.tsx`, `ProtectedRoute.tsx`, `RootRedirect.tsx` all created. `Login.tsx` wired to real Supabase handlers (signIn, signUp, signInWithGoogle, resetPassword). Dev-bypass button removed. `App.tsx` has `AuthProvider` wrapping `WizardProvider`, root `"/"` uses `RootRedirect`, all `/step/*` routes gated by `ProtectedRoute`. `/dashboard` is a placeholder (`<div>Dashboard coming soon</div>`).
- **Phase 2** (DB ownership): Migration `20260610000001_add_auth_ownership.sql` applied — `profiles` table, `handle_new_user` trigger, `user_id` column on `generated_books`, per-user RLS replacing the open read policy. Supabase types regenerated. `generate-book/index.ts` has JWT auth gate (401 if no session) and stamps `user_id` on the book row insert.
- **OpenRouter**: All 6 AI edge functions (`generate-book`, `generate-book-images`, `generate-character-portrait`, `generate-cover`, `generate-summary`, `extract-appearance-traits`) switched from `ai.gateway.lovable.dev` to `openrouter.ai/api/v1/chat/completions`. Key renamed `LOVABLE_API_KEY` → `OPENROUTER_API_KEY`. Secret set in Supabase dashboard, all functions redeployed.
- **Tests**: 86/86 passing (1 pre-existing flaky timeout in `stepValidation.test.tsx:99` — unrelated to auth).
- **Google Drive plan**: `docs/plan-google-drive-fix.md` — documents the broken Lovable connector and the service-account replacement approach. Deferred to a separate PR.

---

## Work Remaining

The big master plan lives at `/Users/jordan/.claude/plans/i-want-to-develop-encapsulated-bentley.md`. The phases below map to it.

### Phase 3 — Resumable Drafts

**Blocker decision first:** How to handle image data in drafts. `WizardAnswers` stores base64 data URLs for uploaded photos and generated portraits — naively dumping them to a `jsonb` column can be many MB per row. Two options:
- **Option A (recommended):** Upload user photos to a Supabase Storage private bucket on capture; store only the storage path. Strip generated images (portraits, cover) before persisting — the existing `useCharacterPortrait`/`useSupportingPortraits` hooks will regenerate them on resume.
- **Option B (simpler):** Persist text fields only; have users re-upload photos on resume. Worse UX but zero infrastructure.

**Once decided, build:**
1. Migration: `book_drafts` table — `id`, `user_id → auth.users ON DELETE CASCADE`, `answers jsonb`, `current_step int`, `child_name text` (denormalized for dashboard), `updated_at`, `created_at`. RLS: full CRUD on own rows.
2. `src/hooks/useDraftPersistence.ts` — debounced upsert once `childName` is set; exposes `saveNow()` and tracks `dirty` flag.
3. `src/components/WizardHeader.tsx` — wire "Save & exit" button to `saveNow()` → navigate to `/dashboard` (currently the button does nothing; it was not wired in this PR).
4. `beforeunload` guard in wizard when `dirty`.
5. Resume flow: dashboard draft card → `/step/<current_step>` with draft loaded into `WizardContext` via `seedAnswers()`. On book generation success, delete the draft.

### Phase 4 — Dashboard

Currently a placeholder div at `/dashboard`. Build:
1. `src/pages/Dashboard.tsx` — two sections: "In progress" (drafts) and "My books" (generated). Query `book_drafts` and `generated_books` for current user via RLS. "Create a new book" → reset `WizardContext` + navigate to `/step/1-name`. Empty state via existing `EmptyState` component.
2. `src/components/BookCard.tsx` and `DraftCard.tsx` — cover thumbnail, title/child name, status. BookCard opens preview; DraftCard resumes wizard.
3. App shell/header for `/dashboard` + `/account` — account link + sign out. Match wizard green/cream branding. (The wizard steps have `WizardHeader`; dashboard/account need their own simpler header.)

### Phase 5 — Account page

New route `/account` (protected):
1. `src/pages/Account.tsx` — profile section (show email, edit `display_name` → update `profiles`), sign out, set/change password (`supabase.auth.updateUser({ password })`), delete account (confirmation dialog → call `delete-account` edge function), order history placeholder.
2. `supabase/functions/delete-account/index.ts` — resolve user from JWT, `supabase.auth.admin.deleteUser(user.id)` via service role. `ON DELETE CASCADE` on `profiles`, `generated_books`, `book_drafts` handles cleanup.

### Phase 6 — Apple Sign-In (deferred)

Waiting on Apple Developer account. When ready: add Apple button to `Login.tsx` calling `signInWithProvider('apple')`. The `signInWithProvider` generic helper in `AuthContext.tsx` is already structured for this.

---

## Dead Ends

- **`supabase db push`** — don't use it on this project. The remote migration history is completely out of sync with the local `supabase/migrations/` directory (Lovable created the old project's schema outside of CLI migrations). Apply all migrations via the Supabase SQL editor instead.
- **Old Supabase project `coiobrdbqledpzvcttto`** — this belongs to the `its-your-story` app, not Thistle. Do not use it.
- **LOVABLE_API_KEY** — Lovable-managed, inaccessible outside Lovable. Fully replaced by `OPENROUTER_API_KEY`.
- **Google Drive connector (`connector-gateway.lovable.dev`)** — Lovable-proprietary, no key available. Export functions silently fail. See `docs/plan-google-drive-fix.md` for the replacement approach.

---

## Open Questions

1. **Draft image handling** (Phase 3 blocker): Option A (Supabase Storage) or Option B (text-only, re-upload on resume)? Decide before building Phase 3.
2. **`/dev/story-preview/:id`** — currently a public route with no auth. After RLS swap, it only works for the book's owner. Should it be gated by `ProtectedRoute` or stay open for owner-only access?
3. **Dashboard redirect after book generation** — currently Step 9 (generating) navigates somewhere after completion. Should it go to `/dashboard` now that one exists, or stay on the preview step?
