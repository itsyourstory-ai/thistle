# Feature: Book generation lifecycle emails via Loops (TIC-30)

> Plan created: docs/plans/book-generation-lifecycle-emails.md

Notion ticket: https://app.notion.com/p/3840fc47bb8b811982a8e593b25b9bb8

> Part of epic **All email via Loops** (TIC-17). Ticket 4 of 5. Depends on TIC-27
> (Ticket 1, Loops transport) and stable AI book generation. Independent of Tickets 2, 3, 5.
> Spawns two follow-up tickets: [TIC-41](https://app.notion.com/p/3900fc47bb8b813eb1cbde2b85a67be8)
> (customer `/book/:id` preview route) and
> [TIC-42](https://app.notion.com/p/3900fc47bb8b815ab1ede587815fe9b3) (digital delivery & download).

## Problem

Once a buyer has paid, the book runs through an asynchronous, multi-minute generation
pipeline (`generate-book` → `generate-book-images`) and the buyer hears **nothing** until
they happen to check the app. There is no "we're creating your book," no "it's ready," and
no "something went wrong" email. The **"your book is ready to preview"** email is the
flagship of the whole epic — it's the moment that pulls the buyer back to see (and share)
the finished product.

For: a buyer who has paid for a personalized children's book and is waiting on generation.

## Approach

Wire Loops transactional sends into the existing generation pipeline's `pipeline_status`
transitions, mirroring the Ticket 3 (`orderEmails.ts`) pattern exactly. A new pure,
Deno-testable helper `_shared/bookEmails.ts` maps a `generated_books` row + a lifecycle
state to a `maybeSend…` that: checks the relevant per-book `*_email_sent_at` stamp → skips
if set → otherwise `sendTransactional(...)` via the existing `_shared/loops.ts`
(mock/live transport) → stamps the column on success.

Idempotency is **essential here, not optional**: `generate-book-images` self-chains and
retries across many invocations, and `failed` can be reached from several code paths. The
per-book stamp guarantees each of the three emails sends at most once per book.

Recipient and personalization are read **off the `generated_books` row itself** — its
`buyer_email` (stamped at stub insert from the brief) and `brief.child.name` — rather than
joining `orders`. Same value, already on the row being updated, and it still works in the
dev `bypass_checkout` path where no order exists.

### Decisions made during brainstorming

- **`previewUrl` → `${APP_BASE_URL}/dashboard`** for now. There is no customer-facing book
  view today (only the dev-only `/dev/story-preview/:id`, which must not be linked from
  email). `/dashboard` is real and authed. A dedicated `/book/:id` viewer is split into
  **[TIC-41]**, which repoints `previewUrl` when it lands (a one-line change).
- **Digital delivered / download email is deferred** to **[TIC-42]** — no buyer-facing
  download flow exists (exports go to the team's Drive). For digital orders the "ready to
  preview" email covers the notification need for now.
- **Recipient + `childName` from the `generated_books` row**, not an `orders` join.
- **Stamps live on `generated_books`** (generation is book-scoped; the image function
  self-chains repeatedly).
- **`etaText`** → fixed copy string (e.g. "about 5–10 minutes"), not computed.
- **`supportUrl`** → `mailto:support@thistlebook.com` (matches the epic's sender policy:
  `support@` for user-initiated support).
- **`failed` then manual retry then `done`** would send both a failed and a ready email —
  accepted. Both are truthful and the case is rare; no suppression logic.

## Acceptance Criteria

- `generate-book` starting a generation fires **exactly one** "we're creating your book"
  send to `generated_books.buyer_email` (mock-asserted) with `childName`, `etaText`.
- `generate-book-images` reaching terminal `pipeline_status:"done"` fires **exactly one**
  "your book is ready to preview" send with `childName`, `previewUrl` (a real authed route),
  `bookId`.
- Any `pipeline_status:"failed"` transition (in either function, from any of its failure
  paths) fires **exactly one** "generation failed / delayed" send with `childName`,
  `supportUrl`.
- Self-chaining / retried invocations of `generate-book-images` do **not** produce duplicate
  sends (per-book stamp), but still send if a prior attempt never completed (at-least-once).
- A book with a null `buyer_email` skips the send and logs (can't email without a recipient).
- `npm run lint && npm test && npm run test:deno && npm run build` all green.

## Prototype

None. No new customer-facing screens (the `/book/:id` viewer is deferred to TIC-41; this
ticket links the "ready" email at the existing `/dashboard`). Email visual design lives in
Loops templates, not in code.

## Data Model

One migration adding columns to the existing `generated_books` table (no new tables):

| Column | Type | Notes |
|---|---|---|
| `creating_email_sent_at` | timestamptz null | stamped after a successful "creating" send |
| `ready_email_sent_at` | timestamptz null | stamped after a successful "ready to preview" send |
| `failed_email_sent_at` | timestamptz null | stamped after a successful "failed / delayed" send |

- No new GRANTs/RLS needed: `generated_books` is already `service_role`-write,
  `authenticated`-read-own; these columns inherit that. (`buyer_email`/`buyer_name` remain
  revoked from client SELECT.)

## Screens / Flows

### Email triggers

| Email | Trigger | Recipient | Vars |
|---|---|---|---|
| We're creating your book | `generate-book` stub insert (`pipeline_status:"story"`) | `generated_books.buyer_email` | `childName`, `etaText` |
| **Your book is ready to preview** | `generate-book-images` terminal `pipeline_status:"done"` | `generated_books.buyer_email` | `childName`, `previewUrl`, `bookId` |
| Generation failed / delayed | any `pipeline_status:"failed"` update in **both** functions | `generated_books.buyer_email` | `childName`, `supportUrl` |

Three new template IDs added to `LOOPS_TEMPLATES` in `_shared/loops.ts`. Run
`loops agent-context` at implementation time to obtain/confirm the IDs. Sender stays
`notify@thistlebook.com` (transactional/system/product) — Loops-side config, no code impact.

### Decision helper — `_shared/bookEmails.ts` (new)

Pure, Deno-testable; mirrors `orderEmails.ts`. Given a `generated_books` row it resolves
`childName` from `brief.child.name` and recipient from `buyer_email`, and exposes
`maybeSendCreating` / `maybeSendReady` / `maybeSendFailed`, each of which: checks the
relevant `*_email_sent_at` stamp → skips if set or if `buyer_email` is null → otherwise
`sendTransactional(...)` → stamps the column on success. Keeps both edge functions thin and
unit-testable against the Loops mock.

### Edge function changes

- **`generate-book`** (modify): after the stub row is inserted with `pipeline_status:"story"`,
  call `maybeSendCreating`. In the background-work `catch` that sets `pipeline_status:"failed"`,
  call `maybeSendFailed`.
- **`generate-book-images`** (modify): at the terminal `setPipeline(..., "done")`, call
  `maybeSendReady`. At **each** `pipeline_status:"failed"` update (verification failure, the
  outer `catch`, and any other failure path), call `maybeSendFailed`. The per-book stamp
  makes the repeated failed-path calls safe.

### `previewUrl`

`${APP_BASE_URL}/dashboard` for this ticket. TIC-41 introduces `/book/:id` and changes this
single value to `${APP_BASE_URL}/book/${bookId}`.

## Edge cases

- **`generate-book-images` self-chain / retry** — the terminal `done` and each `failed`
  path may be hit across multiple invocations; the `ready_/failed_email_sent_at` stamp
  guarantees at-most-once per book.
- **Multiple distinct failure paths** — all funnel through `maybeSendFailed`, guarded by the
  single `failed_email_sent_at` stamp, so a book that trips two failure branches still emails
  once.
- **`failed` → manual retry → `done`** — sends both a failed and a ready email. Accepted for
  v1; both are accurate. (Revisit only if it proves confusing.)
- **Null `buyer_email`** (e.g. dev `bypass_checkout` with no buyer captured) — skip the send
  and log; can't email without a recipient.
- **Send fails (non-2xx / network)** — `sendTransactional` resolves falsy, the stamp is not
  written, so a later invocation retries (at-least-once intent).
- **Digital order** — receives the same "ready to preview" email for now; the dedicated
  "digital delivered / download" email is TIC-42.

## Scope

**In:**
- Migration: `generated_books` gains three `*_email_sent_at` columns.
- `_shared/bookEmails.ts` decision helper (+ Deno tests mirroring `orderEmails.test.ts`).
- `generate-book`: creating send (at stub insert) + failed send (in the background `catch`).
- `generate-book-images`: ready send (terminal `done`) + failed send (every `failed` path).
- Three new Loops transactional templates wired into `LOOPS_TEMPLATES`.
- `previewUrl` pointed at `/dashboard`.

**Deferred:**
- **Customer `/book/:id` preview route** and repointing `previewUrl` at it — **[TIC-41]**.
- **Digital delivered / download email + buyer download flow** — **[TIC-42]**.
- Real-delivery smoke test of the templates (epic-level follow-up, once Loops paid plan is
  active).

## Open Questions

- None blocking. Loops template IDs to be fetched via `loops agent-context` during
  implementation. Final `etaText` and `supportUrl` copy can be adjusted at template-authoring
  time without code changes beyond the data-variable values.

## More Info

- Reliability model mirrors Ticket 3: send-level at-least-once via per-row `*_email_sent_at`
  stamps. Unlike Ticket 3 there is no separate event-ledger layer — the stamp is the sole
  guard, which is sufficient because the only re-entry source is the pipeline's own
  self-chaining/retries (not an external webhook).
- `pipeline_status` values in play: `story` (creating), `portraits`/page stages (in
  progress), `done` (ready), `failed` (failed). Only `story`, `done`, and `failed` trigger
  email.
