> Ticket: THI-38
> Branch: fix/thi-38-start-book-after-payment

# Plan: Start book generation from the server after payment

## Status

| Task | Description | Done |
| ---- | ----------- | ---- |
| 1 | Migration: new service-role-only `order_book_inputs` table (brief + seed portrait per order) | ✅ |
| 2 | Move `stripDataUrls` from `generate-book` into `_shared/sanitize.ts` (create-payment-intent needs it too) | ✅ |
| 3 | Tests first, then `_shared/serverStart.ts`: `prepareOrderBookInputs`, `loadServerStartInputs`, `startBookForOrder` | ✅ |
| 4 | `create-payment-intent` saves the brief + seed portrait on the order when the app sends them | ✅ |
| 5 | `generate-book` accepts a service-role call with only an `order_id` and loads everything from the order | ✅ |
| 6 | `stripe-webhook` starts the book on `payment_intent.succeeded`; a transient failure releases the event so Stripe retries | ✅ |
| 7 | Checkout (`Step10Preview`) sends the brief + seed portrait in a second, failure-isolated call just before payment (test checks the request body) | ✅ |
| 8 | Update `AGENTS.md` flow + table list; run lint, tests, Deno tests, `deno check`, build | ✅ |
| 9 | After review: retry a failed save once; clear the saved portrait when the book is done | ✅ |
| 10 | After second review: save the brief even if the buyer-details call fails or the promo code is invalid; stop if the price changes during the save; webhook retries on a transient database error and logs why it skipped | ✅ |

## Background

Today the buyer's browser starts generation: `Step9Generating` calls
`generate-book` after payment. `stripe-webhook` only marks the order paid and
sends the receipt. If the tab closes, signal drops, or that one request fails,
the buyer has paid and no book is ever made.

Two things the server does not have today:

1. **The brief.** It is built in the browser from in-memory wizard answers
   (`buildBrief`). The draft row holds the answers but the brief-building code
   is client TypeScript, so the server cannot rebuild it.
2. **The approved character portrait** (`seed_portrait_data_url`). The draft
   strips it on purpose (`serializeAnswers` deletes `characterPortrait`).
   `generate-book-images` uses it as the anchor for the hero portrait, so a
   book started without it would not match the portrait the buyer approved.
   The webhook usually lands before the browser does, so the server would
   win the race in the common case. It must have the portrait.

## Approach

**Save the inputs at payment time.** When the buyer taps Pay, the app already
calls `create-payment-intent` to save name/email (THI-35). Right after that, a
second call to the same function (same order fields plus the brief and the seed
portrait) stores them in a new table `order_book_inputs` (one row per order). It
is a separate call because the portrait is a 2K image that can be several MB:
if that upload fails, the buyer's email is already saved.

Why a separate table instead of an `orders.brief` column (the ticket's
suggestion): the portrait is a base64 image (megabytes), `orders` is readable
by the buyer through RLS and read with `select *` in the webhook. A
service-role-only side table keeps that image off every orders read and needs
no column-level grants. It cascades when the order or user is deleted.

**Start from the webhook.** On `payment_intent.succeeded`, after marking the
order paid and sending the receipt, `stripe-webhook` calls `generate-book`
with the service-role key and just `{ order_id }`.

**`generate-book` gets a service-role entry path.** When the bearer token is
the service-role key, it reads the order (owner, draft, buyer name/email) and
its saved inputs, then runs the exact same code as the browser path. The user
id comes from the order, so the book is tied to the order's owner. The dev
checkout bypass is never honored on this path. The paid-order gate, refund
check and one-order-one-book logic (THI-36) all still apply, so starting
twice is safe. After it starts a book, it deletes the order's draft (what the
browser does today), so a paid buyer doesn't see a stale draft.

**The browser keeps calling `generate-book`.** If the server got there first,
THI-36 makes that call return the same book (`existing: true`), so the
progress screen works unchanged.

**Failures retry.** `stripe-webhook` inserts the event id into its idempotency
ledger before doing any work, so a failed start would never be retried. If the
start fails in a way that could succeed later (network error, 5xx), the
webhook deletes the ledger row and returns 500 so Stripe redelivers. A 4xx
(no saved inputs, refunded) is logged and not retried; retrying can't help.

## Decisions to know about

- Orders paid before this ships have no saved inputs. For them the server
  start is skipped (logged) and the browser path still works as it does today.
- If saving the inputs fails at checkout, the app retries once (the server says
  in `book_inputs_saved` whether its save worked). If both tries fail, payment
  still goes ahead (same rule as saving buyer details). The browser path is the
  fallback while the tab stays open; if it closes, the order is paid with no
  book and the webhook logs `PAID ORDER WITHOUT BOOK`. Alerting on that is
  THI-43 (comment added). Blocking payment instead is a product decision and
  was not made here.
- The saved portrait is cleared when the book finishes
  (`clearSeedPortraitForBook`, called from `generate-book-images`). The brief
  stays so a late repeat of the payment webhook still finds saved details.
- The migration must be applied by hand before the function deploy
  (`docs/deploy.md`). This PR touches the webhook and adds a migration, so it
  is a "Don't merge" PR per `AGENTS.md`.

## Tests

- Deno: `prepareOrderBookInputs` (strips photos, accepts only an image data
  URL under a size cap, rejects a non-object brief), `loadServerStartInputs`
  (found / order missing / no saved inputs), `startBookForOrder` (started,
  already started, skipped on 4xx, retry on 5xx and network errors),
  `stripDataUrls` (moved; same behavior).
- Vitest: the second pre-payment `create-payment-intent` request includes `brief` and
  `seed_portrait_data_url`, the names the function reads (the "fake responses"
  caveat in `AGENTS.md`), is sent after the buyer details and before payment, and
  a failure of it doesn't block payment; it still runs when the buyer-details
  call fails; and a price change during it stops payment. The mount, plan-switch and promo calls
  do not carry the large payload.
- Not unit-testable: the `Deno.serve` handlers. Covered by `deno check` and
  the review.

## Follow-ups (outside this ticket)

- THI-68: a late payment notification can turn a refunded order back to paid.
- THI-69: a webhook retry can be lost if Stripe re-sends while the first try is running.
- THI-70: measure how long Pay takes now that it uploads the portrait.
- THI-67 (existing): buyer details aren't saved if the applied promo code has expired by the time they pay (this change only makes sure the book-details save still runs on that path; comment added). Do it after this merges, since both edit the same branch of `create-payment-intent`.
- THI-43 (existing): alert on any paid order with no book; comment added.
- THI-70: also has a comment about the `create-payment-intent` rate limit (10/min) now that Pay makes up to 3 calls.
