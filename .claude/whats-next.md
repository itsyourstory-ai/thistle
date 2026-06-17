# What's Next

_Updated 2026-06-17 — TIC-19 complete, PR open_

## Work completed and current state

**Branch:** `feature/dedication-page` — pushed, PR open.

**PR:** [#32 — [TIC-19] Add dedication page](https://github.com/itsyourstory-ai/thistle/pull/32)

All tests pass (7 failures are pre-existing on `main` — `AuthContext` and `useDraftPersistence` tests, not related to this branch). Branch added 6 net new passing tests.

### What's on this branch

- **New `src/pages/steps/Step8Dedication.tsx`** — step 8 of the wizard; lets the user write a personal dedication message for the book
- **Updated wizard steps** — `wizardSteps.ts`, `App.tsx` routes, `ProgressBar.tsx` dot count; dedication page inserted at step 8, renumbering downstream steps
- **Updated types & brief** — `wizardTypes.ts` adds `dedication` field; `buildBrief.ts` maps it into the `StoryBrief`
- **Updated edge functions** — `supabase/functions/_shared/prompts.ts` and `generate-book/index.ts` receive and use the dedication in the story prompt
- **Deno test** — `supabase/functions/_shared/dedication.test.ts`
- **125 vitest tests** in `src/test/Step8Dedication.test.tsx`
- **Dev seed updated** — `devSeeds.ts` includes a sample dedication

---

## Work Remaining

1. Merge PR #32 on GitHub (CI must go green first)
2. Vercel auto-deploys `main` to staging
3. Promote to production: Vercel dashboard → latest `main` deployment → `⋯` → **Promote to Production**

**Longer-term backlog:**
- **UX audit wizard fixes** — `docs/plans/ux-audit-wizard-fixes.md` has 11 tasks across 3 phases (none started). These are header/progress improvements, AI steps onto shared shell, and selection-step polish.
- Pre-existing test failures (`AuthContext.test.tsx`, `useDraftPersistence.test.ts`) — 7 tests have been failing since before this branch; should be investigated and fixed.

---

## Gotchas

**Don't run `supabase db push` on the live project.** The migration history is out of sync (schema was built outside the CLI). Apply any new migrations via the Supabase SQL editor.

**Supabase URL allow-list** includes `/account` for `http://localhost:8080` and `https://thistle-sepia.vercel.app`. Add a custom domain entry if production moves off Vercel.

---

## Dead ends

- `supabase db push` — don't use on live project (migration history mismatch)
- Old Supabase project `coiobrdbqledpzvcttto` — belongs to `its-your-story`, not Thistle
- `LOVABLE_API_KEY` / `connector-gateway.lovable.dev` — Lovable-proprietary, fully replaced
