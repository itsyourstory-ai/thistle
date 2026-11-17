# Plan: Generation failure & retry UX

**Ticket:** THI-10
**Branch:** feature/thi-10-generation-failure-retry-ux

## Goal

When a paid book fails (or silently stalls), the buyer can retry it without paying again and without redoing the wizard, from the page they land on after a reload (`/book/:id`, reached from the dashboard) and from the generating screen.

## Where things stand

Blockers THI-36 and THI-38 are merged, so these audit notes are already handled:

- "Try again" on the generating screen restarts the **same** book (story or images, whichever failed) instead of making a new one.
- A paid book starts from the server, so a closed tab doesn't lose it.

Still open:

1. `/book/:id` shows a failed book as "email support". There is no retry. After a reload the wizard answers are gone, so the generating screen can't retry either.
2. `generate-book` only accepts a brief from the browser, so a page with no wizard state has nothing to send.
3. A book stuck at `story` (worker died, never marked failed) shows a spinner forever. The server restarts it after 10 minutes if asked, but no client asks (Linear comment on THI-10).

## Decisions

1. **Retry by book id, not by resending the brief.** The browser sends `{ retry_book_id }`. The server finds the caller's own order for that book and loads the saved brief and portrait from `order_book_inputs` (the same inputs the payment webhook uses). Reason: after a reload the browser has no brief, and the saved one is exactly what the paid book was made from. Everything after that (paid-order gate, one-order-one-book, restart rules) is the existing code, unchanged.
2. **Ownership.** The order lookup filters on `user_id = caller`. A book id that isn't theirs returns 404, same as no book.
3. **Stuck books show the same retry UI as failed ones.** A book at `story` for more than 10 minutes (`STALE_STORY_MS`, mirrored from `_shared/orderBook.ts`) is treated as stuck. Reason: showing a button is explicit and simple; auto-retrying behind the buyer's back could surprise them.
4. **No migration, no new dependency, no money logic changed.** Edge function deploys automatically on merge.

## What to change

Server:
- `supabase/functions/_shared/serverStart.ts`: add `loadRetryInputs(db, userId, bookId)`. Finds the order by `book_id` + `user_id`, then reuses `loadServerStartInputs`.
- `supabase/functions/generate-book/index.ts`: in the browser branch, when the body has `retry_book_id`, load inputs with `loadRetryInputs` and carry on as for a server start (but the caller stays the user).

Client:
- `src/lib/bookRetry.ts` (new): `STALE_STORY_MS`, `isStuckAtStory(status, progress, now)`, `retryBook(bookId)` (calls `generate-book`, returns `{ ok }` or `{ ok: false, message }`, reading the server's message when it sent one).
- `src/lib/edgeFunctions.ts`: nothing (the body is free-form).
- `src/lib/bookStatus.ts`: add optional `started_at` to the progress type.
- `src/pages/BookView.tsx`: failed and stuck states get a "Try again" button; on success, refetch so the page returns to the progress view; on failure, show the reason and keep the button. Keep the support email as the fallback.
- `src/pages/steps/Step9Generating.tsx`: when the book is stuck at `story`, stop polling and show the existing retry UI.

## Tests (written first)

Deno (`serverStart.test.ts`): `loadRetryInputs` loads inputs for the caller's book; 404 when the book isn't theirs or has no order; passes through "no saved details" (422).

Vitest:
- `src/lib/bookRetry.test.ts`: `isStuckAtStory` (fresh, stale, other stages, missing timestamp); `retryBook` sends exactly `{ retry_book_id }` (this is the request-body check AGENTS.md asks for) and reports the server's message on error.
- `src/test/BookView.test.tsx`: failed book offers "Try again"; clicking it retries and the page goes back to "still being made"; a failed retry shows the reason; a book stuck at `story` offers retry; a fresh `story` book doesn't.
- `src/test/Step9Generating.test.tsx`: stuck at `story` shows "Try again".

## Out of scope (propose as tickets)

- The failure email still links to support. A retry link needs a new variable in the Loops template (a person has to edit it in Loops).
- The dashboard card says "Being made" for a stuck book (its query doesn't read progress).
- `/book/:id` doesn't re-poke stalled image generation the way the generating screen does.
