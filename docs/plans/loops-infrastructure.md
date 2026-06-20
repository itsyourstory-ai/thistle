# Plan: Loops email infrastructure + contact sync (TIC-27)

## Status

| Task | Description | Assign | Done |
| ---- | ----------- | ------ | ---- |
| 1 | Migration: `profiles.welcomed_at` + `profiles.subscribed` | Master | ✅ |
| 2 | `_shared/loops.ts` helper + `loops.test.ts` (TDD) | Master | ✅ |
| 3 | `sync-contact` edge function + `config.toml` entry | Clone | ✅ |
| 4 | `AuthContext.tsx` sign-in sync wiring | Master | ✅ |
| 5 | Env vars + test-forcing + docs | Master | ✅ |

## Prerequisites

- Design: [`docs/designs/loops-infrastructure.md`](../designs/loops-infrastructure.md)
- Prototype: None (no UI in this ticket)
- Feature branch: `feature/tic-27-loops-infrastructure` (already checked out)
- No new gems/deps — uses native `fetch` and existing `@supabase/supabase-js`

---

## Tasks

### Task 1 [Master]: Migration — `profiles.welcomed_at` + `profiles.subscribed`

**Skills:** safe-migration
**Reference:** Read [`supabase/migrations/20260610000001_add_auth_ownership.sql`](../../supabase/migrations/20260610000001_add_auth_ownership.sql) (profiles table + RLS) and [`supabase/migrations/20260618000001_add_orders.sql`](../../supabase/migrations/20260618000001_add_orders.sql) (migration header style).

**In scope:**

- New file `supabase/migrations/20260620000001_add_profile_welcomed_subscribed.sql`.
- `ALTER TABLE public.profiles ADD COLUMN welcomed_at timestamptz;` (nullable).
- `ALTER TABLE public.profiles ADD COLUMN subscribed boolean NOT NULL DEFAULT true;`
- Header comment explaining both columns (welcomed_at = at-least-once welcome guard, read by TIC-28; subscribed = marketing opt-in mirror, read by TIC-31).

**NOT in scope:**

- No new RLS policies or GRANTs — existing "Users read own profile" / "Users update own profile" policies already cover these columns. Add a one-line comment in the migration stating this is intentional.
- No backfill logic beyond the column default. No rollback script.

**Build order:**

1. **Test:** Migrations have no unit test. Instead, after writing, eyeball that column types/defaults match the design table and that no GRANT/policy is needed (per CLAUDE.md Supabase check).
2. **Implement:** Write the migration file.
3. **Verify:** If the Supabase CLI is available locally, `supabase db reset` (or `supabase migration up`) and confirm it applies cleanly; otherwise confirm SQL syntax by inspection and note CLI was unavailable.
4. **Review:** Run review-changes before proceeding. Not optional.

---

### Task 2 [Master]: `_shared/loops.ts` helper + `_shared/loops.test.ts`

**Skills:** write-tests
**Reference:** Read [`supabase/functions/_shared/stripe.ts`](../../supabase/functions/_shared/stripe.ts) (header comment + named-export + exported-const-map style), [`supabase/functions/_shared/googleAuth.ts`](../../supabase/functions/_shared/googleAuth.ts) (network/env pattern, `__reset…ForTests` pattern, redaction, non-throwing error logging), and [`supabase/functions/_shared/stripe.test.ts`](../../supabase/functions/_shared/stripe.test.ts) (`Deno.test` + `jsr:@std/assert` style).

**In scope (`supabase/functions/_shared/loops.ts`):**

- Header comment block (mirroring `stripe.ts`/`googleAuth.ts`) describing transport modes and best-effort policy.
- Exports exactly per design §"Exports":
  - `LOOPS_TEMPLATES: Record<string, string>` — empty `{}` for now (TIC-28–31 populate it); comment marking it the single source of truth.
  - `sendTransactional(templateId, email, dataVariables)` → `POST .../api/v1/transactional`
  - `upsertContact(email, properties)` → `POST .../api/v1/contacts/update`
  - `sendEvent(email, eventName, properties)` → `POST .../api/v1/events/send`
  - `mockSentEmails: LoopsRecordedCall[]` — populated only on mock transport.
  - `__resetLoopsMock(): void` — clears `mockSentEmails`.
- Transport selection via `Deno.env.get("LOOPS_TRANSPORT")`: `"live"` → real API (`LOOPS_API_KEY` required, throw if missing); anything else (unset/`"mock"`) → push a record to `mockSentEmails`, send nothing.
- Live calls send `Authorization: Bearer <LOOPS_API_KEY>`; non-2xx logs a warning and resolves (best-effort, non-throwing). All three send functions are async and return without throwing on network/API failure.
- Define a `LoopsRecordedCall` type (e.g. `{ kind: "transactional" | "contact" | "event"; payload: Record<string, unknown> }`).

**In scope (`supabase/functions/_shared/loops.test.ts`):**

- `__resetLoopsMock()` at the top of each test.
- Assert mock transport (unset `LOOPS_TRANSPORT`) records the correct payload shape for each of `sendTransactional`, `upsertContact`, `sendEvent` and performs zero network calls.
- Assert `mockSentEmails` accumulates across calls and `__resetLoopsMock()` empties it.
- Assert live transport with missing `LOOPS_API_KEY` throws (use `Deno.env.set`/`delete` to toggle, restoring afterward).

**NOT in scope:**

- No real template IDs in `LOOPS_TEMPLATES`.
- No retry/backoff, no token caching (Loops uses a static API key, unlike Google).
- No DB reads — this file is pure transport + env. No imports from `auth.ts`.

**Build order:**

1. **Test:** Write `loops.test.ts` first per the assertions above.
2. **Implement:** Write `loops.ts` to satisfy the tests.
3. **Verify:** `npm run test:deno`
4. **Review:** Run review-changes before proceeding. Not optional.

---

### Task 3 [Clone]: `sync-contact` edge function + `config.toml` entry

**Skills:** write-tests (note: edge-function `index.ts` is not covered by `test:deno`, which scopes to `_shared/` — see Verify)
**Reference:** Read [`supabase/functions/delete-account/index.ts`](../../supabase/functions/delete-account/index.ts) (CORS + auth + service-role client shape), [`supabase/functions/_shared/auth.ts`](../../supabase/functions/_shared/auth.ts) (`requireAuthedUser`, `createServiceRoleClient`, `unauthorized`), and [`supabase/functions/_shared/loops.ts`](../../supabase/functions/_shared/loops.ts) (Task 2 output — `upsertContact`).

**In scope (`supabase/functions/sync-contact/index.ts`):**

- `Deno.serve` handler with CORS `OPTIONS` short-circuit (copy the corsHeaders shape from `delete-account`).
- Auth: `requireAuthedUser(req)`; return `unauthorized(corsHeaders, 401, …)` if null.
- Build the contact properties map exactly per design §"Properties synced to Loops":
  - `email`, `userId`, `signupSource` (`user.app_metadata.provider` → `"google" | "password"`), `createdAt`, all from the `user`.
  - `subscribed` from `profiles.subscribed` (via `createServiceRoleClient()`).
  - `childName` / `occasion` / `artStyle` from the latest `generated_books.brief` (best-effort).
  - `lastPurchaseProduct` from the latest paid `orders.product` (best-effort).
  - Each optional DB read is wrapped so a missing/empty row is silently skipped (property omitted).
- Call `upsertContact(user.email, properties)`. Best-effort: wrap in try/catch, `console.error` and continue — never fail the response on a Loops error.
- Return `200 { success: true }`.

**In scope (`supabase/config.toml`):**

- Add `[functions.sync-contact]` with `verify_jwt = false` (matches every other entry; the function does its own `requireAuthedUser` check).

**NOT in scope:**

- No transactional/welcome email send (TIC-28+).
- No writes to `profiles` (no `welcomed_at` update here).
- Do not change other config.toml entries.

**Build order:**

1. **Test:** No `index.ts` harness exists in this repo and `test:deno` only globs `_shared/`. If any non-trivial pure logic emerges (e.g. a `buildContactProperties(user, profile, book, order)` helper), extract it into `_shared/` with a `.test.ts` and assert the property map. Otherwise rely on `deno check` + the live-API acceptance check.
2. **Implement:** Write `index.ts` and add the `config.toml` entry.
3. **Verify:** `deno check supabase/functions/sync-contact/index.ts` (type/import check) and `npm run test:deno` (confirms no `_shared/` regressions).
4. **Review:** Run review-changes before proceeding. Not optional.

---

### Task 4 [Master]: `AuthContext.tsx` sign-in sync wiring

**Reference:** Read [`src/contexts/AuthContext.tsx`](../../src/contexts/AuthContext.tsx) lines 46–81 (the `useEffect` + `onAuthStateChange` block, the `isDevAuthBypass()` early return).

**In scope:**

- Add a `lastSyncedUserId` ref (`useRef<string | null>(null)`).
- Inside the existing `onAuthStateChange((event, nextSession) => …)` callback (after `setSession`), add:
  - On `event === "SIGNED_IN"` **only** (not `TOKEN_REFRESHED` / `INITIAL_SESSION` / `PASSWORD_RECOVERY`), and only when `nextSession?.user.id !== lastSyncedUserId.current`.
  - Set `lastSyncedUserId.current` to the new id, then `setTimeout(() => supabase.functions.invoke("sync-contact").catch(console.error), 0)` (deferred to avoid the Supabase auth-lock deadlock; fire-and-forget; errors swallowed).
- Leave the `isDevAuthBypass()` early-return path untouched (it returns before subscribing, so no events fire there).
- Add an `# AIDEV-NOTE:` comment explaining the `setTimeout(…, 0)` deadlock avoidance and the de-dupe ref.

**NOT in scope:**

- No change to sign-in/sign-up/sign-out methods.
- No awaiting the invoke; no UI/loading state tied to it.
- No passing a body to `invoke` (server derives everything).

**Build order:**

1. **Test:** Add/extend the AuthContext test (vitest) to assert `supabase.functions.invoke` is called once with `"sync-contact"` on a `SIGNED_IN` event, and **not** on `TOKEN_REFRESHED` or a repeat `SIGNED_IN` for the same user id. Mock `supabase.functions.invoke`. (Note `setup.ts` neutralizes `VITE_DEV_AUTH_BYPASS` so the real path runs; a 0-call result likely means an early return.)
2. **Implement:** Wire the callback.
3. **Verify:** `npm test` then `npm run build`.
4. **Review:** Run review-changes before proceeding. Not optional.

---

### Task 5 [Master]: Env vars + test-forcing + docs

**Reference:** Read [`src/test/setup.ts`](../../src/test/setup.ts) (the `VITE_DEV_AUTH_BYPASS` defensive line), `package.json` `test:deno` script (line 18), `.env.example`, and the "Required env vars" section of [`CLAUDE.md`](../../CLAUDE.md).

**In scope:**

- `package.json`: prefix the `test:deno` script with `LOOPS_TRANSPORT=mock` → `LOOPS_TRANSPORT=mock deno test --allow-env supabase/functions/_shared/`.
- `src/test/setup.ts`: add `import.meta.env.LOOPS_TRANSPORT = "mock";` next to the existing bypass line (defensive).
- `.env.example`: add `LOOPS_API_KEY=` and `LOOPS_TRANSPORT=mock` with comments (server-side only; never `VITE_`-prefixed).
- `CLAUDE.md` "Required env vars": document `LOOPS_API_KEY` and `LOOPS_TRANSPORT` as server-side / edge-function secrets, noting live secrets are a manual Supabase-dashboard + Vercel step.

**NOT in scope:**

- Do not set real secret values anywhere. Do not add `VITE_`-prefixed Loops vars.
- No CI workflow file changes (default + mock prefix already cover CI).

**Build order:**

1. **Test:** No unit test; verification is the suite passing under forced-mock plus the bundle grep.
2. **Implement:** Make the four edits above.
3. **Verify:** `npm run test:deno` (confirms forced-mock prefix runs), then `npm run lint && npm test && npm run build`, then `npm run build && grep -r LOOPS_API_KEY dist/ || echo "key absent from bundle ✓"`.
4. **Review:** Run review-changes before proceeding. Not optional.

---

## Task Dependencies

- **Task 3** depends on **Task 2** (imports `loops.ts`) and **Task 1** (reads `profiles.subscribed`).
- **Task 1, Task 2, Task 5** are independent and can run in parallel at the start.
- **Task 4** depends on nothing structurally (it calls `invoke("sync-contact")` by name) and can run in parallel with Task 3 — but should land before the final acceptance check that exercises a real sign-in.
- Suggested order: **1 + 2 + 5 in parallel → 3 (clone) → 4 → final acceptance gate.**

## Final acceptance gate (after all tasks)

Per the design's Acceptance Criteria, run from a clean tree:

- `npm run test:deno` green; mock payloads asserted in `loops.test.ts`.
- `npm run lint && npm test && npm run build` all green.
- `grep -r LOOPS_API_KEY dist/` finds nothing (key absent from client bundle).
- Live sign-in fires `sync-contact` + upserts a contact — verified against the live Loops API **only once a real key exists** (manual, deferred).
