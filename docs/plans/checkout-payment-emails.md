# Plan: Checkout & Payment Emails via Loops (TIC-29)

## Status

| Task | Description | Assign | Done |
| ---- | ----------- | ------ | ---- |
| 1 | Migration: 4 `*_email_sent_at` columns on `orders` | Master | |
| 2 | `_shared/orderEmails.ts` decision helper + template IDs + Deno tests | Master | |
| 3 | `stripe-webhook`: receipt + payment-failed + new `charge.refunded` branch | Master | |
| 4 | `nudge-abandoned-orders` edge function + Deno tests + config | Clone | |
| 5 | `/resume/:draftId` route (extract resume helper, page, route) | Master | |
| 6 | Enable `pg_cron`/`pg_net` + schedule the nudge job (SQL editor) | Master | |
| 7 | Turn off Stripe receipts (manual) + full verification | Master | |

## Prerequisites

- Design: [docs/designs/checkout-payment-emails.md](../designs/checkout-payment-emails.md)
- Prototype: None (no new customer-facing screens; email visuals live in Loops)
- Feature branch: `feature/tic-29-checkout-payment-emails-via-loops` (already checked out)
- **Run `loops agent-context` before Task 2** to fetch the four real transactional template IDs.

---

## Phase 1 — Foundation (sequential)

### Task 1 [Master]: Add email-sent-stamp columns to `orders`

**Skills:** safe-migration
**Reference:** [`supabase/migrations/20260618000001_add_orders.sql`](../../supabase/migrations/20260618000001_add_orders.sql) for column/grant conventions.

**In scope:**

- New migration file `supabase/migrations/<timestamp>_add_order_email_stamps.sql`:
  - `ALTER TABLE public.orders ADD COLUMN receipt_email_sent_at timestamptz;`
  - same for `payment_failed_email_sent_at`, `refund_email_sent_at`, `abandoned_email_sent_at` (all nullable).
- A SQL comment noting `refunded` is a new free-text `status` value (no enum/constraint change).
- Apply via the Supabase **SQL editor** (per CLAUDE.local.md — `db push` is unreliable on this remote), then confirm columns exist.

**NOT in scope:**

- New tables, GRANT/RLS changes (columns inherit `orders`' existing `service_role`-write / `authenticated`-read-own), `stripe_webhook_events` changes, `pg_cron`/`pg_net` (Task 6).

**Build order:**

1. **Implement:** write the migration file.
2. **Apply:** run it in the Supabase SQL editor; verify with `select column_name from information_schema.columns where table_name='orders'`.
3. **Verify:** `npm run lint` (migration is SQL-only; no test).
4. **Review:** run review-changes before proceeding.

---

### Task 2 [Master]: `_shared/orderEmails.ts` decision helper + template IDs

**Skills:** write-tests, loops-api
**Reference:** [`supabase/functions/_shared/accountEmails.ts`](../../supabase/functions/_shared/accountEmails.ts) and [`accountEmails.test.ts`](../../supabase/functions/_shared/accountEmails.test.ts) — mirror this exactly (pure helper, `DbClient` interface, mock-asserted tests). [`loops.ts`](../../supabase/functions/_shared/loops.ts) for `LOOPS_TEMPLATES` and `sendTransactional`.

**In scope:**

- Add 4 keys to `LOOPS_TEMPLATES` in `loops.ts` using IDs from `loops agent-context`: `orderReceipt`, `paymentFailed`, `refund`, `abandonedCheckout`.
- New `supabase/functions/_shared/orderEmails.ts` exporting an `OrderRow` type and four functions, each mirroring `maybeSendWelcome`'s shape (skip if the relevant `*_email_sent_at` is set; skip + `console.warn` if `buyer_email` is null; `sendTransactional`; stamp the column via `db.from("orders").update({...}).eq("id", order.id)`; return boolean):
  - `maybeSendReceipt(db, order)` → vars `{ orderId, product, amountCents, buyerName, shipping }` (include shipping fields only when `order.product` is hardcover); stamps `receipt_email_sent_at`.
  - `maybeSendPaymentFailed(db, order)` → vars `{ retryUrl }`; stamps `payment_failed_email_sent_at`.
  - `maybeSendRefund(db, order, refundedAmountCents)` → vars `{ orderId, amount: refundedAmountCents }`; stamps `refund_email_sent_at`.
  - `maybeSendAbandoned(db, order)` → vars `{ resumeUrl }`; stamps `abandoned_email_sent_at`.
- A small exported `resumeLink(order)` that builds `${APP_BASE_URL}/resume/${order.draft_id}`, falling back to `${APP_BASE_URL}/dashboard` when `draft_id` is null. Read base from `Deno.env.get("APP_BASE_URL")`.
- `supabase/functions/_shared/orderEmails.test.ts` (mirror `accountEmails.test.ts`): for each function assert send vs. skip on stamp-set, skip on null `buyer_email`, correct `transactionalId`, correct `dataVariables`, and that the stamp update targets `orders`/`id`. Test partial-refund amount and the `resumeLink` null-draft fallback.
- Document the new `APP_BASE_URL` secret and the four template keys in AGENTS.md's Loops env section.

**NOT in scope:**

- Calling these from any function (Tasks 3, 4). Selecting candidate orders (Task 4).

**Build order:**

1. **Test:** write `orderEmails.test.ts` first (TDD), asserting against `mockSentEmails`.
2. **Implement:** `orderEmails.ts` + `LOOPS_TEMPLATES` keys + AGENTS.md.
3. **Verify:** `npm run test:deno`.
4. **Review:** run review-changes before proceeding.

---

## Phase 2 — Senders & route (parallel after Phase 1)

### Task 3 [Master]: Wire sends into `stripe-webhook`

**Skills:** loops-api
**Reference:** [`supabase/functions/stripe-webhook/index.ts`](../../supabase/functions/stripe-webhook/index.ts) — existing `succeeded`/`failed` branches and the `stripe_webhook_events` ledger.

**In scope:**

- After the `payment_intent.succeeded` status update: re-select the order row by `stripe_payment_intent_id`, call `maybeSendReceipt(supabase, order)`.
- After the `payment_intent.payment_failed` status update: re-select the row, call `maybeSendPaymentFailed(supabase, order)`.
- New `else if (event.type === "charge.refunded")` branch: read `charge.payment_intent` and the event's refunded amount (`charge.amount_refunded`), find the order by `stripe_payment_intent_id`, set `status='refunded'` + `updated_at`, re-select, call `maybeSendRefund(supabase, order, amountRefunded)`.
- Wrap each send in try/catch + `console.error` (best-effort; never change the 200 response).

**NOT in scope:**

- New columns (Task 1), helper internals (Task 2), the cron path, Stripe-side config (Task 7).

**Build order:**

1. **Test:** add Deno test exercising the refunded-amount mapping if a pure mapping helper is extracted; otherwise rely on Task 2's helper tests and verify the branch wiring manually with the Stripe CLI in Task 7. (Keep new logic in the helper so it stays unit-tested.)
2. **Implement:** edit `stripe-webhook/index.ts`.
3. **Verify:** `npm run test:deno`.
4. **Review:** run review-changes before proceeding.

---

### Task 4 [Clone]: `nudge-abandoned-orders` edge function

**Skills:** write-tests, loops-api
**Reference:** [`supabase/functions/delete-account/index.ts`](../../supabase/functions/delete-account/index.ts) for the service-role client + CORS skeleton; [`accountEmails.test.ts`](../../supabase/functions/_shared/accountEmails.test.ts) for test style.

**In scope:**

- New `supabase/functions/nudge-abandoned-orders/index.ts`: create a service-role client, `select * from orders where status='pending' and abandoned_email_sent_at is null and created_at < now()-interval '24 hours'`, loop calling `maybeSendAbandoned(supabase, order)`, return a JSON summary `{ nudged: n }`.
- Keep selection thin; put any non-trivial filtering in a pure exported function (e.g. in `orderEmails.ts`) so it's Deno-testable, and add its test.
- Register in `supabase/config.toml`: `[functions.nudge-abandoned-orders]` with `verify_jwt = false` (invoked server-to-server by `pg_cron`/`pg_net`).

**NOT in scope:**

- Enabling `pg_cron`/`pg_net` or creating the schedule (Task 6). Marketing "finish your book" nudge (Ticket 5).

**Build order:**

1. **Test:** write the test for the pure filter/select helper first.
2. **Implement:** function `index.ts` + `config.toml` block.
3. **Verify:** `npm run test:deno`.
4. **Review:** run review-changes before proceeding.

---

### Task 5 [Master]: `/resume/:draftId` route

**Skills:** write-tests
**Reference:** [`src/pages/Dashboard.tsx`](../../src/pages/Dashboard.tsx) (`resumeDraft`), [`src/lib/draftPhotos.ts`](../../src/lib/draftPhotos.ts) (`deserializeAnswers`), [`src/contexts/WizardContext.tsx`](../../src/contexts/WizardContext.tsx) (`seedAnswers`/`setDraftId`), [`src/components/ProtectedRoute.tsx`](../../src/components/ProtectedRoute.tsx), [`src/App.tsx`](../../src/App.tsx).

**In scope:**

- Extract the fetch-draft → `deserializeAnswers` → `seedAnswers` → `setDraftId` → `navigate(current_step)` logic into a shared helper `src/lib/resumeDraft.ts` (`resumeDraftById(draftId, { seedAnswers, setDraftId, navigate })`).
- Refactor `Dashboard.resumeDraft` to call the shared helper (no behavior change).
- New page `src/pages/ResumeDraft.tsx`: reads `:draftId` param, runs the helper on mount, shows `LoadingScreen` while resolving, redirects to `/dashboard` on missing/error.
- Add route in `App.tsx`: `<Route path="/resume/:draftId" element={<ProtectedRoute><ResumeDraft /></ProtectedRoute>} />`.

**NOT in scope:**

- Return-URL preservation through `/login` (design accepts graceful degrade to `/dashboard`). Any wizard-step visual change.

**Build order:**

1. **Test:** `src/test/ResumeDraft.test.tsx` — asserts helper called with param, redirects to saved step, and redirects to `/dashboard` on fetch error. Add a test confirming Dashboard still resumes via the extracted helper.
2. **Implement:** `resumeDraft.ts`, `ResumeDraft.tsx`, Dashboard refactor, route.
3. **Verify:** `npm test -- ResumeDraft Dashboard`.
4. **Review:** run review-changes before proceeding.

---

## Phase 3 — Infra & cutover (Master)

### Task 6 [Master]: Enable `pg_cron`/`pg_net` + schedule the nudge

**Skills:** safe-migration

**In scope:**

- New migration file documenting the SQL (kept in repo for the record): `create extension if not exists pg_cron;`, `create extension if not exists pg_net;`, and a `cron.schedule(...)` that `pg_net` POSTs to the deployed `nudge-abandoned-orders` function URL with the service-role auth header, hourly.
- Apply via the Supabase **SQL editor** (not `db push`). Verify with `select * from cron.job`.
- Trigger one manual run and confirm a stale `pending` order gets nudged exactly once and stamped.

**NOT in scope:**

- The function body (Task 4). Any client code.

**Build order:**

1. **Implement:** migration/SQL file.
2. **Apply:** run in SQL editor; verify `cron.job` row and a manual invocation.
3. **Verify:** `npm run lint`.
4. **Review:** run review-changes before proceeding.

---

### Task 7 [Master]: Stripe receipts off + full verification

**In scope:**

- In the Stripe dashboard, turn **off** Stripe-sent email receipts (manual; no code) so Loops is the only payment-email sender.
- Stripe CLI end-to-end against deployed functions: simulate `payment_intent.succeeded`, `payment_intent.payment_failed`, and `charge.refunded` (incl. a partial refund); confirm exactly-one sends, a re-delivered event produces no duplicate, and `retryUrl`/`resumeUrl` land on `/resume/:draftId`.
- Final gate: `npm run lint && npm test && npm run test:deno && npm run build` — all green.

**NOT in scope:**

- In-app refund UI, hardcover fulfillment, subscriptions, tax (all deferred per design).

**Build order:**

1. **Manual:** disable Stripe receipts; run the Stripe CLI scenarios.
2. **Verify:** run the full command chain and show output.
3. **Review:** run review-changes, then open the PR.

---

## Task Dependencies

- **Task 1 → Task 2 → (Tasks 3, 4, 5)**: the helper needs the columns; senders need the helper.
- **Tasks 3, 4, 5 run in parallel** after Task 2 (different files; Task 5 is client-only).
- **Task 6 depends on Task 4** (the function must be deployed before scheduling).
- **Task 7 is last** (verifies everything end-to-end).
