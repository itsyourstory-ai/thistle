# Plan: Change app name to "Thistle Book" (THI-6)

## Status

| Task | Description | Assign | Done |
| ---- | ----------- | ------ | ---- |
| 1 | Web surfaces: `index.html` meta + landing wordmark + test | Master | |
| 2 | Dashboard header + docs (`DashboardHeader`, `README`, `AGENTS`) | Clone | |
| 3 | Loops template snapshot copy (`orderReceipt`, `refund`) | Clone | |

## Prerequisites

- Design: `docs/designs/change-name-to-thistle-book.md`
- Prototype: None
- Feature branch: already on `jrdnbwmn/thi-6-rename-to-thistle-book`
- Verify commands for this repo (React/Vite, **not** Rails): `npm run lint && npm test`, then `npm run build`

## Tasks

### Task 1 [Master]: Web surfaces — meta tags, landing wordmark, and its test

**In scope:**

- `index.html` — 4 occurrences of `"Thistle Books"` → `"Thistle Book"`:
  - line 7 `<title>`, line 9 `author` meta, line 22 `og:title`, line 23 `twitter:title`
- `src/pages/Landing.tsx` line 14 — `📖 Thistle Books` → `📖 Thistle Book`
- `src/pages/Landing.test.tsx` lines 19 & 21 — test description string and the `getByText(/Thistle Books/i)` matcher → `Thistle Book`

**NOT in scope:**

- Any logic, styling, or layout changes; the `📖` emoji stays.
- The `thistlebook.com` domain references — already correct.

**Build order:**

1. **Test:** Update `src/pages/Landing.test.tsx` matcher to `/Thistle Book/i` and the `it(...)` description to "renders the Thistle Book wordmark". (Test-first: it should fail against the current `Thistle Books` markup.)
2. **Implement:** Edit `src/pages/Landing.tsx` and `index.html` strings.
3. **Verify:** `npx vitest run src/pages/Landing.test.tsx`
4. **Review:** Run review-changes before proceeding.

### Task 2 [Clone]: Dashboard header + docs

**In scope:**

- `src/components/DashboardHeader.tsx` line 10 — `<span ...>Thistle</span>` → `Thistle Book`
- `README.md` line 1 — `# Thistle` → `# Thistle Book`
- `AGENTS.md` line 5 — `Thistle is a personalized...` → `Thistle Book is a personalized...`

**NOT in scope:**

- Other `Thistle`/`thistle` occurrences in `AGENTS.md` that refer to domains, secrets, or infra slugs — leave untouched.
- The `src/lib/testMode.ts` "Thistle dev test harness" comment — intentionally excluded (internal).

**Build order:**

1. **Test:** No dedicated test (no assertion currently covers these strings; DashboardHeader has no snapshot on the wordmark). Rely on `npm test` + `npm run build` staying green.
2. **Implement:** Three single-line edits above.
3. **Verify:** `npm test` (full run — confirms no existing test asserted the old strings).
4. **Review:** Run review-changes before proceeding.

### Task 3 [Clone]: Loops template snapshot copy

**In scope:**

- `.codex/loops-templates/email-messages/orderReceipt-message.json` line 4 — `subject`: `"Your Thistle order is confirmed"` → `"Your Thistle Book order is confirmed"`
- `.codex/loops-templates/email-messages/refund-message.json` line 5 — `previewText`: `"We've refunded your Thistle order"` → `"We've refunded your Thistle Book order"`

**NOT in scope:**

- The `fromName` fields — already `"Thistle Book"`.
- Any push to Loops via CLI. This edits only the local JSON snapshots; syncing to Loops is a separate explicit step if wanted later.

**Build order:**

1. **Test:** None (static snapshot JSON, not exercised by the suite).
2. **Implement:** Two single-field edits above.
3. **Verify:** `git diff` to confirm only `subject`/`previewText` changed and JSON stays valid.
4. **Review:** Run review-changes before proceeding.

## Final verification (Master, after all tasks)

- `npm run lint && npm test` — all green
- `npm run build` — succeeds (catches TS errors)
- `git grep -n "Thistle Books"` returns nothing; no user-facing surface reads bare "Thistle"

## Task Dependencies

- Tasks 1, 2, and 3 are fully independent (no shared files) and can run in parallel.
- Task 1 is tagged Master only because it's the one task with a real test to update; it doesn't block 2 or 3.
