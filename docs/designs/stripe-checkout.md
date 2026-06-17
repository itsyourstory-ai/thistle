# Feature: Stripe payments / checkout (TIC-12)

Notion ticket: https://app.notion.com/p/3800fc47bb8b809b82bec714ac614670

## Problem

Step 11 checkout (`src/pages/steps/Step10Preview.tsx`) has a **mock** pay button — it
validates the buyer form and sends the user straight to book generation without
charging. Book generation is expensive (AI image + text), so we need a real one-time
payment that **gates** generation: the user pays for their selected product, and full
generation only proceeds once payment succeeds.

For: a buyer purchasing a personalized children's book at the end of the wizard.

## Approach

Embedded Stripe **Payment Element** (in-page, not hosted Checkout) on Step 11, backed by
two new Supabase edge functions and a new `orders` table. The server owns the price and
independently verifies payment before generation runs.

- **Payment gate:** webhook marks the order paid; `generate-book` checks the order is
  paid and, if the webhook hasn't landed yet, falls back to retrieving the PaymentIntent
  from Stripe. No user-facing wait, server-verified, tamper-proof.
- **Discount codes:** Stripe **promotion codes** (created in the Stripe dashboard). Server
  looks them up, validates, and recomputes the amount. No management UI (out of scope).
- **Receipts/email:** Stripe stays **payment-only** (no Stripe-sent emails). Buyer
  name/email are attached to the Stripe customer + PaymentIntent metadata for later use.
  All customer-facing email (receipt + "book ready") ships in a **later Loops ticket**,
  which will read from the `orders` table.

## Acceptance Criteria

- A user on Step 11 can pay with a real (test-mode) card via the embedded Payment Element.
- Selecting hardcover requires a valid shipping address before payment; digital does not.
- A valid discount code reduces the charged amount; an invalid/expired one is rejected
  without changing the price.
- A successful payment creates an `orders` row marked paid (confirmed via webhook, not
  just client-side success) and then proceeds to book generation.
- A failed/declined payment shows an error and does **not** proceed to generation.
- A refresh or repeated submit during payment does not produce a second charge; a
  re-delivered webhook event is processed only once.
- An unpaid/abandoned order never unlocks book generation.
- Server sets the charge amount from the selected product and any valid discount; a
  tampered client request can't change the price.
- Stripe secret key and webhook signing secret live in env/secrets, never in client code.
- Devs and automated tests can bypass checkout to reach generation without a real charge.

## Prototype

`src/pages/steps/Step10Preview.tsx` — the existing checkout screen is the FINAL visual
design. Plan cards, buyer name/email, trust signals, and testimonial are unchanged. New
UI not covered by the prototype (built to match its styling): the Payment Element, the
hardcover shipping-address block, and the discount-code field.

Price reconciled: hardcover is **$54.99** (ticket), updating the current `$44.99` copy.
Digital stays **$9.99**.

## Data Model

### New table `orders`
One row per checkout attempt, created when the PaymentIntent is created. Writes via
`service_role` only.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid → `auth.users` | authed buyer, cascade delete, indexed |
| `status` | text | `pending` → `paid` / `failed`, default `pending` |
| `product` | text | `digital` \| `hardcover` |
| `base_amount_cents` | int | pre-discount, server-set |
| `discount_code` | text null | applied code |
| `discount_cents` | int | default 0 |
| `amount_cents` | int | final charged amount, server-computed |
| `currency` | text | default `usd` |
| `buyer_name` | text null | |
| `buyer_email` | text null | also → Stripe customer/metadata |
| `shipping` | jsonb null | Lulu-compatible shape for hardcover; null for digital. `{name, street1, street2, city, state_code, postcode, country_code, phone}` — `country_code` fixed `"US"` for v1, `state_code` = US state. Field names match the Lulu print API so the future fulfillment ticket needs no mapping. |
| `stripe_payment_intent_id` | text **unique** | guards double-create |
| `stripe_customer_id` | text null | |
| `draft_id` | uuid null | ties order to the wizard session (`book_drafts`) before a book exists |
| `book_id` | uuid → `generated_books` null | set after generation |
| `created_at` / `updated_at` / `paid_at` | timestamptz | |

### New table `stripe_webhook_events`
Idempotency ledger. `service_role` only, no client policies.

| Column | Type | Notes |
|---|---|---|
| `event_id` | text PK | Stripe `evt_…` id |
| `type` | text | e.g. `payment_intent.succeeded` |
| `received_at` | timestamptz | default `now()` |

### RLS + GRANTs (mirrors `generated_books`)
- `orders`: RLS on. `SELECT` for own rows (`auth.uid() = user_id`), granted to
  `authenticated`. No client INSERT/UPDATE — all writes via `service_role`.
- `stripe_webhook_events`: RLS on, no client policies — `service_role` only.

## Screens / Flows

Step 11 checkout → Step 12 generation (`src/pages/steps/Step9Generating.tsx`).

1. Step 11 loads with the existing plan cards + buyer name/email. Selecting a plan asks
   the server to create a PaymentIntent and returns a `client_secret`.
2. Hardcover → a shipping-address block appears (required before paying): name, street1,
   street2 (optional), city, **US state dropdown** (`state_code`), postcode, and **phone**
   (required — Lulu/carriers need it). Country is fixed to US for v1. Digital hides it.
3. Optional discount-code field + "Apply"; server validates against Stripe promotion
   codes and recomputes the total, updating the same PaymentIntent's amount. Invalid →
   inline error, total unchanged.
4. Toggling plan / applying a code updates the existing PaymentIntent's amount
   server-side. Displayed "Pay $X" always comes from the server's computed amount.
5. Embedded Payment Element + "Pay $X & start crafting" replaces the mock button.
   `confirmPayment({ redirect: 'if_required' })` keeps the user in-page. Errors show
   inline; the user stays on Step 11.
6. On success → Step 12 calls `generate-book` with `order_id`. `generate-book` confirms
   the order is paid (webhook, with Stripe-API fallback) before inserting the book row,
   then links `orders.book_id`.
7. Stripe webhook fires `payment_intent.succeeded` → `stripe-webhook` marks the order
   paid (idempotently).

### Edge functions

- **`create-payment-intent`** (new): auth + rate-limited. Sets `base_amount_cents` from a
  server-side price map (digital 999, hardcover 5499). Validates hardcover shipping
  (requires street1, city, `state_code`, postcode, phone; `country_code` forced to `US`).
  Validates discount via Stripe promotion code. Upserts one `orders` row keyed on
  `(user_id, draft_id)`, creates/updates its PaymentIntent (Stripe idempotency key = order
  id). Returns `{ client_secret, order_id, amount_cents, discount_cents }`. Also serves the
  plan-change and "Apply code" re-calls.
- **`stripe-webhook`** (new): deployed with **JWT verification off**. Verifies signature
  with `STRIPE_WEBHOOK_SECRET` via Deno's `constructEventAsync`. Inserts into
  `stripe_webhook_events` (`ON CONFLICT DO NOTHING`; 0 rows = already processed → 200). On
  `payment_intent.succeeded` marks order `paid` (`WHERE status <> 'paid'`); on
  `payment_intent.payment_failed` marks `failed`. Returns 200 fast.
- **`generate-book`** (modify): accept `order_id`; verify it belongs to the caller and
  matches the product; proceed only if paid (or PI `succeeded` via fallback), else
  return a 402-style error and do not generate. Set `orders.book_id` after the stub insert.

### Dev / test bypass
Add a `bypassCheckout` flag to the existing test-mode harness (`src/lib/testMode.ts`,
DEV only). When on: Step 11 skips the Payment Element and routes straight to Step 12, and
`generate-book` accepts a bypass marker that skips the paid-order check. Reuses the
existing harness; production stays byte-identical.

## Edge cases

- **Declined / payment error** — inline error under the Payment Element, stay on Step 11,
  order stays `pending`, no generation.
- **Network error mid-confirm** — inline error; retry reuses the same PI (no second charge).
- **Refresh / double-submit** — order keyed on `(user_id, draft_id)` + Stripe idempotency
  key → same PI reused; pay button disables while confirming.
- **Closes tab mid-payment** — order stays `pending` (inert); returning reuses the same PI.
- **Webhook re-delivered / out-of-order** — ledger + `WHERE status <> 'paid'` → processed
  once, duplicate is a no-op 200.
- **Paid but webhook lagging at generation** — `generate-book` retrieves the PI from
  Stripe and proceeds if `succeeded`. No user-facing wait.
- **Tampered client (fake price / skipped payment)** — server sets amount from the product
  map; `generate-book` independently verifies a paid order; no paid order → error, no
  generation.
- **Unpaid / abandoned order** — stays `pending`, never satisfies the gate.
- **Invalid / expired discount code** — server rejects, amount unchanged, inline error.
- **Hardcover with missing/invalid shipping** — `create-payment-intent` rejects before
  creating the PI; client blocks pay and shows field errors (incl. missing phone / state).
  Digital skips shipping.
- **Amount changes after a PI exists** — server updates the existing PI's amount; displayed
  total reflects the server response.

## Scope

**In:**
- Stripe account + products/prices (digital, hardcover); test + live keys configured.
- `orders` + `stripe_webhook_events` tables with GRANTs + RLS.
- `create-payment-intent` and `stripe-webhook` edge functions; `generate-book` paid gate.
- Payment Element, hardcover shipping address, discount-code field on Step 11.
- Failure-state handling (declined, network, abandoned), idempotency / double-charge
  protection, unpaid orders inert.
- Dev/test checkout bypass via the existing test-mode harness.
- New deps: `@stripe/stripe-js`, `@stripe/react-stripe-js` (client); Stripe SDK via
  esm.sh (edge functions). New secrets: `VITE_STRIPE_PUBLISHABLE_KEY` (client),
  `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (Supabase).

**Deferred:**
- Refunds / cancellations.
- Hardcover fulfillment / printing pipeline via **Lulu** (https://www.lulu.com/, print
  API at https://developers.lulu.com/). Separate ticket. This ticket collects + stores a
  Lulu-compatible US shipping address (incl. phone) so fulfillment needs no re-collection
  or migration. Hardcover is **US-only** for v1.
- Transactional email (receipt + "book ready") — separate **Loops** ticket, reads from
  `orders`.
- Subscriptions, credits, tax/VAT.
- Discount-code management UI (codes configured in Stripe for v1).
- Abandoned-cart reminders / recovery.
- Saved payment methods / customer accounts beyond a single charge.

## Open Questions

- None blocking. Hardcover fulfillment via Lulu is confirmed deferred to a later ticket;
  this ticket collects + stores a Lulu-compatible US shipping address (incl. phone) only.
