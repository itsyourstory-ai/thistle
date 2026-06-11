# What's Next

_Updated 2026-06-11 — security review done, PR open_

## Current state

**Branch:** `fix/edge-function-auth` — pushed, PR open.

**PR:** [#21 — fix: add auth & ownership gates to edge functions](https://github.com/itsyourstory-ai/thistle/pull/21)

**Notion ticket:** TIC-2 "Fix auth on AI calls" — status: In review

All 116 vitest tests pass. Changes are server-side Deno only (no frontend).

---

## To ship

1. Wait for "Lint & Test" CI to go green on PR #21
2. Merge on GitHub
3. Vercel auto-deploys `main` to staging (`thistle-sepia.vercel.app`)
4. Promote to production: Vercel dashboard → latest `main` deployment → `⋯` → **Promote to Production**

**Optional before merge:** install Deno (`brew install deno`) and run the new edge function tests:
```
deno test supabase/functions/_shared/auth.test.ts
```

---

## What's on this branch

- **New `supabase/functions/_shared/auth.ts`** — `requireAuthedUser`, `isServiceRoleRequest`, `unauthorized` helpers
- **Auth gate on 4 client-facing AI functions** — `generate-cover`, `generate-summary`, `generate-character-portrait`, `extract-appearance-traits` → 401 for unauthenticated callers
- **Service-role gate on 2 internal export functions** — `export-book-to-drive`, `export-book-images-to-drive` → 403 for non-internal callers
- **Dual-path auth on `generate-book-images`** — service-role bearer passes through; user JWT requires auth + ownership check (`generated_books.user_id`)
- **11 Deno unit tests** in `_shared/auth.test.ts`

---

## Gotchas

**Don't run `supabase db push` on the live project.** The migration history is out of sync (schema was built outside the CLI). Apply any new migrations via the Supabase SQL editor.

**`book_drafts` migration gap:** The table was created manually in a prior session. Migration `20260611000001_add_book_drafts.sql` captures it in source but the live DB already has it — skip if applying to live project.

**Supabase URL allow-list** includes `/account` for `http://localhost:8080` and `https://thistle-sepia.vercel.app`. Add a custom domain entry if production moves off Vercel.

**Deno not installed locally** — the new `_shared/auth.test.ts` tests can't run until you `brew install deno`.

---

## What's next (Phase 6+)

- **Apple Sign-In** — waiting on Apple Developer account. `signInWithProvider('apple')` is already wired in AuthContext; just needs the button in Login.tsx and Supabase config.
- **Google Drive export fix** — see `docs/plan-google-drive-fix.md`. The Lovable connector is gone; needs a service-account replacement.
- **Post-generation redirect** — currently stays on the preview step. Consider navigating to `/dashboard` after book generation completes.

---

## Dead ends

- `supabase db push` — don't use on live project (migration history mismatch)
- Old Supabase project `coiobrdbqledpzvcttto` — belongs to `its-your-story`, not Thistle
- `LOVABLE_API_KEY` / `connector-gateway.lovable.dev` — Lovable-proprietary, fully replaced
