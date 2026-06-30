# Feature: Checkout & payment emails via Loops (TIC-29)

> Plan created: docs/plans/checkout-payment-emails.md

Notion ticket: https://app.notion.com/p/3840fc47bb8b811fa97fda8432143c19

> Part of epic **All email via Loops** (TIC-17). Ticket 3 of 5. Depends on TIC-27
> (Ticket 1, Loops transport) and the merged Stripe checkout work
> ([docs/designs/stripe-checkout.md](stripe-checkout.md)). Independent of Tickets 2, 4, 5.

## Problem

Stripe checkout (Step 11 → `stripe-webhook` + `orders` table) takes payments but sends
**no customer-facing email** — receipts, payment-failure notices, refunds, and
abandoned-checkout nudges are all missing. Stripe's own receipt emails are off by design
(the checkout ticket deferred all email to "a later Loops ticket"). This ticket makes
**Loops the only payment-email sender**, reading from `orders`.

For: a buyer who paid (or tried to pay) for a personalized children's book.

## Approach

Wire Loops transactional sends into the existing payment lifecycle. Three of the four
emails are **webhook-driven** off `stripe-webhook`; the fourth is a **scheduled
`pg_cron` job**. All sends go through the existing `_shared/loops.ts` (`sendTransactional`,
mock/live transport) and are routed by a new pure, Deno-testable decision helper
(`_shared/orderEmails.ts`) that mirrors the `accountEmails.ts` pattern from Ticket 2.

Reliability rests on two layers already partly in place:
- **Event-level idempotency** — the existing `stripe_webhook_events` ledger no-ops a
  re-delivered Stripe event.
- **Send-level at-least-once** — new per-order `*_email_sent_at` columns are stamped after
  a successful send, so a retried event or cron tick re-sends only if the prior attempt
  never completed.

Refunds are issued **manually in the Stripe dashboard** (no in-app refund UI — consistent
with stripe-checkout's deferred "refund UI"); the webhook reacts to `charge.refunded`.

### Decisions made during brainstorming

- **Deep links** (`retryUrl`, `resumeUrl`) → a **new `/resume/:draftId` route** that
  rehydrates the draft and lands the buyer on checkout. (No such route exists today.)
- **Scope** → ship **everything in one ticket**, including the `pg_cron` abandoned-checkout
  nudge (neither `pg_cron` nor `pg_net` is used in the project yet — both must be enabled).
- **Refunds** → **manual via Stripe dashboard**, webhook-reactive. No in-app refund trigger.
- **Logged-out deep link** → **graceful degradation**. `ProtectedRoute` bounces an
  unauthenticated user to `/login`, which lands on `/dashboard`, where the draft is already
  listed with a Resume button. Accept the one extra click; do **not** add return-URL auth
  plumbing in this ticket.

## Acceptance Criteria

- A simulated `payment_intent.succeeded` (Stripe CLI) fires **exactly one** order-confirmation
  / receipt send to `orders.buyer_email` (mock-asserted), with `buyerName`, `orderId`,
  `productLabel`, `amountFormatted`, and `shippingAddress`.
- A simulated `payment_intent.payment_failed` fires exactly one payment-failed send with a
  working `retryUrl`.
- A simulated `charge.refunded` (incl. a **partial** refund) sets order status `refunded`
  and fires exactly one refund send with `orderId` and the **event's refunded amount**
  formatted as `amountFormatted`.
- The scheduled `nudge-abandoned-orders` job nudges a stale `pending` order (>24h, not yet
  nudged) **exactly once** and stamps it.
- A re-delivered/retried event or repeated cron tick does **not** produce a duplicate send,
  but still sends if the prior attempt never completed (at-least-once).
- Clicking `retryUrl` / `resumeUrl` lands the buyer back at their checkout (via
  `/resume/:draftId`), degrading to `/dashboard` if logged out.
- Stripe's own dashboard email receipts are turned **off**.
- `npm run lint && npm test && npm run test:deno && npm run build` all green.

## Prototype

None. No new customer-facing screens beyond the `/resume/:draftId` redirect route (which
reuses the existing draft-resume logic and renders the existing wizard). Email visual
design lives in Loops templates, not in code.

## Data Model

One migration adding columns to the existing `orders` table (no new tables):

| Column | Type | Notes |
|---|---|---|
| `receipt_email_sent_at` | timestamptz null | stamped after a successful receipt send |
| `payment_failed_email_sent_at` | timestamptz null | stamped after a successful failure send |
| `refund_email_sent_at` | timestamptz null | stamped after a successful refund send |
| `abandoned_email_sent_at` | timestamptz null | stamped after a successful nudge send |

- New `orders.status` value **`refunded`** (status is free-text `text` — no enum change).
- No new GRANTs/RLS needed: `orders` is already `service_role`-write, `authenticated`-read-own;
  these columns inherit that. The `stripe_webhook_events` ledger is unchanged.

## Screens / Flows

### Email triggers

| Email | Trigger | Recipient | Vars |
|---|---|---|---|
| Order confirmation / receipt | `stripe-webhook` → `payment_intent.succeeded` | `orders.buyer_email` | `buyerName`, `orderId`, `productLabel`, `amountFormatted`, `shippingAddress` |
| Payment failed | `stripe-webhook` → `payment_intent.payment_failed` | `orders.buyer_email` | `retryUrl` |
| Refund | `stripe-webhook` → `charge.refunded` (new branch) | `orders.buyer_email` | `orderId`, `amountFormatted` (event's refunded amount) |
| Abandoned checkout | `nudge-abandoned-orders` cron job | `orders.buyer_email` | `resumeUrl` |

Four new template IDs added to `LOOPS_TEMPLATES` in `_shared/loops.ts`. Run
`loops agent-context` at implementation time to obtain/confirm the IDs. Sender stays
`notify@thistlebook.com` (transactional/system/product) — Loops-side config, no code impact.

### Decision helper — `_shared/orderEmails.ts` (new)

Pure, Deno-testable; mirrors `accountEmails.ts`. Maps an order row + lifecycle event to
`{ templateId, dataVariables, sentColumn }`, and a `maybeSend…` that: checks the relevant
`*_email_sent_at` stamp → skips if set → otherwise `sendTransactional(...)` → stamps the
column on success. Keeps `stripe-webhook` and the cron function thin and unit-testable
against the Loops mock.

### Edge function changes

- **`stripe-webhook`** (modify): in the existing `succeeded`/`failed` branches, after the
  status update, call the helper to send receipt / payment-failed. Add a **new
  `charge.refunded` branch**: map `charge.payment_intent` → order, set status `refunded`,
  send refund email using the event's refunded amount (handles partials).
- **`nudge-abandoned-orders`** (new edge function): selects `status='pending'` orders older
  than 24h with `abandoned_email_sent_at IS NULL`, sends once each via the helper, stamps.
  Invoked by **`pg_cron` + `pg_net`** (enable both extensions; add the schedule via the
  Supabase SQL editor per CLAUDE.local.md, since `db push` is unreliable here). Logic stays
  in TS so it reuses `_shared/loops.ts` + the helper. This is a **transactional/system**
  nudge — distinct from the Ticket 5 marketing "finish your book" nudge.

### `/resume/:draftId` route (new)

Extract the existing `Dashboard.resumeDraft` logic (fetch draft → `deserializeAnswers` →
`setDraftId` → `navigate(current_step)`) into a shared helper. The new route, wrapped in
`ProtectedRoute`, rehydrates the draft into `WizardContext` and navigates to its saved step
(checkout for these orders). Powers both `retryUrl` and `resumeUrl`.

### Stripe dashboard (manual, no code)

Turn off Stripe-sent email receipts so Loops is the only payment-email sender.

## Edge cases

- **Re-delivered / out-of-order event** — `stripe_webhook_events` ledger no-ops the event;
  the per-column stamp prevents a duplicate send.
- **Retried event after a mid-flight failure** — stamp is still null, so the email re-sends
  (at-least-once intent).
- **`buyer_email` is null** — skip the send and log; can't email without a recipient.
- **Partial refund** — use the event's refunded amount, not the order total; status becomes
  `refunded` regardless of partial/full for v1.
- **Refund webhook for an order already `refunded`** — `refund_email_sent_at` stamp guards
  against a second email.
- **Abandoned job double-run** — `abandoned_email_sent_at IS NULL` filter + stamp ⇒ once.
- **Logged-out user clicks a deep link** — bounced to `/login` → lands on `/dashboard`,
  draft listed with Resume. Graceful degradation; accepted for v1.

## Scope

**In:**
- Migration: `orders` gains four `*_email_sent_at` columns; `refunded` status value.
- `_shared/orderEmails.ts` decision helper (+ Deno tests).
- `stripe-webhook`: receipt + payment-failed sends; new `charge.refunded` handler.
- `nudge-abandoned-orders` edge function + `pg_cron`/`pg_net` enablement and schedule.
- Four new Loops transactional templates wired into `LOOPS_TEMPLATES`.
- `/resume/:draftId` route reusing extracted draft-resume logic.
- Turn off Stripe dashboard email receipts.

**Deferred:**
- In-app refund trigger / admin UI (refunds stay manual in Stripe).
- Return-URL preservation through login for deep links (graceful degrade to `/dashboard`).
- Marketing "finish your book" nudge (Ticket 5) — distinct from this system nudge.
- Hardcover fulfillment (Lulu), subscriptions/credits, tax/VAT (per stripe-checkout).

## Open Questions

- None blocking. Loops template IDs to be fetched via `loops agent-context` during
  implementation. `pg_cron`/`pg_net` enablement + schedule applied via the Supabase SQL
  editor (CLI `db push` is unreliable on this remote per CLAUDE.local.md).

## More Info

- Reliability model: event-level idempotency (`stripe_webhook_events`) + send-level
  at-least-once (`*_email_sent_at` stamps). Both layers required; neither alone is
  sufficient.
- The `nudge-abandoned-orders` "abandoned checkout" semantically means a buyer who reached
  the payment step (a `pending` order exists because `create-payment-intent` ran) but did
  not pay within 24h.
