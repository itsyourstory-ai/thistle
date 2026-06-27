# Feature: Auth & account emails via Loops

> Notion ticket: [TIC-28 — Auth & account emails via Loops](https://app.notion.com/p/3840fc47bb8b81fab766da4685212b1d)
> Part of epic **All email via Loops** (TIC-17). Ticket 2 of 5. Depends on TIC-27 (Ticket 1) infrastructure, which is already merged.

## Problem

Supabase's built-in SMTP currently sends all auth email (confirm signup, password
reset). We want every auth and account-lifecycle email to go through Loops instead,
so all customer email lives in one platform with consistent branding and tracking.

## Approach

Add a public `auth-email-hook` edge function wired to Supabase's **Send Email hook**.
When Supabase needs to send an auth email it POSTs a signed payload to the hook; the
hook verifies the signature, maps `email_action_type` → a Loops transactional
template, builds the verification URL, and calls `sendTransactional` (the
`_shared/loops.ts` helper from Ticket 1). Two non-hook emails (Welcome, Account
deleted) are sent directly from existing functions.

Enabling the hook **replaces** Supabase's built-in SMTP — they are mutually
exclusive, not additive. This drives the staged rollout below.

### Key decisions

- **Hook failure mode:** only a bad/missing HMAC signature returns `401`. A Loops
  send failure is logged and returns `200` — auth must never break because a
  third-party email provider is down. The user can always re-trigger
  resend-confirmation / forgot-password. This deviates from Supabase's example code,
  which `throw`s (and thereby blocks auth) on send failure.
  - Requires a small backward-compatible change: `sendTransactional` in
    `_shared/loops.ts` should **return a boolean** so the hook can log a real error
    on failure (today it returns `void` and swallows everything).
- **Verify URL base is `SUPABASE_URL`**, not `site_url`:
  `${SUPABASE_URL}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`.
  `redirect_to` is the app destination *after* verification (existing `/dashboard`
  for signup, `/account` for reset).
- **Templates created in the Loops dashboard** (by Jordan), not scripted. Code ships
  with named placeholders in `LOOPS_TEMPLATES` and a documented variable contract.
- **Welcome fires for everyone** (password + Google OAuth) on first sign-in, guarded
  once by `profiles.welcomed_at`. Password users therefore receive confirm + welcome
  back-to-back; this is intended.

## Acceptance Criteria

- The Send-Email hook fires the Loops helper for each mapped auth event
  (`signup` → confirm, `recovery` → reset), asserted with the mock transport in tests.
- Account-deletion and Welcome emails are sent from their respective functions,
  mock-asserted.
- HMAC signature verification rejects unsigned/invalid requests (`401`); valid
  requests with unmapped action types return `200` and send nothing.
- Supabase's own auth emails are disabled **only after** staging verification.
- `npm run lint`, `npm test`, `npm run test:deno`, and `npm run build` all green.

## Prototype

None — backend/email feature, no UI.

## Data Model

No new tables or columns. Uses the existing `profiles.welcomed_at timestamptz`
(added in migration `20260620000001_add_profile_welcomed_subscribed.sql`,
currently unused) as the once-only Welcome guard.

## Screens / Flows

This is a backend feature; "flows" are email-trigger paths.

### New: `auth-email-hook` edge function

1. Reject non-POST → `400`.
2. Read the raw body + headers; verify the Standard Webhooks signature using the
   `standardwebhooks` `Webhook` class with `SEND_EMAIL_HOOK_SECRET` (strip the
   `v1,whsec_` prefix). Invalid → `401`.
3. Parse `{ user, email_data }`. Map `email_action_type`:

   | action_type | Template | Variable | Notes |
   |---|---|---|---|
   | `signup` | Confirm your email | `confirmationUrl` | |
   | `recovery` | Password reset | `resetUrl` | |
   | anything else | — | — | log warning, `200`, send nothing |

4. Build the URL from `SUPABASE_URL` (see Key decisions).
5. `sendTransactional(LOOPS_TEMPLATES[...], user.email, { confirmationUrl | resetUrl })`.
   On failure: log error, still return `200`.

### Touched: `delete-account`

Before `adminClient.auth.admin.deleteUser(user.id)` (while `user.email` is still
valid), call
`sendTransactional(LOOPS_TEMPLATES.accountDeletion, user.email, { deletedAt: new Date().toISOString() })`.
Best-effort; never block deletion.

### Touched: `sync-contact`

After the existing `upsertContact`, add the Welcome guard:
1. Extend the existing `profiles` select to also read `welcomed_at`.
2. If `welcomed_at` is null:
   - `sendTransactional(LOOPS_TEMPLATES.welcome, user.email, { ...safe vars })`
   - `UPDATE profiles SET welcomed_at = now()`.
3. If the `profiles` row is missing, skip the Welcome (treat as not-yet-welcomable).

`sync-contact` is invoked client-side once per user on `SIGNED_IN`
(`src/contexts/AuthContext.tsx`), so the Welcome lands on first sign-in.

### Config: `supabase/config.toml`

```toml
[auth.hook.send_email]
enabled = true
uri = "https://<project-ref>.supabase.co/functions/v1/auth-email-hook"
secret = "env(SEND_EMAIL_HOOK_SECRET)"

[functions.auth-email-hook]
verify_jwt = false
```

### The 4 Loops templates (created in dashboard, IDs filled into `LOOPS_TEMPLATES`)

| Template | Required variable(s) | Recipient | From / reply |
|---|---|---|---|
| Confirm your email | `confirmationUrl` | account email | `notify@thistlebook.com` |
| Password reset | `resetUrl` | account email | `notify@thistlebook.com` |
| Account deleted | `deletedAt` | account email | `notify@thistlebook.com` |
| Welcome | safe always-present vars only (e.g. `firstName`) | account email | `notify@thistlebook.com` |

Sender/reply convention: `notify@thistlebook.com` for transactional/account email;
`support@thistlebook.com` only for user-initiated support; `hello@thistlebook.com`
as the general inbox.

## Edge cases

- **Bad/missing HMAC signature** → `401`, send nothing.
- **Unmapped `email_action_type`** (magic link, invite, email_change, `*_notification`)
  → `200`, send nothing, log a warning.
- **Loops send fails** → log error, return `200`; auth proceeds.
- **Welcome double-fire** (sync-contact runs twice) → `welcomed_at` guard +
  post-send `UPDATE` make it once-only.
- **`profiles` row missing** at first sign-in → skip Welcome rather than error.
  (Confirm during planning whether a profile row is guaranteed to exist by first
  sign-in.)
- **Account-deletion email fails** → swallow; deletion still succeeds.

## Scope

**In:**
- `auth-email-hook` edge function (HMAC verify, action-type mapping, URL build, send).
- `config.toml` `[auth.hook.send_email]` + `[functions.auth-email-hook] verify_jwt = false`.
- `sendTransactional` returns a success boolean.
- Welcome guard in `sync-contact`; account-deletion send in `delete-account`.
- 4 Loops templates created in dashboard; IDs wired into `LOOPS_TEMPLATES`.
- Deno tests: mapping, URL construction, HMAC reject, welcome-once guard,
  deletion send.
- New secret `SEND_EMAIL_HOOK_SECRET` documented in AGENTS.md env section.

**Deferred:**
- **Email-change confirmation** template — `Account.tsx` exposes no email-change
  flow today (only password change). Revisit when email-change ships.
- **`password_changed_notification`** email — Account.tsx *does* have a
  password-change flow, so this is a natural follow-up, but out of scope here.
- **Magic-link / invite** templates — app doesn't use these flows.

## Open Questions

None blocking the PR. Two items are intentionally **outside this PR**, gated on
external state:
- **Loops paid plan** — transactional sending is paid-only. Code + templates can
  land first; do not flip the production hook until the plan is active.
- **Production hook enable** — the final, reversible step, done after staging
  verification. Rollback = disable the hook (reverts to Supabase SMTP).

## More Info

### Safe rollout sequence
1. Build + deploy `auth-email-hook`; create the 4 templates in Loops.
2. Enable the hook **in staging only**; verify signup, reset, delete, and welcome
   all actually send.
3. Confirm Loops is on a **paid plan**.
4. Enable the hook in production. Rollback = disable the hook (instant revert to
   Supabase SMTP).

### Send Email hook payload (verified against Supabase docs)
`{ user: { email, ... }, email_data: { token, token_hash, redirect_to,
email_action_type, site_url, token_new, token_hash_new, ... } }`, signed with
Standard Webhooks headers (`webhook-id`, `webhook-timestamp`, `webhook-signature`).
Verify with `npm:standardwebhooks` and the `v1,whsec_`-prefixed secret.
