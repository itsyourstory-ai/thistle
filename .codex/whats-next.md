# What's Next

## Work completed and current state
Branch: `feature/tic-29-checkout-payment-emails-via-loops`.

Committed on this branch:
- `75abc65 docs: add design for checkout & payment emails (TIC-29)`
- `566372d docs: add plan for checkout & payment emails (TIC-29)`
- `60eaa70 docs: update session handoff`
- `cfbe55c feat: add checkout payment email foundation`

Draft implementation work is present but not staged or committed. In `docs/plans/checkout-payment-emails.md`, Tasks 1 through 6 are marked done. Task 7 remains open.

Completed current-session work:
- Task 4: Added `supabase/functions/nudge-abandoned-orders/index.ts`, registered `[functions.nudge-abandoned-orders] verify_jwt = false` in `supabase/config.toml`, and added the pure abandoned-order cutoff/candidate helpers plus Deno tests in `supabase/functions/_shared/orderEmails.ts` and `orderEmails.test.ts`.
- Task 6: Added `supabase/migrations/20260629000002_schedule_abandoned_order_nudges.sql` to document the `pg_cron`/`pg_net` schedule. The user manually configured the Supabase Vault secret and invoked the deployed function. A read-only check confirmed cron job `nudge-abandoned-orders-hourly` exists with schedule `0 * * * *` and `active = true`.
- Loops variable alignment: The user created `.codex/loops-templates/` files from the Loops API. Those files showed the four transactional templates are draft-only (`publishedEmailMessageId: null`) and exposed the actual LMX variables. `orderEmails.ts`, tests, `AGENTS.md`, and the design/plan docs were updated to match:
  - Order confirmation: `buyerName`, `orderId`, `productLabel`, `amountFormatted`, `shippingAddress`.
  - Payment failed: `retryUrl`.
  - Refund issued: `orderId`, `amountFormatted`.
  - Abandoned checkout: `resumeUrl`.
- Deployments already performed successfully:
  - `supabase functions deploy nudge-abandoned-orders`
  - `supabase functions deploy stripe-webhook`
  - `supabase functions deploy stripe-webhook nudge-abandoned-orders`

Current uncommitted/draft files from the implementation work:
- `AGENTS.md`
- `docs/designs/checkout-payment-emails.md`
- `docs/plans/checkout-payment-emails.md`
- `supabase/config.toml`
- `supabase/functions/_shared/orderEmails.test.ts`
- `supabase/functions/_shared/orderEmails.ts`
- `supabase/functions/nudge-abandoned-orders/`
- `supabase/migrations/20260629000002_schedule_abandoned_order_nudges.sql`
- `.codex/loops-templates/` from the user-provided Loops template pull; do not stage this unless the user explicitly wants local template JSON committed.

Verification already run successfully after the current implementation work:
- `npm test`: 35 files passed, 288 tests passed.
- `mise exec -- npm run test:deno`: 131 passed, 0 failed.
- `npm run build`: passed.
- `npm run lint`: exit 0 with existing warning baseline only, 64 warnings.
- `git diff --check`: clean.
- `mise exec -- deno test --allow-env supabase/functions/_shared/orderEmails.test.ts`: 17 passed.
- `mise exec -- deno fmt --check supabase/functions/_shared/orderEmails.ts supabase/functions/_shared/orderEmails.test.ts supabase/functions/stripe-webhook/index.ts supabase/functions/nudge-abandoned-orders/index.ts`: passed.
- `mise exec -- deno check supabase/functions/stripe-webhook/index.ts supabase/functions/nudge-abandoned-orders/index.ts`: passed.

Important environment note: plain `npm run test:deno` fails in this shell because `deno` is not on `PATH`; use `mise exec -- npm run test:deno`.

## Work Remaining
Continue from Task 7 in `docs/plans/checkout-payment-emails.md`.

1. Confirm external Stripe/Loops setup.
   - Confirm Stripe customer emails/receipts/refund emails are turned off so Loops is the only payment-email sender.
   - Confirm the four Loops transactional templates are published. The latest local metadata showed `publishedEmailMessageId: null` for all four, so this may still be blocking live sends.

2. Re-run a fresh successful payment test after the variable fix and redeploy.
   - Create a fresh unconfirmed test PaymentIntent.
   - Update the test `orders.stripe_payment_intent_id` to that PaymentIntent before confirmation.
   - Confirm the PaymentIntent.
   - Verify the order becomes `paid`, `receipt_email_sent_at` is not null, and exactly one Loops order confirmation email is sent to the test buyer email with real values for `buyerName`, `orderId`, `productLabel`, `amountFormatted`, and `shippingAddress`.
   - Redeliver the same Stripe event and confirm no second Loops email is sent.

3. Run the remaining Stripe CLI scenarios.
   - Payment failed: verify `payment_failed_email_sent_at` is set and the Loops email contains a `retryUrl` pointing to `/resume/:draftId`.
   - Partial refund: verify `refund_email_sent_at` is set and exactly one refund email is sent with `orderId` and `amountFormatted`.

4. Run the final gate in the current message before claiming completion.
   - `npm run lint`
   - `npm test`
   - `mise exec -- npm run test:deno`
   - `npm run build`
   - `git diff`

5. Review, mark Task 7 done, and open the PR if requested.

## Dead Ends
- Supabase DB mutation via CLI was rejected by approvals for this session, so the user applied the Vault/SQL pieces manually.
- Supabase API key listing/revealing was rejected by approvals. The user provided the service-role JWT directly, then the Vault secret was handled manually.
- Reading `net._http_response` hung and was interrupted; the manual function response plus cron row check was used instead.
- Loops CLI keyring auth was not usable in Codex: `auth list` showed `thistle` active, but `auth status` and `transactional get` still reported no active team. Escalated keyring access was rejected, so the user exported `LOOPS_API_KEY` and wrote the template JSON files locally.
- `loops transactional get` metadata had `dataVariables: []` and only draft message IDs. The actual variables were only visible after inspecting the Loops email-message JSON/LMX files.
- Stripe PaymentIntents that are confirmed before the order row is pointed at them can leave the webhook unable to match the order and may consume the Stripe event ledger as a duplicate. Use this sequence for fresh tests: create unconfirmed PI, update the order to that PI, then confirm.

## Open Questions
- Are the four Loops transactional templates published now? Local metadata showed draft-only templates.
- Are Stripe customer payment/refund emails off in test mode and live mode?
- Which specific test order/draft should be used for the remaining payment-failed and refund scenarios?
