## Catchup 2026-06-11

### Friction
- User had to point out that I auto-executed the plan immediately after ExitPlanMode without waiting for `/execute-plan`. The CLAUDE.md rule "Plans in docs/plans/ are executed via /execute-plan. Do not auto-execute plans without the command" was in scope — I missed it.
- Had to ask the user to find the Supabase project ID and walk through the wrong project before discovering the right one. A `supabase projects list` CLI call early on would have surfaced this.

### Mistakes
- Started building immediately after plan approval instead of waiting for `/execute-plan`.
- Assumed the existing Supabase project (`coiobrdbqledpzvcttto`) was Thistle's — it was actually for `its-your-story`. Thistle never had a real database. Should have verified by reading the table schema via SQL before proceeding.
- Generated a duplicate `const supabaseUrl = ...` declaration in `generate-book/index.ts` when adding the JWT check — caught and fixed during the session.
- Had a Deno syntax error on first deploy of `generate-book` (`??` requires parens when mixed with `||`) — fixable but added a round-trip.

### Observations
- The Lovable gateway (`ai.gateway.lovable.dev`) and `LOVABLE_API_KEY` are Lovable-managed and inaccessible outside of Lovable-hosted projects. OpenRouter is a clean drop-in for the AI calls (same OpenAI-compatible API shape). The Google Drive connector (`connector-gateway.lovable.dev`) is a separate proprietary service — no drop-in replacement, needs direct Drive API integration.
- `supabase db push` is unreliable when the remote migration history was created outside the CLI (e.g. by Lovable). Use the SQL editor for migrations on this project.
- `SUPABASE_ANON_KEY` is deprecated in new Supabase projects (≥2024). New projects use `SUPABASE_PUBLISHABLE_KEYS` (a JSON dict). Needed a fallback pattern: `Deno.env.get("SUPABASE_ANON_KEY") || (JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? "")`.
- The `.claude/settings.local.json` file can accumulate Supabase access tokens in the `permissions.allow` list — needs to be in `.gitignore`.

## Catchup 2026-06-17

### Friction
None notable.

### Mistakes
- Minor copy fix needed after initial implementation (`fix: correct dedication subtitle copy and trailing newline`) — caught quickly and corrected same session.

### Observations
- The wizard step numbering in this app is intentionally offset between route slugs and filenames for steps 9 and 10 (documented in CLAUDE.md). Adding a new step mid-sequence (step 8) required careful renumbering of downstream steps — worth double-checking route slugs, file names, and ProgressBar dot count as a checklist when inserting steps.
- Pre-existing test failures in `AuthContext.test.tsx` and `useDraftPersistence.test.ts` (7 tests) exist on `main` and should be tracked down and fixed independently; they are not related to wizard features.

## Catchup 2026-06-20

### Friction
- The `/execute-plan` skill triggers a `review-changes` sub-skill at the end of each task, but that sub-skill surfaces as a new user turn asking me to "run the review-changes skill" — causing me to stop and wait for user input instead of continuing automatically. This happened 4 times, stalling progress each time until the user prompted me to continue.

### Mistakes
- Stopped after Task 1's review-changes instead of continuing to Task 2 automatically. User had to ask "aren't you supposed to continue doing the plan until it's done?" — should have resumed immediately after each review passes.

### Observations
- The `review-changes` skill fires as a sub-invocation that presents as a new user turn, breaking the autonomous flow of `/execute-plan`. Future sessions: after the skill completes and shows no blocking issues, immediately continue to the next task without waiting for user input.
- `geist` package was installed but never imported anywhere — likely an accidental `npm install` during a prior session. Worth a quick `grep` check before committing unexpected lockfile changes.
- The `setTimeout(fn, 0)` pattern for avoiding the Supabase auth-lock deadlock is testable with RTL's `waitFor` (positive case) and `await act(async () => { await new Promise(r => setTimeout(r, 0)); })` (negative case) — no fake timers needed.
- Deno test suite runs under `--allow-env` only (no `--allow-net`), so any accidental `fetch` call in mock transport would throw a permission error — this is the implicit "zero network calls" enforcement. The `LOOPS_TRANSPORT=mock` prefix in `test:deno` ensures mock mode is forced even if the env has a live key.
