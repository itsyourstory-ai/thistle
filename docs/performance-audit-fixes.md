# Performance Audit Fixes (TIC-7)

Remediation plan for the performance audit. Branch: `chore/performance-audit`.
Fixes **all findings except F18** (edge-function cold-start — deferred, needs Supabase
log data to justify).

Two findings were corrected by runtime investigation:
- **F16 is a false positive** — art-style `<img>` tags already carry `width`/`height`
  (`src/pages/steps/Step6ArtStyle.tsx:55`, `src/pages/steps/Step1Name.tsx:157`). No action.
- **F14 is hygiene only** — the 7 unused shadcn deps (`recharts`, `cmdk`, `vaul`,
  `embla-carousel-react`, `input-otp`, `react-resizable-panels`, `react-day-picker`) are
  already fully tree-shaken (0 bytes in bundle). Removing them shrinks install size, not the bundle.

Work is grouped into **6 phases**, low-risk → high-effort, each independently verifiable
(≤7 files, then lint + test + build before moving on). Behavior changes get a test (TDD);
pure refactors must keep existing tests + build green.

---

## Phase A — Render correctness & memoization (one-liners, low risk)

| ID | File | Change |
|---|---|---|
| F9 | `src/pages/steps/Step9Generating.tsx:30` | **Bug fix.** `coverMessages(name)` is a new array each render, so `useRotatingMessage`'s effect resets the interval every render and the message never rotates. Wrap: `const msgs = useMemo(() => coverMessages(name), [name])`, pass `msgs`. |
| F7 | `src/contexts/WizardContext.tsx:43` | Wrap the Provider `value` object in `useMemo` keyed on `[answers, canContinue, isGenerating, draftId, setAnswer, seedAnswers, resetWizard]`. Eliminates cascade re-renders of every `useWizard()` consumer on any state change. |
| F8 | `src/contexts/AuthContext.tsx:122` | Same `useMemo` treatment, keyed on `[session, loading]` + the stable callbacks. |
| F11 | `src/components/CharacterHeadPreview.tsx:144` | `setTimeout(() => setPulse(false), 350)` has no cleanup. Move into a `useEffect` keyed on `pulse` that returns `clearTimeout`, or store the id and clear on unmount. |
| F10 | `src/components/SelectableTile.tsx` | Wrap export in `React.memo`. All props are primitives/handlers — shallow compare is safe. Rendered up to 10×/step. |

**Verify A:** `npm run lint && npm test && npm run build`. Manually confirm via preview that the Step 11 loading message now rotates (F9).

---

## Phase B — Dashboard query slimming (`src/pages/Dashboard.tsx`)

| ID | Change |
|---|---|
| F1 | Drop `answers` from the `book_drafts` list `.select()` (line 44) — it carries base64 photo data URLs never rendered in the list. `resumeDraft()` (line 68) must then fetch `answers` for the single chosen draft: `supabase.from("book_drafts").select("answers,current_step").eq("id", id).single()` before `deserializeAnswers`. |
| F2 | Narrow the `generated_books` `.select()` (line 58). Only `brief.childName` + `brief.selectedConcept.title` are used. Select JSON sub-paths: `id, created_at, status, parsed, brief->childName, brief->selectedConcept`. Adjust the `BookBrief`/getters cast accordingly. (If PostgREST JSON-path typing fights the generated `Database` types, fall back to keeping `brief` — this is the lower-priority half of the phase.) |
| F3 / F20 | Add `.limit(25)` to **both** queries (also closes the unbounded-payload DoS vector). |

**Test impact:** `src/test/Dashboard.test.tsx` mocks `useQuery` wholesale, so list-query column changes don't break it. The F1 `resumeDraft` targeted fetch needs a new `select().eq().single()` branch added to the `supabase` mock (line 14–20) + a test asserting resume still seeds deserialized answers.

**Verify B:** `npm test` (Dashboard suite), then preview the dashboard — drafts list renders, resume still rehydrates the wizard, books list renders.

---

## Phase C — Data-fetching robustness

| ID | File | Change |
|---|---|---|
| F6 | `src/App.tsx:33` | Give `new QueryClient` `defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } }`. Removes refetch-on-every-mount and 3× retry storms on edge-fn failures. Dashboard's per-query `staleTime`/`retry` already match, so they become redundant (can keep or drop). |
| F4 | `src/pages/steps/Step8Summary.tsx:76` | Stop re-firing `generate-summary` on back-nav. After a successful `fetchSummary`, persist the concept to context immediately (`setAnswer("selectedConcept", nextConcept)` + a `setAnswer("summaryBriefHash", hash)`) — not only on Continue. On mount, compute the brief hash (reuse the `computeSourceHash` pattern from `src/hooks/useCharacterPortrait.ts:23`) and skip the auto-fetch when the stored hash matches. Guard so user-edited concepts are never clobbered. |
| F5 | `src/pages/steps/Step9Generating.tsx:116` | Replace fixed `setInterval(tick, 3000)` with self-scheduling `setTimeout` using backoff: start 3s, ×1.5 each tick capped at 10s, reset to 3s whenever the progress `key` changes. Keep the existing 90s stall-recovery re-kick and unmount cleanup. |

**Tests:** F4 — add a test that mounting Step8 with a matching cached concept does **not** call `callEdge("generate-summary")`, and that a changed brief **does**. F5 — unit-test the backoff delay sequence (extract the delay calc to a pure helper in `lib/` so it's testable without timers).

**Verify C:** `npm test`; preview Step 8 → navigate forward then back, confirm (via `preview_network` in test mode) no second `generate-summary` call.

---

## Phase D — Bundle size & code splitting

| ID | File | Change |
|---|---|---|
| F12 | `src/App.tsx:13–31` | Convert the 14 step components + `Dashboard`, `Account`, `DevStoryPreview`, `NotFound` to `React.lazy(() => import(...))`. Wrap `<Routes>` in `<Suspense fallback={<LoadingScreen/>}>` (reuse `src/components/LoadingScreen.tsx`). Keep `Login`/`RootRedirect`/layout eager. Add `build.rollupOptions.output.manualChunks` in `vite.config.ts` splitting a `vendor-supabase` and `vendor-react` chunk. Target: drop the 723 kB single chunk well under the 500 kB warning. |
| F13 | `src/App.tsx:29,75` | `DevStoryPreview` is dev-only and unlinked. It's lazy-loaded by F12; additionally gate the route behind `import.meta.env.DEV` so it's excluded from prod entirely. |
| F14 | `package.json` | Remove the 7 tree-shaken unused deps **and** their orphaned `src/components/ui/` wrappers (`chart.tsx`, `carousel.tsx`, `drawer.tsx`, `resizable.tsx`, `calendar.tsx`, `command.tsx`, `input-otp.tsx`). Confirm nothing imports them first (grep showed zero app imports). Hygiene only — no bundle delta expected. |
| F14b | — | **Investigate, likely defer.** `@supabase/storage-js` + transitive `iceberg-js` (~4% of bundle) load via the unified `createClient` even though the app never uses Storage. `src/integrations/supabase/client.ts` is **auto-generated** ("do not edit directly"). Dropping storage means abandoning `createClient` for hand-wired sub-clients (`auth-js` + `postgrest-js` + `functions-js` + `realtime-js`) — fragile, high-maintenance. Recommendation: document the cost, do **not** change it now unless a follow-up ticket justifies it. |

**Verify D:** `npm run build` — inspect chunk list, confirm main chunk shrank and per-route chunks emit; `npm test`; preview each route loads (Suspense fallback flashes, then renders) with no console errors via `preview_console_logs`.

---

## Phase E — Image assets

| ID | File | Change |
|---|---|---|
| F15 | `public/art-styles/cozy-gouache.jpg` (1.8 MB), `public/art-styles/hand-drawn-charm.jpg` (1.9 MB) | Re-encode both to ~768px-wide, quality ~80 JPEG (~150–200 KB) **and** emit `.webp` siblings. One-time op via `npx sharp-cli` (transient — **no project dependency added**). Update `src/pages/steps/Step6ArtStyle.tsx:55` to a `<picture>` with `<source type="image/webp">` + `<img>` JPEG fallback (keep existing `width`/`height`/`loading="lazy"`). The two small styles (geometric-pop 100 KB, papercraft 120 KB) get the same treatment for consistency. |
| F17 | `src/pages/steps/Step1Name.tsx:7–10` | The 4 `book-*.jpg` thumbnails are imported as JS modules (bundled, can't cache independently). Move `src/assets/book-*.jpg` → `public/book-types/` and reference by string path, matching the art-styles convention. Small (~70 KB total) so low priority. |
| F16 | — | **No action — false positive.** Art-style images already have `width={512} height={768}`. Documented only. |

**Verify E:** `npm run build`; preview Step 6 → `preview_network` shows the WebP variants served at ~150–200 KB instead of 1.8 MB; LCP no longer dominated by the cover image (re-run the PerformanceObserver check on Step 6).

---

## Phase F — Edge-function hygiene (non-cold-start)

| ID | File | Change |
|---|---|---|
| F19 | `supabase/functions/generate-book/index.ts:12` + sibling functions | Edge functions import `@supabase/supabase-js@2.45.4` from esm.sh; frontend is on `^2.105.1`. Align the esm.sh pin to a current 2.x across all functions to remove the version skew. Verify `npm run test:deno` still passes. |

**Verify F:** `npm run test:deno`; spot-check one function still deploys/parses (Deno check).

---

## Out of scope

- **F18** — splitting `supabase/functions/_shared/prompts.ts` to cut edge cold-start. Needs Supabase function-log latency data to justify. Separate ticket.
- **F14b storage-js elimination** — documented, deferred (auto-generated client, poor risk/reward).

## Overall verification

After all phases: `npm run lint && npm test && npm run test:deno && npm run build` all green;
bundle main chunk under 500 kB; preview walk-through of login → wizard steps 1–11 with
`preview_console_logs` clean. Then open PR per CLAUDE.md, write PR URL + branch to TIC-7.

---

## Finding-ID reference

| ID | Pass | Severity | Phase |
|---|---|---|---|
| F1 | DB queries | high | B |
| F2 | DB queries | medium | B |
| F3 / F20 | DB queries / DoS | medium | B |
| F4 | Data fetching | medium | C |
| F5 | Data fetching | low | C |
| F6 | Data fetching | low | C |
| F7 | Rendering | high | A |
| F8 | Rendering | low | A |
| F9 | Rendering (bug) | high | A |
| F10 | Rendering | low | A |
| F11 | Rendering | low | A |
| F12 | Bundle | high | D |
| F13 | Bundle | medium | D |
| F14 | Bundle | hygiene | D |
| F14b | Bundle | deferred | D |
| F15 | Assets | high | E |
| F16 | Assets | false positive | E |
| F17 | Assets | low | E |
| F18 | Edge cold-start | **out of scope** | — |
| F19 | Edge hygiene | low | F |
