# Feature: Change app name to "Thistle Book" (THI-6)

> Plan created: [docs/plans/change-name-to-thistle-book.md](../plans/change-name-to-thistle-book.md)

Linear ticket: THI-6

## Problem

The app's display name was recently changed slightly, but the rename never landed
everywhere. Three different variants currently exist in user-visible copy:

- the old plural brand spelling — `index.html` (title, author meta, og:title, twitter:title),
  `src/pages/Landing.tsx` nav wordmark, and its test
- **"Thistle"** alone — `README.md` title, `AGENTS.md` prose,
  `src/components/DashboardHeader.tsx` wordmark
- **"Thistle Book"** (the target spelling) — already present as the Loops `fromName`
  in transactional email templates, but not in the `subject`/`previewText` copy of two
  of those same templates

For: anyone reading the app's UI, docs, or transactional emails.

## Approach

Reconcile all user-visible occurrences to the single spelling **"Thistle Book"**.
This is a text-only rename — no logic changes.

### Decisions made during brainstorming

- **Scope is display-name text only.** Domains (`thistlebook.com`,
  `mail.thistlebook.com`, support/notify addresses) are already one word and are
  **not** touched.
- **Infra identifiers are left alone**, even though they contain "thistle":
  GitHub repo slug (`itsyourstory-ai/thistle`), Vercel project slug (`thistle`),
  Supabase Vault secret `thistle_service_role_key`, IndexedDB name
  `thistle_edge_cache`, localStorage key `thistle_test_mode`, and a multipart
  upload boundary string. Renaming any of these is a separate, riskier infra task.
- **`scripts/vercel-setup.sh`** console echo/comment strings are skipped — cosmetic
  output only, not worth the churn.
- **`package.json` `name` field** is left as-is (generic Lovable scaffold value,
  never branded, doesn't affect any UI).
- **Loops email templates**: only the local snapshot copy
  (`.codex/loops-templates/email-messages/*.json`) is corrected. No push to Loops
  via the CLI as part of this change — that's a separate, explicit step if wanted
  later.

### Files to change

1. `index.html` — title, author meta, og:title, twitter:title: old plural brand spelling → "Thistle Book"
2. `src/pages/Landing.tsx` — nav wordmark: old plural brand spelling → "Thistle Book"
3. `src/pages/Landing.test.tsx` — update description + assertion to match
4. `src/components/DashboardHeader.tsx` — "Thistle" → "Thistle Book"
5. `README.md` — "# Thistle" → "# Thistle Book"
6. `AGENTS.md` — "Thistle is a personalized..." → "Thistle Book is a personalized..."
7. `.codex/loops-templates/email-messages/orderReceipt-message.json` — subject
   "Your Thistle order is confirmed" → "Your Thistle Book order is confirmed"
8. `.codex/loops-templates/email-messages/refund-message.json` — previewText
   "We've refunded your Thistle order" → "We've refunded your Thistle Book order"

## Acceptance Criteria

- No user-facing surface (browser tab title, meta tags, landing page, dashboard
  header, README, AGENTS.md, email subject/preview copy) reads "Thistle" or
  the old plural brand spelling — all read "Thistle Book".
- `Landing.test.tsx` passes against the updated wordmark text.
- Domains, infra slugs, internal storage keys, and `package.json` are unchanged.
- `npm run lint && npm test` pass; `npm run build` succeeds.
