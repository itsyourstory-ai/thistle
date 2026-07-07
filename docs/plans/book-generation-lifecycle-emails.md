# Plan: Book Generation Lifecycle Emails (TIC-30)

## Status

| Task | Description | Assign | Done |
| ---- | ----------- | ------ | ---- |
| 1 | Migration: three `*_email_sent_at` columns on `generated_books` | Master | ✓ |
| 2 | Add 3 template IDs to `LOOPS_TEMPLATES` + AGENTS.md doc rows | Master | ✓ |
| 3 | `_shared/bookEmails.ts` decision helper + Deno tests | Master | ✓ |
| 4 | Wire `generate-book` (creating + failed sends) | Clone | ✓ |
| 5 | Wire `generate-book-images` (ready + failed sends) | Clone | ✓ |
| 6 | Full verification + `git diff` review | Master | ✓ |

## Prerequisites

- Design: `docs/designs/generation-lifecycle-emails.md`
- Prototype: None (email visuals live in Loops templates)
- Feature branch: `feature/tic-30-lifecycle-emails` (already checked out)
- Reference pattern (mirror this exactly): `supabase/functions/_shared/orderEmails.ts` + `orderEmails.test.ts`, and migration `supabase/migrations/20260629000001_add_order_email_stamps.sql`

---

## Tasks

### Task 1 [Master]: Migration — add three send-stamp columns

**Skills:** safe-migration
**Reference:** `supabase/migrations/20260629000001_add_order_email_stamps.sql` (same shape, `generated_books` instead of `orders`)

**In scope:**

- New migration file `supabase/migrations/<timestamp>_add_book_email_stamps.sql` adding three nullable columns to `public.generated_books`:
  - `creating_email_sent_at timestamptz`
  - `ready_email_sent_at timestamptz`
  - `failed_email_sent_at timestamptz`
- Brief comment explaining they keep Loops sends idempotent per book.

**NOT in scope:**

- No new GRANT/RLS statements — columns inherit `generated_books`' existing `service_role`-write / `authenticated`-read-own policies (design §Data Model).
- No new tables, no index.

**Build order:**

1. **Implement:** write the `ALTER TABLE public.generated_books ADD COLUMN …` migration (three columns, one statement, matching the order-stamps file's style). Use a timestamp newer than `20260629000002`.
2. **Verify:** `npm run test:deno` still green (no schema runner in CI, so this is a syntax/consistency sanity check only). Confirm the file parses and follows the reference format.
3. **Review:** run review-changes before proceeding.

---

### Task 2 [Master]: Register three Loops template IDs

**Skills:** loops-cli (for `loops agent-context`)
**Reference:** `supabase/functions/_shared/loops.ts` lines 20–29 (`LOOPS_TEMPLATES`)

**In scope:**

- Run `loops agent-context` to obtain/confirm the three transactional template IDs. If the templates don't exist yet, create them in Loops (keys/vars below) and capture their IDs.
- Add three keys to `LOOPS_TEMPLATES` in `_shared/loops.ts`:
  - `bookCreating` — vars `childName`, `etaText`
  - `bookReady` — vars `childName`, `previewUrl`, `bookId`
  - `bookFailed` — vars `childName`, `supportUrl`
- Add the three matching rows to the Loops template table in `AGENTS.md` (§"Auth & account transactional emails").

**NOT in scope:**

- No sender/subdomain config in code (Loops-side only).
- No helper logic — that's Task 3.

**Build order:**

1. **Implement:** `loops agent-context` → fill real IDs into the three new `LOOPS_TEMPLATES` keys; update the AGENTS.md table.
2. **Verify:** `npm run test:deno` green (existing `loops.test.ts` must still pass).
3. **Review:** run review-changes before proceeding.

> If Loops IDs can't be fetched now, insert clearly-marked placeholder IDs (`TODO-loops-id`) and flag to the user — do not block the rest of the plan, but the feature can't ship live until real IDs land.

---

### Task 3 [Master]: `_shared/bookEmails.ts` helper + Deno tests

**Skills:** write-tests (TDD — tests first)
**Reference:** `_shared/orderEmails.ts` (structure, `maybeSend…` guard/stamp flow) and `_shared/orderEmails.test.ts` (test shape, `makeFakeDb`, `assertSingle…Stamp`)
**Depends on:** Task 1 (column names), Task 2 (template keys)

**In scope (3 files):**

- **`supabase/functions/_shared/bookEmails.ts`** (new), mirroring `orderEmails.ts`:
  - `export interface GeneratedBookRow { id: string; buyer_email: string | null; brief: any; creating_email_sent_at: string | null; ready_email_sent_at: string | null; failed_email_sent_at: string | null; [key: string]: unknown; }`
  - Reuse `DbClient` by importing it from `./orderEmails.ts` (already exported) — do not redefine it.
  - Constants: `const ETA_TEXT = "about 5–10 minutes";` and `const SUPPORT_URL = "mailto:support@thistlebook.com";`
  - `childName(book)` helper → `book.brief?.child?.name || ""`.
  - `previewUrl()` → `${appBaseUrl()}/dashboard`. Reuse `appBaseUrl` by **exporting** the existing private `appBaseUrl()` from `orderEmails.ts` (one-word `export` added) and importing it here — do not duplicate the trim logic.
  - Private `maybeSendBookEmail(db, book, stampColumn, templateId, dataVariables)` — identical guard flow to `maybeSendOrderEmail`: return false if `book[stampColumn] !== null`; if `!book.buyer_email` → `console.warn("[bookEmails] skipping …")` and return false; else `sendTransactional(...)`; on truthy result stamp `generated_books` (`db.from("generated_books").update({ [stampColumn]: new Date().toISOString() }).eq("id", book.id)`) and return true.
  - `export maybeSendCreating(db, book)` → `bookCreating`, stamp `creating_email_sent_at`, vars `{ childName, etaText: ETA_TEXT }`.
  - `export maybeSendReady(db, book)` → `bookReady`, stamp `ready_email_sent_at`, vars `{ childName, previewUrl: previewUrl(), bookId: book.id }`.
  - `export maybeSendFailed(db, book)` → `bookFailed`, stamp `failed_email_sent_at`, vars `{ childName, supportUrl: SUPPORT_URL }`.
- **`supabase/functions/_shared/orderEmails.ts`** — add `export` to `appBaseUrl` only.
- **`supabase/functions/_shared/bookEmails.test.ts`** (new), mirroring `orderEmails.test.ts`: `makeFakeDb`, `makeBook(overrides)`, `assertSingleBookStamp(db, column)` (table `"generated_books"`). For **each** of the three `maybeSend…`: (a) sends with correct `transactionalId` + `email` + `dataVariables` and stamps the right column; (b) skips (no send, no stamp) when that stamp is already set; (c) skips when `buyer_email` is null. Plus one test asserting `previewUrl` resolves to `${APP_BASE_URL}/dashboard`.

**NOT in scope:**

- No edge-function wiring (Tasks 4–5).
- No `orders` join, no ETA computation, no event-ledger layer (design §More Info).

**Build order:**

1. **Test:** write `bookEmails.test.ts` first (all cases above), using `__resetLoopsMock()` per test like the reference.
2. **Implement:** write `bookEmails.ts` + the one-word `export` on `orderEmails.ts`'s `appBaseUrl`.
3. **Verify:** `npm run test:deno` — all new + existing tests green.
4. **Review:** run review-changes before proceeding.

---

### Task 4 [Clone]: Wire `generate-book` (creating + failed)

**Reference:** `supabase/functions/generate-book/index.ts` lines 466–496 (stub insert), 650–660 (background `catch`); helper API from `_shared/bookEmails.ts`
**Depends on:** Task 3

**In scope (1 file — `generate-book/index.ts`):**

- Import `{ maybeSendCreating, maybeSendFailed }` from `"../_shared/bookEmails.ts"`.
- **Creating send:** after the stub row is inserted and the order is linked (after ~line 504), before returning the 202, `await maybeSendCreating(supabase, book)` where `book = { id: bookId, buyer_email: buyer_email || null, brief: { ...brief, approvedConcept }, creating_email_sent_at: null, ready_email_sent_at: null, failed_email_sent_at: null }`. Note `buyer_email` is the validated local var (empty string when invalid) — pass `buyer_email || null` so the helper's null-guard fires.
- **Failed send:** in the background `catch` (after the `pipeline_status:"failed"` update at ~656), `await maybeSendFailed(supabase, book)` with the same constructed `book` object (`failed_email_sent_at: null`).

**NOT in scope:**

- No change to the paid-order gate, AI call, or persistence logic.
- No ready send (that's generate-book-images).
- Do not re-fetch the row — construct the plain object from in-scope vars.

**Build order:**

1. **Implement:** add the import + the two `await maybeSend…` calls at the two sites above.
2. **Verify:** `npm run test:deno` (helper tests) + `npm run build` (TypeScript/Deno type check) green.
3. **Review:** run review-changes before proceeding.

---

### Task 5 [Clone]: Wire `generate-book-images` (ready + failed)

**Reference:** `supabase/functions/generate-book-images/index.ts` lines 561–585 (row fetch), 626–630 (fatal fail), 691–697 (verify fail), 704–706 (done), 715–728 (outer catch)
**Depends on:** Task 3

**In scope (1 file — `generate-book-images/index.ts`):**

- Import `{ maybeSendReady, maybeSendFailed }` from `"../_shared/bookEmails.ts"`.
- **Expand the select** at line 583 from `"id,user_id,brief,parsed"` to also include `buyer_email,ready_email_sent_at,failed_email_sent_at` (needed for the helper's guards).
- **Hoist the row** so the outer `catch` can reach it: add `let bookRow: any = null;` beside `bookId`/`supabase` (line ~561–562), and assign `bookRow = row;` right after the `if (!row) throw …` guard (line ~587).
- **Ready send:** after `setPipeline(..., "done", …)` at line 704, `await maybeSendReady(supabase, bookRow)`.
- **Failed send:** after **each** `pipeline_status:"failed"` update — the fatal path (~630), the verify-fail path (~697), and the outer catch (~726) — `await maybeSendFailed(supabase, bookRow)`. In the outer catch guard it: `if (bookRow) await maybeSendFailed(supabase, bookRow);` (bookRow may still be null if the error hit before the fetch).

**NOT in scope:**

- Do **not** send on the `not_ready` skip path (lines 591–600) — premature invocations don't set `failed`.
- No change to portrait/page generation, self-chaining, Drive export, or verification logic.
- No dedup logic beyond the per-book stamp (design accepts failed→retry→done sending both).

**Build order:**

1. **Implement:** import, widen select, hoist `bookRow`, add the one ready + three failed `await maybeSend…` calls.
2. **Verify:** `npm run test:deno` + `npm run build` green.
3. **Review:** run review-changes before proceeding.

---

### Task 6 [Master]: Full verification

**In scope:**

- Run the full gate: `npm run lint && npm test && npm run test:deno && npm run build` — all green (design Acceptance Criteria).
- `git diff` to confirm only the intended files changed (migration, `loops.ts`, `bookEmails.ts`, `bookEmails.test.ts`, `orderEmails.ts` one-liner, both edge functions, `AGENTS.md`).
- Confirm each Acceptance Criterion in the design maps to a passing test or a wired call site.

**NOT in scope:**

- Live-delivery smoke test of templates (deferred, epic-level).
- Any `/book/:id` viewer or digital-download work (TIC-41 / TIC-42).

**Build order:**

1. **Verify:** run the four-command gate; show output.
2. **Review:** final review-changes, then hand back for commit/PR.

---

## Task Dependencies

- **Task 3** depends on **Task 1** (column names) and **Task 2** (template keys).
- **Tasks 4 and 5** both depend on **Task 3** and can run **in parallel** (separate files, no shared edits).
- **Task 6** depends on Tasks 4 and 5.
- Tasks 1 and 2 are independent and can run in parallel up front.
