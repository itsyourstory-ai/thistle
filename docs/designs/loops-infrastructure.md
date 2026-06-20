# Feature: Loops email infrastructure + contact sync (TIC-27)

> Plan created: docs/plans/loops-infrastructure.md

Notion ticket: https://app.notion.com/p/Loops-email-infrastructure-contact-sync-3840fc47bb8b81a9bd21c0d35466c4cf

**Ticket 1 of 5** — epic: *All email via Loops — transactional, auth & marketing* (TIC-17). This is the foundation that TIC-28–31 import from. **Nothing here sends real customer email.**

## Problem

The app has no email infrastructure. AI generation, Stripe checkout, and auth all produce lifecycle moments that need transactional email (receipts, "book ready", welcome, etc.), but there is no email provider, no shared sending helper, and no way to manage contacts or marketing opt-in. All of that is missing.

## Approach

Stand up [Loops](https://loops.so/) as the email provider. Ship a reusable server-side helper (`_shared/loops.ts`) with a **swappable transport** so it sends nothing during tests, and a `sync-contact` edge function so every signed-in user is upserted as a Loops contact. Wire the sync from `AuthContext` on sign-in.

- **Mock transport by default.** `LOOPS_TRANSPORT=mock` records payloads to an in-memory array; `live` calls the real Loops API. Dev, CI, and tests always run on `mock` — no live key needed, no accidental sends.
- **Best-effort / non-blocking.** A failed Loops call never fails or rolls back the auth flow, webhook, or generation. Log and continue.
- **Server-side only.** `LOOPS_API_KEY` is a Supabase function secret; it never appears in the client bundle.
- **Contact properties derived server-side.** `sync-contact` reads `profiles`, `orders` (latest paid), and `generated_books.brief` (latest) — the client just fires a no-body invoke.
- **Template IDs centralized.** An exported `LOOPS_TEMPLATES` constant map in `loops.ts` is the single source of truth for template IDs. No inline literals anywhere (TIC-28–31 populate it).

## Acceptance Criteria

- `npm run test:deno` is green; mock-transport payloads are asserted in `loops.test.ts`.
- A new sign-in fires `sync-contact` and upserts a Loops contact (mocked in CI; verified against the live API once a key exists).
- `LOOPS_API_KEY` is absent from the client bundle (`grep dist/`).
- `LOOPS_TRANSPORT=mock` is enforced for all automated test runs; a stray live key in the environment can't send during tests.
- `npm run lint && npm test && npm run build` all green.

## Cross-cutting email rules (inherited by TIC-28–31)

1. **Best-effort / non-blocking** — a failed Loops call must never fail or roll back the calling flow. Log `console.error` and continue.
2. **At-least-once for money/lifecycle email** — guard each important send on a per-row timestamp column set *after* a successful send (e.g. `profiles.welcomed_at`), not on the Stripe event ledger alone.
3. **Recipient policy** — order-tied email → `orders.buyer_email`; auth/lifecycle email → account email.
4. **Transactional ignores `subscribed`; only marketing (TIC-31) respects it.**

## Data Model

### `public.profiles` — two new columns

| Column | Type | Notes |
|---|---|---|
| `welcomed_at` | `timestamptz` null | Set after a successful welcome email (at-least-once guard). Ticket 2 reads this. |
| `subscribed` | `boolean` not null default `true` | Marketing opt-in mirror. Ticket 5 reads this. |

Migration: `20260620000001_add_profile_welcomed_subscribed.sql`. Inherits existing RLS and grants (users can read + update own profile row). No new policies needed.

## Edge Function: `sync-contact`

Service-role, idempotent, best-effort.

**Auth:** `requireAuthedUser(req)` from `_shared/auth.ts` — 401 if no valid JWT.

**Properties synced to Loops:**

| Property | Source |
|---|---|
| `email` | `user.email` |
| `userId` | `user.id` |
| `signupSource` | `user.app_metadata.provider` → `"google" \| "password"` |
| `createdAt` | `user.created_at` |
| `subscribed` | `profiles.subscribed` |
| `childName` | `generated_books.brief.childName` (latest, best-effort) |
| `occasion` | `generated_books.brief.occasion` (latest, best-effort) |
| `artStyle` | `generated_books.brief.artStyle` (latest, best-effort) |
| `lastPurchaseProduct` | `orders.product` (latest paid, best-effort) |

All DB reads use `createServiceRoleClient()`. A missing row for any optional prop is silently ignored.

## Shared Helper: `_shared/loops.ts`

Mirrors `stripe.ts` style (header comment, named exports, exported constant map). Network + env pattern follows `googleAuth.ts`.

### Exports

```
LOOPS_TEMPLATES               // Record<string, string> — template ID registry
sendTransactional(templateId, email, dataVariables)
upsertContact(email, properties)
sendEvent(email, eventName, properties)
mockSentEmails                // LoopsRecordedCall[] — readable in tests; only populated on mock transport
__resetLoopsMock()            // Clears mockSentEmails; call at top of each test
```

### Transport selection

`Deno.env.get("LOOPS_TRANSPORT")`:
- `"live"` → real Loops API calls; `LOOPS_API_KEY` required (throws if missing).
- anything else (unset / `"mock"`) → records to `mockSentEmails`, sends nothing.

### Loops API endpoints (live transport)

- `POST https://app.loops.so/api/v1/transactional` — `sendTransactional`
- `POST https://app.loops.so/api/v1/contacts/update` — `upsertContact`
- `POST https://app.loops.so/api/v1/events/send` — `sendEvent`

All calls include `Authorization: Bearer <LOOPS_API_KEY>`. Non-2xx responses log a warning and resolve (best-effort, non-throwing).

## Client Wiring: `AuthContext.tsx`

Inside `onAuthStateChange((event, nextSession) => …)`:
- On `event === "SIGNED_IN"` only (not `TOKEN_REFRESHED` / `INITIAL_SESSION`).
- Deferred via `setTimeout(() => …, 0)` to avoid the Supabase auth-lock deadlock from awaiting inside the callback.
- De-duped with a `lastSyncedUserId` ref so the same user can't hammer the function on repeated sign-in events.
- Fire-and-forget; errors are swallowed (best-effort).
- The `isDevAuthBypass()` early-return path is untouched — no real events fire there.

```ts
// rough shape — exact implementation may vary
if (event === "SIGNED_IN" && nextSession?.user.id !== lastSyncedUserId.current) {
  lastSyncedUserId.current = nextSession?.user.id ?? null;
  setTimeout(() => {
    supabase.functions.invoke("sync-contact").catch(console.error);
  }, 0);
}
```

## Environment + Test Forcing

| Var | Where set | Notes |
|---|---|---|
| `LOOPS_API_KEY` | `supabase/.env` (local), Supabase secrets (deployed), Vercel (all envs) | Server-side only — never `VITE_`-prefixed |
| `LOOPS_TRANSPORT` | Same + hardcoded `mock` in tests | `"live"` or `"mock"` (default). Set to `mock` in `test:deno` script prefix and `setup.ts` |

- **`package.json` `test:deno` script** prefixed with `LOOPS_TRANSPORT=mock` so a stray key in the shell can't send: `LOOPS_TRANSPORT=mock deno test --allow-env supabase/functions/_shared/`
- **`src/test/setup.ts`**: `import.meta.env.LOOPS_TRANSPORT = "mock";` next to the existing `VITE_DEV_AUTH_BYPASS` line (defensive).
- **`.env.example`**: add `LOOPS_API_KEY=` and `LOOPS_TRANSPORT=mock` with comments.
- **`CLAUDE.md` "Required env vars"**: document both (note: server-side / edge-function secrets).
- Setting live secrets in Supabase dashboard and Vercel is a **manual step** once a real key exists.

## Files Touched

- `supabase/functions/_shared/loops.ts` (new)
- `supabase/functions/_shared/loops.test.ts` (new)
- `supabase/functions/sync-contact/index.ts` (new)
- `supabase/migrations/20260620000001_add_profile_welcomed_subscribed.sql` (new)
- `src/contexts/AuthContext.tsx`
- `src/test/setup.ts`
- `package.json`
- `.env.example`
- `CLAUDE.md`
- `supabase/config.toml` (verify — add `sync-contact` if functions are enumerated)

## Scope

**In:**
- `_shared/loops.ts` helper + tests.
- `sync-contact` edge function.
- `profiles` migration (two columns).
- `AuthContext` wiring.
- Env / test-forcing / docs.
- Cross-cutting email rules as defined above.

**Deferred (TIC-28–31):**
- Welcome email (Ticket 2).
- Order receipt email (Ticket 3).
- "Book ready" email (Ticket 4).
- Marketing list management (Ticket 5).
- Any real `LOOPS_TEMPLATES` IDs (added by Tickets 2–5 as needed).
