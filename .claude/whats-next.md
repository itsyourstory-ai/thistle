# What's Next

## Work completed and current state

Branch: `feature/tic-30-lifecycle-emails` (TIC-30 — Book generation lifecycle emails via Loops). All 6 plan tasks in [`docs/plans/book-generation-lifecycle-emails.md`](../docs/plans/book-generation-lifecycle-emails.md) are done and committed; plan is marked complete.

Committed (6 commits, all vs `main`):
- Design + plan docs (`docs/designs/generation-lifecycle-emails.md`, `docs/plans/book-generation-lifecycle-emails.md`).
- Migration `supabase/migrations/20260701000001_add_book_email_stamps.sql` — three nullable `*_email_sent_at` columns on `generated_books` (idempotency stamps).
- `supabase/functions/_shared/bookEmails.ts` (new) — `maybeSendCreating` / `maybeSendReady` / `maybeSendFailed`, mirroring `orderEmails.ts`. Plus `bookEmails.test.ts` (12 Deno tests).
- `LOOPS_TEMPLATES` gains `bookCreating` / `bookReady` / `bookFailed` (real IDs) in `loops.ts`; matching rows in `AGENTS.md`; `appBaseUrl` exported from `orderEmails.ts`.
- Wiring: `generate-book` (creating send pre-202 + failed send in bg catch); `generate-book-images` (ready send at `done` + failed send on all three failure paths, `bookRow` hoisted for the outer catch).
- `fad4b6d fix:` — **hardening**: `maybeSendBookEmail` now wraps send+stamp in try/catch so an email-layer throw (e.g. misconfigured `LOOPS_API_KEY`) can never 500 a paid generate-book request or flip a done book to failed. Test added for the throw path.

Verification (last run): ESLint clean; Deno tests **142 passed / 0 failed**; `npm run build` clean. The JS vitest suite showed only environmental timeout flakes on frontend files this branch never touches (machine was under heavy load; a file re-run in isolation passed 6/6). No app/frontend code changed.

`/review-changes branch` passed — no blocking issues; the one recommendation (harden inline sends) was applied.

## Work Remaining

Per global workflow (Notion-ticket flow), the feature is code-complete but not yet shipped:
1. Open the PR: `gh pr create`, title `[TIC-30] Book generation lifecycle emails via Loops`, include the Notion ticket link (https://app.notion.com/p/3840fc47bb8b811982a8e593b25b9bb8) in the body. **Wait for the user to say "push" first.**
2. Write the PR URL into the Notion ticket's `PR URL` property; set `Status` appropriately.
3. Run `/wrap-up`.

Not in scope (deferred, separate tickets): TIC-41 (`/book/:id` viewer — will repoint `previewUrl` from `/dashboard`), TIC-42 (digital download email), live-delivery smoke test of the three Loops templates.

## Dead Ends

None. Note for next session: `deno` is not on PATH in this environment — invoke it via the mise install at `/Users/jordan/.local/share/mise/installs/deno/2.8.3/bin/deno` (or prepend to PATH). `npm run test:deno` fails with `deno: command not found` until then.

## Open Questions

None blocking. Loops template IDs are real (not placeholders); final `etaText` / `supportUrl` copy can be tuned in the Loops templates without code changes.
