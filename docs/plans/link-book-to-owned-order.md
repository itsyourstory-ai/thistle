> Ticket: THI-59
> Branch: fix/thi-59-link-book-to-owned-order

# Plan: Only link a book to an order the buyer owns

## Status

| Task | Description | Done |
| ---- | ----------- | ---- |
| 1 | Write failing Deno tests for a new `linkBookToOrder` helper (owner links; someone else's order is untouched) | ✅ |
| 2 | Add `linkBookToOrder` to `_shared/orderBook.ts` (filters on `id` and `user_id`) | ✅ |
| 3 | Use it in the dev-bypass branch of `generate-book/index.ts` instead of the unfiltered `.update(...)` | ✅ |
| 4 | Run `lint`, `test`, `build`, Deno tests and `deno check` on the entrypoint | ✅ |

## Background

`generate-book` links the new book to the order in two places:

- **Paid path** (`claimOrderBook`): already filters on `user_id` since THI-36.
- **Dev-bypass path** (`else if (order_id)`): updates `orders` with only
  `.eq("id", order_id)`. The paid-order check that normally proves ownership
  is skipped when the bypass is on, so a request could attach a book to
  someone else's order. The edge function writes with `service_role`, which
  bypasses RLS, so the query itself is the only guard.

## Approach

Add a small helper next to `claimOrderBook`, so the handler stays thin and the
behaviour can be unit-tested (the handler itself can't be). The bypass path
has no "first call wins" race to guard, so the helper is a plain
"link if owned" update, not a copy of `claimOrderBook`. It reuses the
existing `OrdersDb` fake-friendly client type.

Behaviour change: the old bypass update ignored database errors; the helper
throws on one (like `claimOrderBook`). The handler catches that, deletes the
stub `generated_books` row it just created (so no book is left stuck at
"story" with no order), and rethrows, so the caller gets the usual 500. If the
order simply isn't the caller's, the helper returns `false` and the handler
logs a warning and carries on (book created, not linked).

Not changed: the paid path (already correct), the "one paid order, one book"
logic (THI-36, done), any migration, RLS or GRANT.

## Done when

- Dev-bypass book linking only updates an order whose `user_id` is the caller.
- Paid checkout still links the book (existing `claimOrderBook` tests still pass).
- Deno test covers: owner's order gets linked; another user's order is left alone.
