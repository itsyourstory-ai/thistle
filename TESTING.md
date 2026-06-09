# Testing the Wizard Locally

## Manual testing (the main loop)

The wizard has a **🧪 test: off** pill in the header next to "⚙ dev: skip step". Clicking it opens the test panel. All controls below live there.

### What each control does

| Control | What it does |
|---|---|
| **Test mode toggle (on/off)** | When ON, all 6 AI edge functions return instant fake responses instead of calling Supabase. Walk the entire wizard for $0. |
| **Seed profile dropdown** | Picks which of the 4 pre-filled child profiles to load. Each has very different shape: photo vs no-photo, supporting characters, edge-case names, special pet. |
| **Load & go → (step picker + button)** | Fills all wizard answers from the selected profile AND navigates to the chosen step. Start at any step instantly without re-typing anything. |
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
5. Pick a step (e.g. Step 8: story)
6. Click "Load & go →"  — the wizard jumps to Step 8 with all answers filled
7. Click through to the end — cover, cast, generating, preview all work with fake data
8. Toggle test mode OFF to run a real generation when you need it
```

### The 4 seed profiles

| Profile | Child | Shape |
|---|---|---|
| **Classic — Leo** | Boy, 6, watercolor | Photo uploaded, 2 supporting chars (Mom + dog), full traits |
| **Minimal — Priya** | Girl, 4, cartoon | No photo, no supporting cast, sparse fields |
| **Edge text — Bartholomew-James** | Boy, 8 | Long names, 8 interests, surprise-name supporting char, fox pet |
| **Special pet — River** | Non-binary, 5 | Magic cat (Mochi), grandma supporting char, soft painterly style |

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
