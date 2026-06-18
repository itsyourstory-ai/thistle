# Testing the Wizard Locally

## Manual testing (the main loop)

The wizard has a **🧪 test: off** pill in the header next to "⚙ dev: skip step". Clicking it opens the test panel. All controls below live there.

### What each control does

| Control | What it does |
|---|---|
| **Test mode toggle (on/off)** | When ON, all 6 AI edge functions return instant fake responses instead of calling Supabase. Walk the entire wizard for $0. |
| **Bypass checkout** | Skip the Stripe payment step entirely and jump straight to generation. Use this for wizard testing when you don't care about the payment flow. |
| **Seed profile dropdown** | Picks which of the 4 pre-filled child profiles to load. Each has very different shape: photo vs no-photo, supporting characters, edge-case names, special pet. |
| **Load → Step 1 (button)** | Fills all wizard answers from the selected profile and goes to Step 1. Navigate normally from there — every step will already show the seeded selections. |
| **Jump → Checkout (button)** | Seeds answers from the selected profile and navigates directly to the checkout step (step 11). If a draft ID is entered below, injects it so the Stripe payment form loads. |
| **Draft ID for Stripe** | Paste a Supabase draft ID here. When set, "Jump → Checkout" injects it so `create-payment-intent` can run and the Stripe Payment Element appears. Get one by completing steps 1–8 once with real Supabase — no AI calls happen until step 9. |
| **Fake delay (ms)** | Adds artificial latency to every mocked call. Set > 0 so loading states and animations actually play. Set to 0 for instant results. |
| **Force error on** | Makes the selected function (or all) return an error instead of a fixture. Use this to trigger the "Try again" / error UI on demand without breaking anything. |
| **Run live (checkboxes)** | Per-function override: keeps test mode on globally but calls Supabase for real on the checked functions. Useful for testing one specific AI call while the rest stay free. |
| **Response cache — Record** | Makes real Supabase calls AND stores the responses in browser IndexedDB. Run once to snapshot real AI output. |
| **Response cache — Replay** | Returns the stored response immediately (no Supabase call). After recording once, replay lets you re-test with real-shaped data for free. |
| **Clear cache** | Deletes all stored responses so a fresh Record pass can overwrite them. |

### Typical session

```
1. npm run dev
2. Open any wizard step in the browser
3. Click "🧪 test: off" → toggle ON
4. Pick a seed profile (start with "Classic — Leo")
5. Click "Load → Step 1"  — the wizard jumps to Step 1 with all answers pre-filled
6. Click Continue through the steps — every page shows the seeded selections
7. All AI calls (summary, cover, portrait, book) return fake data instantly
8. Toggle test mode OFF to run a real generation when you need it
```

### Testing checkout without AI calls

```
1. Complete steps 1–8 once with real Supabase (no AI calls happen until step 9)
2. Copy the draft ID from the Supabase dashboard → Table Editor → drafts
3. Paste it into "Draft ID for Stripe" in the test panel (it persists across reloads)
4. Turn on test mode, pick a seed profile, click "Jump → Checkout"
5. The checkout page opens with the cover, plan selector, and Stripe payment form
6. Use test card 4242 4242 4242 4242 to complete a payment
```

### Important: navigating to steps in dev

The wizard state is held in React memory. **`window.location.href = '/step/X'` causes a full page reload and wipes all wizard answers** — the wizard then redirects you back to step 1. Always use in-app navigation to move between steps: the SKIP STEP button, the step nav in the header, or the "Jump → Checkout" button in the test panel. These use React Router and preserve state.

### The 4 seed profiles

| Profile | Child | Shape |
|---|---|---|
| **Classic — Leo** | Boy, 6, cozy-gouache | Photo uploaded, 2 supporting chars (Mom + dog), full traits |
| **Minimal — Priya** | Girl, 4, geometric-pop | No photo, no supporting cast, sparse fields |
| **Edge text — Bartholomew-James** | Boy, 8, hand-drawn-charm | Long names, 8 interests, surprise-name supporting char, fox pet |
| **Special pet — River** | Non-binary, 5, cozy-gouache | Magic cat (Mochi), grandma supporting char |

---

## Test user (local login)

- **Email:** test@itsyourstory.ai
- **Password:** testtest123

Created in Supabase (project `uglsyitjasajubfvbiry`) with email auto-confirmed. Session persists in localStorage — log in once per browser and reloads/dev-server restarts won't require signing in again.

**Note:** Don't click "Delete account" on the Account page with this user — it will actually delete the Supabase user record and you'd need to recreate it.

---

## Stripe checkout testing

Everything here runs on **Stripe test mode** — no real card is ever charged. Real
cards are rejected; only the test cards below work.

### Three ways to exercise checkout, from least to most setup

| Goal | How |
|---|---|
| **Skip payment entirely** (most wizard testing) | Turn on `bypassCheckout` in the 🧪 test panel. Step 11 skips the Payment Element and routes straight to generation. No Stripe involved. |
| **Test the real payment UI against deployed staging** | Merge the checkout functions to `main` (auto-deploys), register the dashboard webhook (manual-setup Part B), then run the flow on the staging URL. Stripe sends webhooks directly to the deployed endpoint — no `stripe listen` needed. |
| **Test the real payment UI against functions running locally** | Run the functions locally + forward webhooks with the Stripe CLI (below). |

### Local payment flow with `stripe listen`

Local `supabase.functions.invoke` calls don't get webhooks from Stripe (your machine
isn't internet-reachable), so the Stripe CLI forwards them for you.

```bash
# Terminal 1 — serve the edge functions locally with their secrets
supabase functions serve --env-file supabase/.env

# Terminal 2 — forward Stripe test events to the local stripe-webhook function
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

- `stripe listen` prints a **local** signing secret (`whsec_…`). Put it in
  `supabase/.env` as `STRIPE_WEBHOOK_SECRET=…` (this is a *different* secret from the
  deployed dashboard endpoint's). Restart Terminal 1 after adding it.
- Leave both terminals running while you test. Each successful test payment fires
  `payment_intent.succeeded`, the CLI forwards it, and the order flips to `paid`.
- Trigger an event by hand without paying:
  `stripe trigger payment_intent.succeeded`.

### Test cards (test mode only)

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Declined (generic) |
| `4000 0025 0000 3155` | Requires 3-D Secure authentication |

Any future expiry, any 3-digit CVC, any ZIP. Full list: https://docs.stripe.com/testing.

### Discount codes

Discount codes are **Stripe promotion codes** created in the dashboard
(Product catalog → Coupons → add a promotion code). Type the code into the checkout's
discount field; the server looks it up and recomputes the total. Invalid/expired codes
are rejected inline with the total unchanged.

### Prices

Set server-side, not from Stripe Price objects: digital **$9.99** (999¢), hardcover
**$54.99** (5499¢). The Stripe product names are cosmetic — the code keys off
`digital` / `hardcover`, so renaming products in Stripe changes nothing.

---

## Automated tests

```bash
npm test          # run once
npm run test:watch  # watch mode during development
```

**What's tested:**
- `src/lib/buildBrief.test.ts` — 20 assertions on the pure answers→brief mapping for all 4 seed profiles and edge cases (surprise names, Other relationships, specialThing, non-binary gender). Guards against the field-name drift footgun.
- `src/test/wizardFlow.test.tsx` — WizardContext initialisation, `seedAnswers()` loading, and brief-shape validation for every profile.
- `src/test/stepValidation.test.tsx` — Step 3 (genre + mood) canContinue gating: Continue button disabled until both are selected.

All tests run in CI on every PR. No Supabase calls — `callEdge` is mocked.

---

## How to refresh a fixture

Fixtures are hand-authored in `src/test/fixtures/index.ts`. If the real API returns a different shape:

1. In the test panel, set cache to **Record**, disable test mode, run through the step once → the real response is stored in IndexedDB.
2. Open DevTools → Application → IndexedDB → `thistle_edge_cache` → `responses` to copy the JSON.
3. Paste the updated shape into `src/test/fixtures/index.ts`.
4. Switch cache back to **Off**.
