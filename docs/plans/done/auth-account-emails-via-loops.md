# Plan: Auth & Account Emails via Loops

## Status

| Task | Description | Assign | Done |
| ---- | ----------- | ------ | ---- |
| 1 | `sendTransactional` returns boolean + add `LOOPS_TEMPLATES` keys | Master | ✅ |
| 2 | `_shared/authEmailHook.ts` handler + tests | Clone | ✅ |
| 3 | `auth-email-hook/index.ts` + `config.toml` wiring | Master | ✅ |
| 4 | `_shared/accountEmails.ts` (welcome + deletion helpers) + tests | Master | ✅ |
| 5 | Wire Welcome guard into `sync-contact` | Clone | ✅ |
| 6 | Wire deletion email into `delete-account` | Clone | ✅ |
| 7 | Document `SEND_EMAIL_HOOK_SECRET` + template contract in AGENTS.md | Master | ✅ |

## Prerequisites

- Design: [docs/designs/auth-account-emails-via-loops.md](../designs/auth-account-emails-via-loops.md)
- Prototype: None (backend/email feature)
- Feature branch `feature/auth-account-emails-via-loops` — already checked out
- **Out of code scope** (manual / external, per design rollout): creating the 4 Loops templates in the dashboard, confirming Loops paid plan, enabling the Supabase hook in staging/prod, disabling Supabase SMTP. Code ships with placeholder template IDs.

## Tasks

### Task 1 [Master]: `sendTransactional` boolean return + template keys

**Skills:** write-tests
**Reference:** Read [`supabase/functions/_shared/loops.ts`](../../supabase/functions/_shared/loops.ts) and [`supabase/functions/_shared/loops.test.ts`](../../supabase/functions/_shared/loops.test.ts)

**In scope:**

- Change `loopsFetch` to return `Promise<boolean>` (true on 2xx, false on non-2xx / network error).
- Change `sendTransactional` to return `Promise<boolean>` — `true` in mock mode after recording; in live mode return what `loopsFetch` returns.
- Populate `LOOPS_TEMPLATES` with the four real Transactional IDs from the Loops dashboard:
  - `confirmEmail`: `cmqxafmpp02ti0jyqdn2x2uqs`
  - `passwordReset`: `cmqxax8oe03760jy233f2si9i`
  - `accountDeletion`: `cmqxbaohm03ky0j015zoo3yh6`
  - `welcome`: `cmqxbdgvz03550jzq4d4g0hcj`
- Update `loops.test.ts`: assert `sendTransactional` returns `true` in mock mode.

**NOT in scope:**

- Changing `upsertContact` / `sendEvent` return types (leave `void`).

**Build order:**

1. **Test:** in `loops.test.ts`, add assertion `assertEquals(await sendTransactional(...), true)` in mock mode.
2. **Implement:** edit `_shared/loops.ts` per above.
3. **Verify:** `npm run test:deno`
4. **Review:** After completion, ALWAYS run review-changes before proceeding. This is not optional.

---

### Task 2 [Clone]: `_shared/authEmailHook.ts` hook handler + tests

**Skills:** write-tests, loops-api
**Reference:** Read [`supabase/functions/stripe-webhook/index.ts`](../../supabase/functions/stripe-webhook/index.ts) (signature-verify-then-200 pattern) and [`supabase/functions/_shared/loops.ts`](../../supabase/functions/_shared/loops.ts)
**Depends on:** Task 1 (template keys + boolean return)

**In scope:**

- New `_shared/authEmailHook.ts` exporting `export async function handleAuthEmailHook(req: Request): Promise<Response>`:
  1. Non-POST → `400`.
  2. Read raw body + headers; verify with `npm:standardwebhooks` `Webhook`. Secret from `SEND_EMAIL_HOOK_SECRET`, stripped of the `v1,whsec_` prefix. Invalid/missing signature → `401`, send nothing.
  3. Parse `{ user, email_data }`. Map `email_action_type`: `signup` → `LOOPS_TEMPLATES.confirmEmail` (var `confirmationUrl`), `recovery` → `LOOPS_TEMPLATES.passwordReset` (var `resetUrl`). Anything else → log warning, `200`, send nothing.
  4. Build URL: `${SUPABASE_URL}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}` (use `Deno.env.get("SUPABASE_URL")`).
  5. `sendTransactional(template, user.email, { [var]: url })`. If it returns `false`, `console.error(...)` — still return `200`.
- New `_shared/authEmailHook.test.ts`: signup→confirm and recovery→reset assert against `mockSentEmails` (construct a validly-signed Request with a known secret via the `Webhook.sign` helper); HMAC reject → `401` (bad signature); unmapped action type → `200` + zero mock calls; URL contains `token_hash`, `type`, and `redirect_to`. Set `SEND_EMAIL_HOOK_SECRET` and `SUPABASE_URL` within the test (save/restore like the existing live-mode test does).

**NOT in scope:**

- `Deno.serve` (Task 3) — this module exports only the handler, no top-level server.
- CORS/OPTIONS handling (server-to-server hook, no browser).
- `email_change`, magic-link, invite, `*_notification` mappings.

**Build order:**

1. **Test:** write `_shared/authEmailHook.test.ts` first.
2. **Implement:** write `_shared/authEmailHook.ts`.
3. **Verify:** `npm run test:deno`
4. **Review:** After completion, ALWAYS run review-changes before proceeding. This is not optional.

---

### Task 3 [Master]: `auth-email-hook` function entry + config.toml

**Reference:** Read [`supabase/functions/sync-contact/index.ts`](../../supabase/functions/sync-contact/index.ts) and [`supabase/config.toml`](../../supabase/config.toml)
**Depends on:** Task 2

**In scope:**

- New `supabase/functions/auth-email-hook/index.ts` — `import { handleAuthEmailHook } from "../_shared/authEmailHook.ts"; Deno.serve(handleAuthEmailHook);`
- `config.toml`: add

  ```toml
  [auth.hook.send_email]
  enabled = true
  uri = "https://uglsyitjasajubfvbiry.supabase.co/functions/v1/auth-email-hook"
  secret = "env(SEND_EMAIL_HOOK_SECRET)"

  [functions.auth-email-hook]
  verify_jwt = false
  ```

**NOT in scope:**

- Hook logic (lives in Task 2's shared module).
- Enabling the hook in the Supabase dashboard / disabling SMTP (manual rollout).

**Build order:**

1. **Test:** covered by Task 2 (handler is unit-tested). No new test.
2. **Implement:** create `index.ts`, edit `config.toml`.
3. **Verify:** `npm run test:deno` (regression) and confirm `config.toml` parses.
4. **Review:** After completion, ALWAYS run review-changes before proceeding. This is not optional.

---

### Task 4 [Master]: `_shared/accountEmails.ts` — welcome + deletion helpers + tests

**Skills:** write-tests
**Reference:** Read [`supabase/functions/_shared/auth.ts`](../../supabase/functions/_shared/auth.ts) (dependency-injection test pattern) and [`supabase/functions/_shared/loops.ts`](../../supabase/functions/_shared/loops.ts)
**Depends on:** Task 1

**In scope:**

- New `_shared/accountEmails.ts`:
  - `maybeSendWelcome(db, user, profile): Promise<boolean>` — if `profile` is null → return `false` (skip). If `profile.welcomed_at` is null → `sendTransactional(LOOPS_TEMPLATES.welcome, user.email, {})`, then `db.from("profiles").update({ welcomed_at: new Date().toISOString() }).eq("id", user.id)`, return `true`. Otherwise return `false`. Welcome sends an empty `dataVariables` object — the dashboard template uses no variables.
  - `sendAccountDeletionEmail(email): Promise<boolean>` — `return sendTransactional(LOOPS_TEMPLATES.accountDeletion, email, {})`. The dashboard template uses no variables.
- New `_shared/accountEmails.test.ts`: welcome sends + records update when `welcomed_at` null (minimal chainable fake `db`); welcome skips when `welcomed_at` set; welcome skips when `profile` null; deletion email records correct template + email.

**NOT in scope:**

- Touching `sync-contact` / `delete-account` index files (Tasks 5/6).
- Re-querying `welcomed_at` inside the helper — the caller passes `profile`.

**Build order:**

1. **Test:** write `_shared/accountEmails.test.ts` first.
2. **Implement:** write `_shared/accountEmails.ts`.
3. **Verify:** `npm run test:deno`
4. **Review:** After completion, ALWAYS run review-changes before proceeding. This is not optional.

---

### Task 5 [Clone]: Wire Welcome guard into `sync-contact`

**Reference:** Read [`supabase/functions/sync-contact/index.ts`](../../supabase/functions/sync-contact/index.ts)
**Depends on:** Task 4

**In scope:**

- Change the existing profiles select from `.select("subscribed")` to `.select("subscribed, welcomed_at")`.
- After the existing `upsertContact` block, call `await maybeSendWelcome(db, user, profile)` inside a try/catch that `console.error`s and never fails the response.
- Import `maybeSendWelcome` from `../_shared/accountEmails.ts`.

**NOT in scope:**

- Client changes (`AuthContext.tsx` already invokes `sync-contact` on `SIGNED_IN`).
- Any change to the contact-property logic.

**Build order:**

1. **Test:** welcome behavior is covered by Task 4's helper tests; no new test (index file untested by convention). Confirm the select string change is correct.
2. **Implement:** edit `sync-contact/index.ts`.
3. **Verify:** `npm run test:deno`
4. **Review:** After completion, ALWAYS run review-changes before proceeding. This is not optional.

---

### Task 6 [Clone]: Wire deletion email into `delete-account`

**Reference:** Read [`supabase/functions/delete-account/index.ts`](../../supabase/functions/delete-account/index.ts)
**Depends on:** Task 4

**In scope:**

- Immediately before `adminClient.auth.admin.deleteUser(user.id)` (while `user.email` is valid), call `await sendAccountDeletionEmail(user.email)` inside a try/catch that `console.error`s and never blocks deletion.
- Import `sendAccountDeletionEmail` from `../_shared/accountEmails.ts`.

**NOT in scope:**

- Reordering existing storage cleanup.
- Changing the delete flow or error handling for `deleteUser`.

**Build order:**

1. **Test:** deletion send covered by Task 4's helper tests; no new test.
2. **Implement:** edit `delete-account/index.ts`.
3. **Verify:** `npm run test:deno`
4. **Review:** After completion, ALWAYS run review-changes before proceeding. This is not optional.

---

### Task 7 [Master]: Document `SEND_EMAIL_HOOK_SECRET` + template contract

**Reference:** Read [`AGENTS.md`](../../AGENTS.md) (env vars section, ~line 30)

**In scope:**

- Add `SEND_EMAIL_HOOK_SECRET` to the server-side secrets section: Standard Webhooks secret (`v1,whsec_…`) from the Supabase Send-Email hook config; set in Supabase Functions → Secrets. Never commit a real value.
- Add a short note documenting the 4 templates + their required variables (`confirmEmail`→`confirmationUrl`, `passwordReset`→`resetUrl`, `accountDeletion`→no variables, `welcome`→no variables) and that IDs are filled into `LOOPS_TEMPLATES`. Note transactional email sends from the `mail.thistlebook.com` subdomain (configured in the Loops dashboard; no code impact).

**NOT in scope:**

- Code changes.

**Build order:**

1. **Implement:** edit `AGENTS.md`.
2. **Verify:** `npm run lint && npm test && npm run test:deno && npm run build` (full green gate before PR).
3. **Review:** After completion, ALWAYS run review-changes before proceeding. This is not optional.

## Task Dependencies

- **Task 1** is the foundation — do it first.
- **Tasks 2 and 4** can run in parallel after Task 1.
- **Task 3** depends on Task 2.
- **Tasks 5 and 6** can run in parallel after Task 4.
- **Task 7** has no code dependency and can run anytime (run its full-suite gate last, before the PR).

## Notes on key decisions

1. **Hook logic lives in `_shared/authEmailHook.ts`, not in the function's `index.ts`.** This is the only way to get the HMAC-reject / mapping / send tests picked up by `npm run test:deno` (it globs `_shared/` only) without starting a real server on import. The `index.ts` is a one-line `Deno.serve(handler)`.
2. **Welcome + deletion email logic consolidated into `_shared/accountEmails.ts`** rather than inline in each function — same testability reason, and keeps the two account-lifecycle sends in one tested place.
3. **Profiles row is guaranteed at first sign-in** by the `on_auth_user_created` trigger ([supabase/migrations/20260610000001_add_auth_ownership.sql](../../supabase/migrations/20260610000001_add_auth_ownership.sql)), so `maybeSendWelcome`'s null-profile path is purely defensive.
