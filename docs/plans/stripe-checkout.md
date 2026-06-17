# Plan: Stripe Payments / Checkout (TIC-12)

## Status

| Task | Description | Assign | Done |
| ---- | ----------- | ------ | ---- |
| 1 | `orders` + `stripe_webhook_events` migration (RLS, grants, types) | Master | |
| 2 | `_shared/stripe.ts` — price map, shipping + discount validation (pure, tested) | Master | |
| 3 | `create-payment-intent` edge function + config | Master | |
| 4 | `stripe-webhook` edge function + config | Master | |
| 5 | `generate-book` paid-gate modification | Master | |
| 6 | Client Stripe deps + provider wiring | Master | |
| 7 | Step 11 Payment Element + price reconcile + wire create-payment-intent | Master | |
| 8 | Hardcover shipping-address block | Clone | |
| 9 | Discount-code field | Clone | |
| 10 | Step 12 pass `order_id` to generate-book | Master | |
| 11 | `bypassCheckout` dev/test flag (harness + panel + server marker) | Master | |

## Prerequisites

- Design: [docs/designs/stripe-checkout.md](../designs/stripe-checkout.md)
- Prototype: `src/pages/steps/Step10Preview.tsx` — FINAL visual design; new UI (Payment Element, shipping block, discount field) built to match its styling.
- Feature branch: already on `feature/stripe-checkout`.
- **External setup (you/the user, outside code):** Stripe account with `digital` + `hardcover` products; test promotion code; Supabase secrets `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`; client env `VITE_STRIPE_PUBLISHABLE_KEY`; webhook endpoint registered to the deployed `stripe-webhook` URL.

---

## Phase 1 — Server foundation

### Task 1 [Master]: `orders` + `stripe_webhook_events` migration

**Reference:** Read `supabase/migrations/20260611000001_add_book_drafts.sql` and `supabase/migrations/20260610000001_add_auth_ownership.sql` for table/RLS/grant style.

**In scope:**

- New migration `supabase/migrations/<timestamp>_add_orders.sql` creating both tables exactly per the design's Data Model section.
- `orders`: columns as specified; `stripe_payment_intent_id` **unique**; **unique index on `(user_id, draft_id)`** (upsert key); index on `user_id`; `updated_at` set by app writes (match existing convention — `book_drafts` has no trigger).
- RLS on `orders`: enable RLS; `SELECT` policy `auth.uid() = user_id` granted to `authenticated`; **no** client INSERT/UPDATE/DELETE policy.
- `stripe_webhook_events`: `event_id text PK`, `type text`, `received_at timestamptz default now()`; RLS on; **no** policies.
- Hand-add the two tables to `src/integrations/supabase/types.ts` (file is generated but maintained by hand here; mirror an existing table's shape).

**NOT in scope:**

- Any `book_id`/fulfillment columns beyond what's in the design table.
- Refund/cancellation columns.

**Build order:**

1. **Test:** No runner for raw SQL in this repo. Verify-by-inspection: confirm every column in the design table exists, `stripe_payment_intent_id` is UNIQUE, `(user_id, draft_id)` is UNIQUE, RLS is enabled on both, and `orders` has exactly one SELECT policy (no write policies).
2. **Implement:** Write the migration SQL + types edits.
3. **Verify:** `npm run build` (catches the types edit). Re-read the SQL against the design Data Model + RLS section line by line.
4. **Review:** Run review-changes before proceeding.

---

### Task 2 [Master]: `_shared/stripe.ts` pure helpers (price map, shipping + discount validation)

**Reference:** Read `supabase/functions/_shared/sanitize.ts` + `supabase/functions/_shared/sanitize.test.ts` for the pure-module + Deno-test pattern.

**In scope:**

- `supabase/functions/_shared/stripe.ts` exporting **pure, side-effect-free** functions:
  - `PRICE_MAP = { digital: 999, hardcover: 5499 }` and `baseAmountFor(product): number` (throws on unknown product).
  - `validateShipping(product, shipping): { ok: true } | { ok: false; errors: Record<string,string> }` — hardcover requires `street1, city, state_code, postcode, phone`; forces `country_code: "US"`; digital → `ok: true` with no shipping.
  - `computeAmount(base, discountCents): number` — clamps at ≥ 0 (Stripe minimum handled in the function, not here).
- `supabase/functions/_shared/stripe.test.ts` covering: price lookup, unknown product throw, hardcover missing-phone / missing-state rejected, valid hardcover accepted, digital skips shipping, discount clamp.

**NOT in scope:**

- Any Stripe SDK calls or network (those live in Task 3/4). This file is pure logic only.
- Promotion-code lookup itself (that's a Stripe API call in Task 3) — only the amount math here.

**Build order:**

1. **Test:** Write `stripe.test.ts` first (TDD) with the cases above.
2. **Implement:** Write `stripe.ts` to pass them.
3. **Verify:** `npm run test:deno`
4. **Review:** Run review-changes before proceeding.

---

### Task 3 [Master]: `create-payment-intent` edge function

**Depends on:** Tasks 1, 2.
**Reference:** Read `supabase/functions/generate-book/index.ts` lines 336–365 (auth resolution, service-role client, rate limit) and `supabase/functions/_shared/auth.ts` + `supabase/functions/_shared/rateLimit.ts`.

**In scope:**

- `supabase/functions/create-payment-intent/index.ts`:
  - CORS preflight; require authed user (`requireAuthedUser`); `checkRateLimit(..., "create-payment-intent", <limit>, 60)`.
  - Read body: `{ product, draft_id, discount_code?, shipping?, buyer_name?, buyer_email? }`.
  - Compute `base_amount_cents` via `baseAmountFor` (Task 2); validate shipping via `validateShipping` → 400 with field errors on failure.
  - If `discount_code`: look it up via Stripe promotion codes API; invalid/expired → return amount unchanged + `discount_invalid: true` (no 4xx — inline error UX). Valid → compute `discount_cents`.
  - Stripe SDK via esm.sh with Deno fetch http client; init from `STRIPE_SECRET_KEY`.
  - **Upsert** one `orders` row keyed on `(user_id, draft_id)` (service-role); create-or-update the PaymentIntent using **Stripe idempotency key = order id**; attach buyer name/email to a Stripe customer + PI metadata.
  - Persist `stripe_payment_intent_id`, `stripe_customer_id`, amounts, discount, shipping, status `pending`.
  - Return `{ client_secret, order_id, amount_cents, discount_cents }`.
- Add `[functions.create-payment-intent] verify_jwt = false` to `supabase/config.toml` (auth handled in-function, matching the other functions).

**NOT in scope:**

- Webhook handling, generation, refunds.
- Any client changes.

**Build order:**

1. **Test:** Pure branches (price, shipping, discount math) are already covered by Task 2's `stripe.test.ts` — keep business logic delegating to those helpers so it stays tested. The Deno.serve handler itself is integration-verified manually (Stripe test mode) — note this in the PR, no new unit test for the network handler.
2. **Implement:** Write the function + config entry.
3. **Verify:** `npm run test:deno` (shared helpers still green); `npx supabase functions serve create-payment-intent` smoke test against Stripe test keys if available, else manual note.
4. **Review:** Run review-changes before proceeding.

---

### Task 4 [Master]: `stripe-webhook` edge function

**Depends on:** Tasks 1, 2.
**Reference:** Same auth/service-role patterns; Stripe `constructEventAsync` (async — Deno uses SubtleCrypto).

**In scope:**

- `supabase/functions/stripe-webhook/index.ts`:
  - **No** user auth (webhook is server-to-server). Read raw body + `stripe-signature` header; verify with `STRIPE_WEBHOOK_SECRET` via `constructEventAsync` → 400 on bad signature.
  - Idempotency: `INSERT INTO stripe_webhook_events (event_id, type) ... ON CONFLICT DO NOTHING`; 0 rows affected → already processed → return 200 immediately.
  - `payment_intent.succeeded` → update matching `orders` set `status='paid'`, `paid_at=now()` `WHERE stripe_payment_intent_id = ? AND status <> 'paid'`.
  - `payment_intent.payment_failed` → set `status='failed'`.
  - Always return 200 fast on handled events.
- Add `[functions.stripe-webhook] verify_jwt = false` to `supabase/config.toml`.

**NOT in scope:**

- Email/receipt sending (later Loops ticket).
- Triggering generation (client-driven via Step 12).

**Build order:**

1. **Test:** Manual verification via Stripe CLI `stripe trigger payment_intent.succeeded` against `functions serve` (note in PR). If any idempotency/parse helper is extracted as pure, add it to `stripe.test.ts`.
2. **Implement:** Write the function + config entry.
3. **Verify:** `npm run test:deno`; Stripe CLI replay shows duplicate event → second delivery is a no-op 200.
4. **Review:** Run review-changes before proceeding.

---

### Task 5 [Master]: `generate-book` paid-gate

**Depends on:** Tasks 1, 4. Modifies an existing shared function.
**Reference:** `supabase/functions/generate-book/index.ts` — insert the gate after auth/rate-limit (~line 365) and before the stub insert (line 407); set `orders.book_id` right after the stub insert (line 437).

**In scope:**

- Accept `order_id` (and the bypass marker — see Task 11) in the request body.
- Verify the order belongs to `user.id` and its `product` matches the brief's selected plan.
- Proceed only if `status='paid'`; if not paid, **fallback**: retrieve the PaymentIntent from Stripe and proceed iff `status='succeeded'` (and mark the order paid). Otherwise return a 402-style error (`{ error, status: 402 }`) and do **not** insert a book row.
- After the stub `generated_books` insert, `UPDATE orders SET book_id = <bookId> WHERE id = order_id`.

**NOT in scope:**

- Changing story/image generation logic.
- The dev bypass code path (added in Task 11, but leave the body field threaded through).

**Build order:**

1. **Test:** Add/extend a Deno test for any extracted gate helper (e.g. `isOrderEligible(order, product)`); keep the Stripe-retrieve call thin. Manual: unpaid order → 402, no `generated_books` row.
2. **Implement:** Thread `order_id`, add gate + `book_id` link.
3. **Verify:** `npm run test:deno`; manual unpaid/paid checks noted in PR.
4. **Review:** Run review-changes before proceeding.

---

## Phase 2 — Client checkout

### Task 6 [Master]: Stripe client deps + provider wiring

**In scope:**

- Add deps `@stripe/stripe-js` + `@stripe/react-stripe-js` (design pre-approves these — confirm before installing).
- New `src/lib/stripe.ts`: `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)` singleton, with a DEV placeholder fallback mirroring `src/integrations/supabase/client.ts` so the app boots without the key.
- Add `VITE_STRIPE_PUBLISHABLE_KEY` to env docs / `.env.example` if present.

**NOT in scope:**

- The Payment Element UI (Task 7).

**Build order:**

1. **Test:** `npx vitest run src/test/<smoke>` — assert the stripe singleton module imports without throwing in DEV (placeholder path).
2. **Implement:** Install deps, add `src/lib/stripe.ts`.
3. **Verify:** `npm run lint && npm run build`
4. **Review:** Run review-changes before proceeding.

---

### Task 7 [Master]: Step 11 Payment Element + price reconcile + create-payment-intent wiring

**Depends on:** Tasks 3, 6. Core/fuzzy — Master. Touches the prototype file.
**Prototype:** `src/pages/steps/Step10Preview.tsx` — keep plan cards, buyer fields, trust signals, testimonial **unchanged**. Only replace the mock pay button and add the Payment Element.
**Reference:** `src/lib/edgeFunctions.ts` for the call wrapper; existing buyer-form validation in `Step10Preview.tsx` (lines 45–57).

**In scope:**

- Update copy price: hardcover **$54.99** (lines 43, 215); digital stays $9.99.
- On plan select / mount with valid buyer info, call `create-payment-intent` (via a new `EdgeFnName` entry — see note) → store `client_secret` + `order_id`; display server-returned amount on the button ("Pay $X & start crafting").
- Wrap the Payment Element in `<Elements stripe={...} options={{ clientSecret }}>`; on submit call `stripe.confirmPayment({ elements, redirect: 'if_required' })`; success → `setAnswer("orderId", order_id)` and `navigate(pathForStep(11))`; error → inline message, stay on Step 11; disable button while confirming.
- Re-call `create-payment-intent` (same order) when the plan toggles, so the PI amount updates.

**NOT in scope:**

- Shipping block (Task 8), discount field (Task 9) — leave clearly marked insertion points.
- Removing the existing buyer-name/email validation.

**Notes for the implementer:**

- `callEdge`'s `EdgeFnName` union (line 20 of `src/lib/edgeFunctions.ts`) is **typed** — add `"create-payment-intent"` there. This is shared infra, hence Master owns Task 7.
- Add `orderId` to wizard answers type in `src/lib/wizardTypes.ts` (near `selectedPlan`, line 133).

**Build order:**

1. **Test:** Extend `src/test/Step10Preview.test.tsx`: mock `callEdge`, assert PI requested on plan select, button shows server amount, success navigates, error stays + shows message. Mock `@stripe/react-stripe-js`.
2. **Implement:** Wire it up.
3. **Verify:** `npx vitest run src/test/Step10Preview.test.tsx`
4. **Review:** Run review-changes before proceeding.

---

### Task 8 [Clone]: Hardcover shipping-address block

**Depends on:** Task 7 (insertion point + PI re-call). Scoped UI.
**Prototype:** Match Step 11 styling (existing `Input`/`Label` usage, `Step10Preview.tsx` lines 70–100).

**In scope:**

- A shipping sub-form rendered only when `selected === "hardcover"`: name, street1, street2 (optional), city, **US state `<select>`** (`state_code`), postcode, **phone** (required). Country fixed "US" (display only).
- Field-level validation mirroring `validateShipping` rules; block pay + show inline errors when invalid; pass `shipping` into the `create-payment-intent` call.
- Digital hides the block and sends no shipping.

**NOT in scope:**

- Discount field, Payment Element internals, non-US addresses, Lulu fulfillment.

**Build order:**

1. **Test:** Extend `Step10Preview.test.tsx`: hardcover shows shipping + blocks pay when phone/state missing; digital hides it.
2. **Implement:** Add the block + validation + thread `shipping`.
3. **Verify:** `npx vitest run src/test/Step10Preview.test.tsx`
4. **Review:** Run review-changes before proceeding.

---

### Task 9 [Clone]: Discount-code field

**Depends on:** Task 7. Scoped UI.

> Tasks 8 and 9 both edit `Step10Preview.tsx`. Run them **sequentially (8 then 9)** to avoid same-file conflicts.

**In scope:**

- Discount-code input + "Apply" button; on apply, re-call `create-payment-intent` with `discount_code`; valid → update displayed total from server response; invalid (`discount_invalid`) → inline error, total unchanged.

**NOT in scope:**

- Code management UI, stacking multiple codes.

**Build order:**

1. **Test:** Extend `Step10Preview.test.tsx`: valid code lowers shown amount; invalid shows error + unchanged amount.
2. **Implement:** Add field + apply handler.
3. **Verify:** `npx vitest run src/test/Step10Preview.test.tsx`
4. **Review:** Run review-changes before proceeding.

---

### Task 10 [Master]: Step 12 passes `order_id` to generate-book

**Depends on:** Tasks 5, 7.
**Reference:** `src/pages/steps/Step9Generating.tsx` lines 48–53 (the `callEdge("generate-book", …)` body).

**In scope:**

- Add `order_id: answers.orderId` to the `generate-book` call body.
- If `orderId` is missing (and not in bypass — Task 11), show the existing error state instead of generating.

**NOT in scope:**

- Polling/animation changes.

**Build order:**

1. **Test:** Add a test asserting `generate-book` is called with `order_id` and that a missing order id surfaces the error path.
2. **Implement:** Thread `order_id`.
3. **Verify:** `npx vitest run src/test/<generating-test>`
4. **Review:** Run review-changes before proceeding.

---

## Phase 3 — Dev/test bypass

### Task 11 [Master]: `bypassCheckout` flag

**Depends on:** Tasks 5, 7, 10. Touches shared harness + server gate.
**Reference:** `src/lib/testMode.ts` (state shape + DEV guards) and `src/components/DevTestPanel.tsx`.

**In scope:**

- Add `bypassCheckout: boolean` (default false) to `TestModeState` + `DEFAULT_STATE`; expose a toggle in `DevTestPanel.tsx`.
- Step 11: when DEV + `bypassCheckout`, skip the Payment Element entirely and route straight to Step 12.
- Generate-book call: when bypassing, include a bypass marker; `generate-book` (Task 5) skips the paid-order check **only** when it sees that marker AND is running in a non-prod context. Production behaviour stays byte-identical (guarded by `import.meta.env.DEV` client-side; server marker is inert without it).

**NOT in scope:**

- Any change to production payment flow.

**Build order:**

1. **Test:** `src/test/testMode` (or panel test) asserting the flag round-trips and that a bypass build skips PI. Deno test for the server's bypass-marker guard.
2. **Implement:** Add flag + bypass branches.
3. **Verify:** `npx vitest run` (affected files) + `npm run test:deno`
4. **Review:** Run review-changes before proceeding.

---

## Task Dependencies

- **Task 1** (migration) blocks Tasks 3, 4, 5.
- **Task 2** (pure helpers) blocks Tasks 3, 5 (and supports 4).
- **Task 3** (create-payment-intent) blocks Task 7.
- **Task 4** (webhook) blocks Task 5's fallback verification.
- **Task 5** (gate) blocks Tasks 10, 11.
- **Task 6** (deps) blocks Task 7.
- **Tasks 8 and 9** depend on Task 7 and both edit `Step10Preview.tsx` — run **sequentially (8 then 9)**, not parallel.
- **Task 10** depends on Tasks 5 + 7.
- **Task 11** depends on Tasks 5, 7, 10.

**Critical path:** 1 → 2 → 3 → 6 → 7 → 8 → 9 → 10 → 11, with 4 → 5 joining before 10.

**Before each PR-able phase boundary:** `npm run lint && npm test && npm run build`.

## Notes / deviations

- **Edge functions aren't end-to-end unit-tested in this repo** — only `_shared/*` pure modules are (Deno tests). The plan pushes business logic into `_shared/stripe.ts` (Task 2) so the testable parts stay covered; the network handlers (`create-payment-intent`, `stripe-webhook`) are verified manually against Stripe test mode / Stripe CLI. This is a deliberate deviation from "every change has an automated test," driven by the existing repo structure.
