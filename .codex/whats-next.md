# What's Next

## Work completed and current state
Branch: `feature/tic-29-checkout-payment-emails-via-loops`.

Committed on this branch before catchup:
- `75abc65 docs: add design for checkout & payment emails (TIC-29)`
- `566372d docs: add plan for checkout & payment emails (TIC-29)`

Draft implementation work is present but not staged or committed. In `docs/plans/checkout-payment-emails.md`, Tasks 1, 2, 3, and 5 are marked done. Tasks 4, 6, and 7 remain open.

Completed draft work:
- Task 1: Added `supabase/migrations/20260629000001_add_order_email_stamps.sql`, applied it to the linked Thistle Supabase project `uglsyitjasajubfvbiry`, and verified the four columns exist: `receipt_email_sent_at`, `payment_failed_email_sent_at`, `refund_email_sent_at`, and `abandoned_email_sent_at`.
- Task 2: Added `supabase/functions/_shared/orderEmails.ts` and `supabase/functions/_shared/orderEmails.test.ts`; added Loops template IDs in `supabase/functions/_shared/loops.ts`; documented `APP_BASE_URL` and payment email template variables in `AGENTS.md`.
- Task 3: Updated `supabase/functions/stripe-webhook/index.ts` to re-select orders and send receipt/payment-failed/refund emails best-effort via the new order email helper, including a new `charge.refunded` branch.
- Task 5: Added `src/lib/resumeDraft.ts`, `src/pages/ResumeDraft.tsx`, `src/test/ResumeDraft.test.tsx`; refactored `src/pages/Dashboard.tsx`; updated `src/test/Dashboard.test.tsx`; added the protected `/resume/:draftId` route in `src/App.tsx`.

Verification already run successfully:
- `npm test`: 34 files passed, 285 tests passed.
- `npm run lint`: exit 0 with existing warning baseline only.
- `mise exec -- npm run test:deno`: 129 passed, 0 failed.
- `mise exec -- deno check supabase/functions/stripe-webhook/index.ts`: passed.
- `mise exec -- deno fmt --check supabase/functions/_shared/orderEmails.ts supabase/functions/_shared/orderEmails.test.ts supabase/functions/stripe-webhook/index.ts`: passed.
- `npm test -- ResumeDraft Dashboard`: 2 files passed, 9 tests passed.
- `npm run build`: passed.
- `git diff --check`: clean.

Important environment note: plain `npm run test:deno` fails in this shell because `deno` is not on `PATH`; use `mise exec -- npm run test:deno`.

## Work Remaining
Continue from `docs/plans/checkout-payment-emails.md`.

1. Task 4: Implement `nudge-abandoned-orders`.
   - Add `supabase/functions/nudge-abandoned-orders/index.ts`.
   - Register `[functions.nudge-abandoned-orders] verify_jwt = false` in `supabase/config.toml`.
   - Use `createServiceRoleClient`, select `orders` with `status = 'pending'`, `abandoned_email_sent_at is null`, and `created_at < now() - 24 hours`, call `maybeSendAbandoned`, return `{ nudged: n }`.
   - Keep filtering thin; if a pure helper is needed, add it to `supabase/functions/_shared/orderEmails.ts` with tests.
   - Verify with `mise exec -- npm run test:deno` and preferably `mise exec -- deno check supabase/functions/nudge-abandoned-orders/index.ts`.

2. Task 6: Enable/schedule `pg_cron` and `pg_net`.
   - Depends on Task 4 being implemented and deployed.
   - Add a migration/SQL record for creating extensions and scheduling hourly POST to the deployed function.
   - Apply via Supabase SQL editor or direct `supabase db query --linked`, not `supabase db push`.
   - Verify with `select * from cron.job`.
   - Manually invoke/verify one stale pending order is nudged once and stamped.

3. Task 7: Stripe cutover and final verification.
   - Turn off Stripe dashboard email receipts.
   - Run Stripe CLI scenarios for `payment_intent.succeeded`, `payment_intent.payment_failed`, and partial `charge.refunded`.
   - Confirm no duplicate sends on redelivered events and that `retryUrl`/`resumeUrl` land on `/resume/:draftId`.
   - Run final gate: `npm run lint`, `npm test`, `mise exec -- npm run test:deno`, and `npm run build`.
   - Review changes and open the PR.

## Dead Ends
- `loops agent-context` ran successfully but only returned CLI metadata, not the four transactional template IDs. The user supplied the IDs manually.
- `loops transactional list --output json` failed because no Loops auth profile was stored locally.
- `npm run test:deno` failed initially because `deno` is not on `PATH`; `mise exec -- npm run test:deno` works.
- The first Deno test run needed network/cache access to fetch JSR/esm.sh dependencies; rerunning with approval succeeded.
- `supabase projects list` and Supabase help commands need elevated access in this sandbox because the CLI writes telemetry under `~/.supabase`.
- A Task 4 clone was spawned as required by the plan, but it stayed running through repeated waits, did not respond to an immediate status request, and was shut down without returning changes.

## Open Questions
- None blocking for code. External/manual work remains for Task 6 database scheduling/deployment verification and Task 7 Stripe dashboard receipt settings plus Stripe CLI end-to-end checks.
