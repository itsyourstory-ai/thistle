This file provides guidance to AI's when working with code in this repository.

**This file is the source of truth for how to work in this repo.** More than one person works on Thistle, each with their own tools and personal setup. If your personal or global instructions conflict with this file (a different framework, test command, component library, or workflow), follow this file.

## What this app is

Thistle Book is a personalized children's book creator. Users walk through a 12-step wizard collecting the child's name, age, interests, personality, art style, and photos. That data is assembled into a `StoryBrief` and sent to Supabase Edge Functions that call AI models to generate the story, cover image, character portraits, and page illustrations. Buyers pay with Stripe before the full book is generated. Transactional email goes through Loops.

It is a **Vite + React + TypeScript single-page app** on **Supabase** (Postgres, Row Level Security, Deno Edge Functions), hosted on **Vercel**. See [Tech stack](#tech-stack) for details. In practice that means:

- UI is React components built on **shadcn/ui** (`src/components/ui/`) and Tailwind. Interactivity is React state and hooks.
- Server logic lives in **Supabase Edge Functions** (`supabase/functions/`, Deno + TypeScript). There is no other backend.
- Database changes are SQL migrations in `supabase/migrations/` (see [Database](#database)).
- Tests are **Vitest** for the app and **Deno test** for shared edge-function code (see [Commands](#commands)).

## How we work

### Linear

All planned work lives in **Linear** (workspace `thistlebooks`, team **THI**). It is the source of truth for the roadmap, priorities and status. Don't keep plans or to-do lists anywhere else.

- **Projects run in order:** `0 · Decisions` → `1 · Checkout & payments` → `2 · Book delivery` → `3 · Launch readiness` → `4 · Go live` → `5 · Printed books (Lulu)` → `6 · Polish` → `7 · After launch`. THI-32 (production launch checklist) is blocked by every launch ticket.
- **Blocking relations are kept up to date.** Check a ticket's "blocked by" list before starting it.
- **The `Human` label** marks tasks a person has to do (dashboards, accounts, decisions, legal, reviewing printed proofs). Don't try to do those; point them out.
- **Ticket descriptions** are written for people first. Implementation detail (files, functions, gotchas) goes in a collapsible **Agent notes** section at the end (`+++ Agent notes` … `+++`).
- **Found new work?** Propose a Linear ticket rather than quietly expanding the current change. Check for an existing ticket first.
- Status updates are automatic: Linear's GitHub integration links branches and PRs and moves tickets when the ticket identifier is in the branch name. Don't set ticket status by hand for work that has a branch.

### Git

**Direct pushes to `main` are blocked.** Always work on a branch and open a PR.

1. **Always branch before making any changes.** Never commit directly to `main`.
2. **Branch names:** `<type>/<slug>`, where type is `feature`, `fix` or `chore`. For ticket work, include the lowercased ticket id: `feature/thi-20-book-viewer`.
3. **When asked to push**, push the branch and create a PR with `gh pr create`, then share the PR URL.
4. Commits: imperative mood, ~50-character subject, prefixed (`feature:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`). One logical change per commit.

### Before merging

- Run `npm run lint && npm test` — do not skip even for small changes
- If you touched `supabase/functions/`, also run `mise exec -- npm run test:deno`
- After any multi-file edit, run `npm run build` to catch TypeScript errors
- After any change touching Supabase (edge functions, migrations, RLS): verify new tables/columns have correct GRANT statements and RLS policies for all roles that need them
- When using `replace_all`, check the diff for duplicate props (e.g. two `className=` on one element silently drops the first) and unintentionally dropped Tailwind classes

### Testing caveat: fake responses

Most app tests run with **test mode** on, so `callEdge()` returns fixture responses instead of calling the real edge functions. That keeps tests fast and offline, but it means tests **can't catch mismatches between what the app sends and what an edge function expects**. (This is how checkout shipped without sending the buyer's email; see THI-35.)

When a change touches a request between the app and an edge function, add a test that checks the request body the app sends matches what the function reads.

## Commands

```bash
npm run dev          # dev server at http://localhost:8080
npm run build        # production build
npm run lint         # ESLint
npm test             # run tests once (vitest run)
npm run test:watch   # vitest in watch mode
npm run test:coverage # run tests with v8 coverage report
npm run test:deno    # run Deno unit tests for supabase/functions/_shared/
```

Run a single test file: `npx vitest run src/test/example.test.ts`

Deno isn't on `PATH` by default; it's provided by `mise`. Run the Deno suite with `mise exec -- npm run test:deno`.

See [docs/test-suite.md](docs/test-suite.md) for the full testing guide (layers, helpers, conventions). See [docs/manual-testing.md](docs/manual-testing.md) for the manual testing panel and seed profiles.

## Required env vars

### Client (`VITE_`-prefixed, set in Vercel and local `.env`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key. Must be the same mode (test or live) as the `STRIPE_SECRET_KEY` the edge functions use.
- `VITE_DEV_TEST_MODE`, `VITE_DEV_AUTH_BYPASS` — local development only (`"1"` to enable). Never set in Vercel.

### Server-side / edge function secrets (never `VITE_`-prefixed)

Set in the Supabase dashboard (Functions → Secrets). Never commit a real value. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the anon/publishable keys are provided by Supabase automatically.

- `STRIPE_SECRET_KEY` — Stripe secret key (`sk_test_…` or `sk_live_…`).
- `STRIPE_WEBHOOK_SECRET` — signing secret for the `stripe-webhook` endpoint, from the Stripe dashboard webhook settings.
- `OPENROUTER_API_KEY` — all AI text and image generation goes through OpenRouter.
- `GOOGLE_SERVICE_ACCOUNT_JSON` — service account used by the Google Drive export functions.
- `LOOPS_API_KEY` — Loops API key; get from Loops dashboard → Settings → API Keys. Also set in Vercel environment variables.
- `LOOPS_TRANSPORT` — `"live"` in production; omit or set to `"mock"` for local dev and tests. The `test:deno` script forces `mock` automatically. **Never set it to `mock` in production as a "rollback"** — mock mode silently drops every email.
- `SEND_EMAIL_HOOK_SECRET` — Standard Webhooks secret (format `v1,whsec_…`) for the Supabase Send-Email auth hook. Generated when you enable the hook in the Supabase dashboard (Authentication → Hooks → Send Email); copy it from there. The `auth-email-hook` function strips the `v1,whsec_` prefix and verifies incoming requests with it.
- `APP_BASE_URL` — Public app origin used by server-side emails for resume/retry links, e.g. `https://thistlebook.com`. Also set in Vercel environment variables.

### Transactional emails (Loops)

Auth, account, order and book emails are sent through Loops transactional templates, with IDs filled into `LOOPS_TEMPLATES` in [`supabase/functions/_shared/loops.ts`](supabase/functions/_shared/loops.ts):

| Template key | Trigger | Required variables |
|---|---|---|
| `confirmEmail` | Sign-up confirmation (Supabase `signup` hook action) | `confirmationUrl` |
| `passwordReset` | Password reset (Supabase `recovery` hook action) | `resetUrl` |
| `welcome` | First successful contact sync after sign-in | none |
| `accountDeletion` | Account deletion, before the user is deleted | none |
| `orderReceipt` | Stripe `payment_intent.succeeded` | `buyerName`, `orderId`, `productLabel`, `amountFormatted`, `shippingAddress` |
| `paymentFailed` | Stripe `payment_intent.payment_failed` | `retryUrl` |
| `refund` | Stripe `charge.refunded` | `orderId`, `amountFormatted` |
| `abandonedCheckout` | Scheduled abandoned checkout nudge | `resumeUrl` |
| `bookCreating` | Book generation accepted and started | `childName`, `etaText` |
| `bookReady` | Book generation completed | `childName`, `previewUrl`, `bookId` |
| `bookFailed` | Book generation failed | `childName`, `supportUrl` |

The `confirmEmail` / `passwordReset` sends are driven by the Supabase Send-Email hook → `auth-email-hook` function; `welcome` and `accountDeletion` are sent from `sync-contact` and `delete-account` respectively. Checkout and payment emails are sent from `stripe-webhook` and `nudge-abandoned-orders`. Order emails are skipped when `orders.buyer_email` is empty. Transactional email sends from the `mail.thistlebook.com` subdomain (configured in the Loops dashboard; no code impact).

## Architecture

### Tech stack

- **Vite + React 18 + TypeScript** SPA — `@` alias resolves to `src/`
- **Tailwind CSS + shadcn/ui** (Radix UI primitives) — component config in `components.json`
- **TanStack Query** for server state, **React Router v6** for routing
- **Supabase**: Postgres database, Row Level Security, Auth (email + Google), Storage, and Deno Edge Functions
- **Stripe** Payment Element for checkout; **OpenRouter** for AI models; **Loops** for email
- **Vercel** hosting: `main` auto-deploys to staging; promote to production manually via the Vercel dashboard

### Wizard flow

Steps are defined in `src/lib/wizardSteps.ts` and routed in `src/App.tsx`:

| Route | Step | Component |
|---|---|---|
| `/step/1-name` | Child's name, age, gender | Step1Name |
| `/step/2-buyer` | Buyer relationship + occasion | Step2Buyer |
| `/step/3-genre` | Story genre/mood | Step3Genre |
| `/step/4-lesson` | Life lesson | Step4Lesson |
| `/step/5-interests` | Interests (editable chip picker) | Step5Interests |
| `/step/6-art-style` | Art style selection | Step6ArtStyle |
| `/step/7-character` | Protagonist + supporting characters + personality | Step7Character |
| `/step/8-dedication` | Dedication message | Step8Dedication |
| `/step/9-story` | AI generates story concept + cover; user approves | Step8Summary |
| `/step/10-cast` | Cast portraits | Step9Cast |
| `/step/11-preview` | Checkout — choose format + pay | Step10Preview |
| `/step/12-generating` | Full book generation | Step9Generating |

Note: component filenames are offset from route numbers for steps 9–12 (historical artifact).

Other routes: `/` (landing, or redirect to dashboard when signed in), `/login`, `/dashboard` (drafts + finished books), `/resume/:draftId`, `/account`.

### State management

`WizardContext` (`src/contexts/WizardContext.tsx`) is the single source of truth for all wizard answers. Drafts are saved to `book_drafts` as the user goes (`useDraftPersistence`). Key fields on `answers`:

- `childName`, `ageRange`, `gender`
- `protagonist` — `{ name, age, gender, photos[], appearance, traits[] }`
- `supportingCharacters` — array of supporting character objects
- `interestsList` — array of `{ word }` objects
- `artStyle`
- `selectedConcept` — approved story concept from `generate-summary` (includes `title`, `summary`, `story_seed`, `framework_id`, `coverImage`)
- `characterPortrait` — `{ status, dataUrl, sourceHash }`
- `orderId`, `buyer_name`, `buyer_email`, `selectedPlan` — set at checkout
- `bookId` — set after full book generation starts

### Brief assembly

`src/lib/buildBrief.ts` exports `buildBrief(answers)` which maps `WizardContext.answers` into a typed `StoryBrief` — the payload sent to every edge function. If you add a new wizard field, update both `buildBrief` and `StoryBrief`.

### Purchase and generation flow

1. Checkout (`Step10Preview`) calls `create-payment-intent`, which creates the Stripe PaymentIntent and an `orders` row (`status = 'pending'`).
2. The browser confirms payment with Stripe. `stripe-webhook` marks the order `paid` and sends the receipt.
3. The generating step (`Step9Generating`) calls `generate-book` with the brief and `order_id`. `generate-book` checks the order is paid, writes the story, then starts `generate-book-images` in the background.
4. `generate-book-images` generates portraits and pages, re-invoking itself in time slices until done, uploads to Google Drive, and sends the book ready / failed email.
5. The browser polls `generated_books.pipeline_status` for progress.

Known gaps in this flow are tracked in Linear project `1 · Checkout & payments` (THI-35 to THI-39).

### Supabase Edge Functions

All server logic runs in `supabase/functions/`. The client calls them through `callEdge(name, body)` in `src/lib/edgeFunctions.ts` (a wrapper around `supabase.functions.invoke` that also handles test-mode fixtures).

| Function | Purpose |
|---|---|
| `generate-summary` | Generates 1–3 story concepts from the brief |
| `generate-cover` | Generates the book cover image |
| `generate-character-portrait` | Generates a portrait for one character |
| `extract-appearance-traits` | Vision pre-pass: extracts appearance features from an uploaded photo |
| `create-payment-intent` | Creates/updates the Stripe PaymentIntent and the `orders` row; applies promo codes |
| `stripe-webhook` | Handles Stripe events (paid, failed, refunded) and sends order emails |
| `nudge-abandoned-orders` | Scheduled (pg_cron) abandoned-checkout email |
| `generate-book` | Paid-order gate + full story text generation; starts the image pipeline |
| `generate-book-images` | Generates portraits and page illustrations; self-chains until done |
| `export-book-to-drive` / `export-book-images-to-drive` | Exports the manuscript and images to the team's Google Drive |
| `sync-contact` | Syncs the signed-in user to Loops; sends the welcome email |
| `delete-account` | Deletes the user's account and data (photo cleanup currently misses files; see THI-41) |
| `auth-email-hook` | Supabase Send-Email hook → Loops confirm/reset emails |
| `_shared/` | Shared Deno modules: auth, rate limits, layouts, layout sequences, prompts, Loops/Stripe helpers, email senders |

Most functions have `verify_jwt = false` in `supabase/config.toml` and do their own auth: user-facing ones call `requireAuthedUser`, internal ones require the service-role key (`isServiceRoleRequest`). Keep that pattern for new functions. Edge functions write using `service_role` (bypasses RLS).

### Database

Migrations live in `supabase/migrations/`. `supabase db push` is unreliable for this project; see CLAUDE.local.md for how migrations are applied. Key tables:

- `profiles` — one row per user (`subscribed` marketing flag, `welcomed_at`)
- `book_drafts` — in-progress wizard answers; users manage their own
- `orders` — one row per checkout: product, amounts, buyer, shipping, Stripe ids, `status`, `book_id`, email stamps
- `generated_books` — one row per book; stores `brief` (jsonb), `status`, `parsed` story output, `pipeline_status` / `pipeline_progress`, email stamps. Users can read their own rows (not the buyer email/name columns).
- `book_images` — generated portraits and page images (base64 in `image_data_url`); service_role only
- `book_image_upload_attempts` — Drive upload tracking; service_role only
- `stripe_webhook_events` — idempotency ledger for Stripe events
- `edge_rate_limits` — per-user rate limit counters

Child photos are stored in the `draft-photos` Storage bucket (configured in the dashboard, not in migrations).

### Page layout system

`src/lib/pageLayouts.ts` is the **client-side mirror** of `supabase/functions/_shared/layouts.ts`. **Keep these in sync by hand.** Layout IDs are used in both image prompt assembly (server) and the dev preview renderer (client). Books are a fixed 32-page square format: title page, dedication, then 30 story pages (`_shared/layoutSequences.ts`).

### Dev-only route

`/dev/story-preview/:id` (`src/pages/DevStoryPreview.tsx`) is a debugging view of a book's story text, image prompts and Drive links. It does not show the illustrations. It requires sign-in and is **left out of production builds** (`import.meta.env.DEV`), so nothing customer-facing should link to it.

## CI/CD and deploys

GitHub Actions runs lint, test, and build on every PR — all must pass before merge. Merging to `main` auto-deploys the website to Vercel staging. To promote to production, use the [Vercel deployments dashboard](https://vercel.com/its-your-story/thistle/deployments).

- **Vercel only deploys the website.** Edge functions (`supabase functions deploy`) and migrations are deployed to Supabase separately. A merged change to `supabase/` is not live until someone deploys it.
- **Staging and production share one Supabase project** (database, functions, secrets, users). Testing on staging creates real users and sends real emails. See THI-34.

See [docs/deploy.md](docs/deploy.md) for details.

## Loops

Before starting any task that requires account-specific Loops data — such as
transactional email template IDs, contact property names, mailing list IDs, or
campaign details — run `loops agent-context` and read the output first.

Do NOT run it for: general Loops API questions, reviewing existing Loops code,
or tasks where no account-specific IDs or field names are needed.

## Other notes

Refer to CLAUDE.local.md (if you have one; it isn't committed) for additional local development instructions.
