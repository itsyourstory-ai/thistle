> Ticket: THI-9
> Branch: feature/thi-9-cut-over
> Plan created: docs/plans/enable-loops-live-auth-emails.md

# Feature: Cut over auth emails to Loops (live)

## Problem

Confirm-signup and password-reset emails still go out through Supabase's built-in
SMTP. Every other customer email already runs through Loops. This ticket flips the
last two over by enabling Supabase's Send Email hook, and closes a latency hole in
the hook that could take down signup.

## Approach

Enable the Supabase **Send Email hook** pointing at the already-deployed
`auth-email-hook` edge function, ordered so there is **no window** in which the
hook is live but its signing secret is missing. Ship one small hardening fix to the
hook first, then audit the nine emails that have been live and unverified since
June.

### The ticket's premises are stale — corrected state

THI-9 was written assuming almost nothing was configured. Verified state as of
2026-08-01:

| Precondition | Ticket assumed | Actual |
|---|---|---|
| Loops paid plan required | Blocker | **No longer true** — free plan includes transactional sending |
| `LOOPS_API_KEY` | Needs setting | **Set** (2026-06-26) |
| `LOOPS_TRANSPORT` | Needs setting to `live` | **Already `live`** (2026-06-26) |
| `SEND_EMAIL_HOOK_SECRET` | Needs setting | **Absent** — the only missing piece |
| Sending domain verified | Needs checking | **Verified** (`mail.thistlebook.com`) |
| 11 Loops templates | Need wiring | **All published**, IDs and `dataVariables` match `LOOPS_TEMPLATES` |
| Staging → production rollout | Two projects | **One project** (`uglsyitjasajubfvbiry`) — staged rollout is impossible |

`LOOPS_TRANSPORT` was confirmed as `live` by hashing candidate values against the
digest returned by `supabase secrets list --project-ref uglsyitjasajubfvbiry`
(`sha256("live")` = `247610f4…`, an exact match).

**Consequence:** nine of eleven emails have been sending for real since late June.
Only `confirmEmail` and `passwordReset` remain on Supabase SMTP, because they are
the two driven by the not-yet-enabled hook.

### Loops plan decision

Stay on the **free plan** (1,000 subscribed contacts, 4,000 sends/month, 10/sec,
"Powered by Loops" footer). Upgrade later if volume demands it. See the audit —
the trigger to upgrade is silent send rejection, not a bill.

### Why there is no staging environment for this

`main` auto-deploys to Vercel staging and is promoted manually to production, but
that split is **frontend-only**. Both Vercel environments read the same
`VITE_SUPABASE_URL`. Auth emails are sent by Supabase when the hook fires — Vercel
is not in that path. Signing up via Vercel staging creates a real user in the one
real auth database and fires the one real hook. Isolation comes from the signed
pre-flight request (step 4 below), not from an environment.

## Acceptance Criteria

- A new signup receives the Loops "Confirm your email" template and the link
  verifies the account.
- A password reset receives the Loops "Password reset" template and the link works.
- No signup or password-reset outage occurs during the cutover.
- `auth-email-hook` returns 200 without waiting on the Loops API.
- The audit reports stamp-gap counts, Loops delivery/bounce rates, and free-plan
  cap headroom, with an explicit backfill decision recorded.
- `npm run lint`, `npm test`, `npm run test:deno`, and `npm run build` all green.

## Prototype

None — backend/ops change, no UI.

## Data Model

No schema changes. The audit reads existing columns:

- `orders.receipt_email_sent_at`, `payment_failed_email_sent_at`,
  `refund_email_sent_at`, `abandoned_email_sent_at`
- `generated_books.creating_email_sent_at`, `ready_email_sent_at`,
  `failed_email_sent_at`
- `profiles.welcomed_at`

Each stamp is written **only after** `sendTransactional` returns true
(`orderEmails.ts:127-131`, `bookEmails.ts:66-71`), so a missing stamp on an
eligible row means the send failed silently.

## Screens / Flows

### 1. Code fix — remove Loops latency from the auth path

Supabase caps auth hooks at **5 seconds total**, and there is **no fallback to
built-in SMTP**: a hook failure fails the auth request itself with a 500.
`authEmailHook.ts:58` currently `await`s the Loops call inside that budget. TIC-28
guarded against Loops *erroring* (returns 200 on a falsy send) but not against
Loops being *slow*.

Replace the awaited send with a background task:

```ts
const sendPromise = sendTransactional(templateId, user.email, { [varName]: url })
  .then((sent) => {
    if (!sent) console.error("[auth-email-hook] sendTransactional failed for", user.email);
  })
  .catch((err) => {
    console.error("[auth-email-hook] sendTransactional threw for", user.email, err);
  });

// AIDEV-NOTE: Supabase caps auth hooks at 5s total and a blown budget fails the
// signup itself, not just the email. Loops latency must never enter that budget.
// EdgeRuntime is absent under plain `deno test`, so await there to keep tests
// deterministic.
if (typeof EdgeRuntime !== "undefined") {
  EdgeRuntime.waitUntil(sendPromise);
} else {
  await sendPromise;
}

return new Response("OK", { status: 200 });
```

The `.catch` also closes a latent hole: `sendTransactional` **throws** on a missing
`LOOPS_API_KEY` (`loops.ts:46`), and that throw currently escapes the handler and
would 500 the signup.

All five tests in `authEmailHook.test.ts` pass unchanged — they await the handler,
and the `else` branch awaits the send, so `mockSentEmails` is populated on
assertion. Needs a `declare` for `EdgeRuntime` to satisfy TypeScript.

### 2. Config fix

`supabase/config.toml:39` uses `secret = "env(SEND_EMAIL_HOOK_SECRET)"` (singular).
Supabase documents the key as **`secrets`** (plural, comma-separated base64 to
support rotation). Harmless today because `config.toml` governs local dev and the
dashboard is authoritative for the hosted project — but the file currently
misdescribes production and would silently fail under `supabase config push`.

### 3. Cutover runbook

The dashboard's **Generate Secret** button populates the form field without
activating the hook, which is what makes a zero-downtime ordering possible.

1. Merge and deploy the code fix — `supabase functions deploy auth-email-hook`.
2. Dashboard → **Authentication → Hooks → Send Email hook**. Set URI to
   `https://uglsyitjasajubfvbiry.supabase.co/functions/v1/auth-email-hook`.
   Click **Generate Secret**, copy the `v1,whsec_…` value. **Do not save yet.**
3. Dashboard → **Functions → Secrets**. Set `SEND_EMAIL_HOOK_SECRET` to that value.
4. **Pre-flight, hook still disabled.** POST a Standard-Webhooks-signed `signup`
   payload to the deployed function using a throwaway address. Expect `200` and a
   real "Confirm your email" to arrive. A `401` means the secret has not propagated
   — wait and retry. This proves both secret propagation and the Loops leg with
   zero blast radius. *The link in this email will be dead (fabricated
   `token_hash`) — expected; this step tests delivery, not verification.*
5. Return to Auth → Hooks and **save/enable**.
6. Verify for real: sign up a throwaway account end-to-end and confirm the link
   verifies; request a password reset and confirm that link works.
7. Delete the test users — which also exercises the account-deletion email.

**Fallback:** if Generate Secret turns out to activate the hook immediately rather
than on save, the exposure is a copy-paste. Do steps 2–3 back to back at a
low-traffic hour with Functions → Secrets already open in a second tab, and run the
pre-flight afterward instead of before.

### 4. Audit of the nine already-live emails

Timeline — `LOOPS_TRANSPORT` went live 2026-06-26, but senders shipped after it:

| Emails | Live since |
|---|---|
| Welcome, Account deleted | 2026-06-26 |
| Order receipt, Payment failed, Refund, Abandoned checkout | 2026-06-29 |
| Book creating / ready / failed | 2026-07-01 |

**Part A — DB stamp gaps.** Count eligible rows with no stamp; each is an email a
customer should have received and did not:

- paid orders with `receipt_email_sent_at IS NULL`
- refunded orders with `refund_email_sent_at IS NULL`
- completed books with `ready_email_sent_at IS NULL`
- failed books with `failed_email_sent_at IS NULL`
- signed-in users with `welcomed_at IS NULL`

Count rows with null `buyer_email` separately — the code warns and skips those
(`orderEmails.ts:118-122`, `bookEmails.ts:51-56`), which distinguishes "couldn't"
from "tried and failed".

**Part B — Loops-side delivery.** Stamps prove Loops *accepted* a payload, not that
it *delivered*. Manually review the Loops dashboard's transactional analytics for
the `mail.thistlebook.com` group: delivery and bounce rates per template over the
window.

**Part C — free-plan cap headroom (highest priority).** `sync-contact` calls
`upsertContact` on every sign-in, so contacts accumulate with signups. If the
1,000-contact or 4,000-send/month cap was ever crossed, Loops rejected sends — and
every rejection path here is silent (`loops.ts:66-71` logs and returns false;
`maybeSend*` returns false without stamping). Check current contact count and
month-to-date volume against both caps.

**Output:** findings recorded with counts per gap, cap headroom, and an explicit
decision on backfilling missed sends. Default recommendation: **do not backfill**
— a five-week-late receipt likely confuses more than it helps. Jordan's call.

## Edge cases

| Case | Behaviour after cutover |
|---|---|
| Bad/missing HMAC | 401 → **the signup/reset itself fails**, not just the email |
| Loops slow or down | 200 immediately, email lost, auth unaffected (fixed above) |
| `sendTransactional` throws | Caught, logged, 200 (fixed above) |
| Unmapped action type | 200, no email — only reachable if a new auth flow is added |
| Free-plan cap exceeded | Send rejected, logged, **silent** — no safety net |
| Password change | Supabase may emit `password_changed_notification` → unmapped → no email. Deferred by TIC-28; watch post-cutover |

**Auth surface is confirmed narrow.** The app uses `signUp`, `signInWithPassword`,
`signInWithOAuth` (Google), `resetPasswordForEmail`, `signOut`, and
`updateUser({ password })` only. `Account.tsx:82` is password-change only — there is
no email-change flow, so TIC-28's deferral still holds. No magic link, no invites.
Only `signup` and `recovery` produce emails, and both are mapped.

**Secret rotation is now dangerous.** TIC-28 treated the 401 path as "reject
unsigned requests, send nothing" — safe while the hook was off. Once the hook is
authoritative, a signature mismatch is a hard auth outage: nobody can sign up or
reset until it is fixed. Rotating `SEND_EMAIL_HOOK_SECRET` naively creates exactly
that window. Supabase's `secrets` key accepts comma-separated values specifically
to allow gapless rotation — use it. Not work for this ticket; recorded so it is not
learned the hard way.

## Rollback

**Disable the Send Email hook** in the dashboard. Confirm/reset revert to Supabase's
built-in SMTP instantly. Nothing else to undo.

Caveat to verify during execution: Supabase's built-in SMTP is rate-limited and
documented as not for production use. Rollback restores *function*, possibly at a
throttled rate — a working fallback, not a like-for-like one.

### Do NOT set `LOOPS_TRANSPORT=mock`

THI-9's text recommends this as an optional extra rollback step. **That advice is
actively harmful now.** It was written when nothing was live. Today it would
silently disable the nine working emails — receipts, refunds, book-ready — with
`loops.ts:80-83` returning `true` and discarding each one. No error, no bounce, no
visible difference to a customer waiting on a receipt. The hook toggle is the only
rollback needed, and it is precisely scoped to the two emails this ticket changes.

## Scope

**In:**
- `EdgeRuntime.waitUntil` + `.catch` hardening in `_shared/authEmailHook.ts`.
- `config.toml` `secret` → `secrets`.
- Cutover runbook executed against `uglsyitjasajubfvbiry` (steps 1–7).
- Audit parts A, B, C with findings and a backfill decision.
- Rollback, `LOOPS_TRANSPORT=mock` warning, and secret-rotation note documented.

**Deferred:**
- Loops paid plan upgrade — free plan until volume requires it.
- Backfilling any missed sends found by the audit — decide after seeing counts.
- Gapless secret rotation via comma-separated `secrets` — documented, not built.
- `password_changed_notification` and email-change templates — still unused flows.
- A real staging Supabase project — real work, not justified by this ticket alone.

## Open Questions

- Does **Generate Secret** activate the hook immediately or only on save? Determines
  whether the zero-downtime ordering holds or the fallback applies. Resolve by
  observation at execution time.
- What is Supabase's current built-in SMTP rate limit? Determines how good the
  rollback actually is.
- DB access for the audit queries is not yet established — production was
  deliberately not queried during design.

## More Info

### Verification commands

```bash
# Function secret names + digests (values are SHA-256, not plaintext)
supabase secrets list --project-ref uglsyitjasajubfvbiry

# Confirm a secret's value by hashing a guess
printf '%s' live | shasum -a 256

# Loops templates for this account (CLI defaults to the `cove-production`
# profile — `--team thistle` is required)
loops --team thistle transactional list -o json
```

### Loops free plan limits

1,000 subscribed contacts · 4,000 sends/month · 10 emails/sec · "Powered by Loops"
footer. All features otherwise included; no separate transactional charge.

### Supabase auth hook behaviour

5-second total budget including retries. Retries only on `429`/`503`, up to three
with 2s backoff. `400` and `403` are translated to a 500. **No fallback to default
behaviour** — hook failure fails the auth request.
