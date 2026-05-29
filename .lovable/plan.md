## Goal

Make the wizard self-documenting: every step has a **number + semantic name** baked into both its filename and its URL slug. After the change:

- `src/pages/steps/Step1Name.tsx` is served at `/step/1-name`
- `src/pages/steps/Step6ArtStyle.tsx` is served at `/step/6-art-style`
- …etc. Top-to-bottom file listing reads as the wizard flow.

## Final mapping

| URL | Filename | Old filename | What it is |
|---|---|---|---|
| `/step/1-name` | `Step1Name.tsx` | `Step1.tsx` | Child's name |
| `/step/2-buyer` | `Step2Buyer.tsx` | `StepWhoIsItFor.tsx` | Who's it for? |
| `/step/3-genre` | `Step3Genre.tsx` | `Step2.tsx` | Genre / mood |
| `/step/4-lesson` | `Step4Lesson.tsx` | `Step3.tsx` | Lesson / value |
| `/step/5-interests` | `Step5Interests.tsx` | `Step4b.tsx` | Interests |
| `/step/6-art-style` | `Step6ArtStyle.tsx` | `Step7.tsx` | Illustration style |
| `/step/7-character` | `Step7Character.tsx` | `Step6.tsx` | Character / photo upload |
| `/step/8-summary` | `Step8Summary.tsx` | `Step10Summary.tsx` | Story summary |
| `/step/9-generating` | `Step9Generating.tsx` | `Step10.tsx` | Generating animation |
| `/step/10-preview` | `Step10Preview.tsx` | `Step11.tsx` | Book preview |
| `/step/secret-ingredient` | `StepSecretIngredient.tsx` | `Step5.tsx` | Hidden route (unchanged URL) |
| *(fallback)* | `StepPlaceholder.tsx` | *(unchanged)* | Catch-all |

## Architecture change: single source of truth for step order

Right now, `WizardShell` and `ProgressBar` both parse `/^\/step\/(\d+)$/` and hard-code `TOTAL_STEPS = 10`, and several pages hard-code paths like `navigate("/step/9")`. We need to centralize this so slug URLs work and nothing drifts.

**New file: `src/lib/wizardSteps.ts`**

```ts
export const WIZARD_STEPS = [
  { num: 1,  slug: "1-name",        path: "/step/1-name" },
  { num: 2,  slug: "2-buyer",       path: "/step/2-buyer" },
  { num: 3,  slug: "3-genre",       path: "/step/3-genre" },
  { num: 4,  slug: "4-lesson",      path: "/step/4-lesson" },
  { num: 5,  slug: "5-interests",   path: "/step/5-interests" },
  { num: 6,  slug: "6-art-style",   path: "/step/6-art-style" },
  { num: 7,  slug: "7-character",   path: "/step/7-character" },
  { num: 8,  slug: "8-summary",     path: "/step/8-summary" },
  { num: 9,  slug: "9-generating",  path: "/step/9-generating" },
  { num: 10, slug: "10-preview",    path: "/step/10-preview" },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;
export const pathForStep = (n: number) => WIZARD_STEPS[n - 1]?.path ?? "/step/1-name";
export const stepNumFromSlug = (slug?: string) =>
  WIZARD_STEPS.find(s => s.slug === slug)?.num ?? 1;
```

## Approach

**Pass 1 — Two-phase rename of step files** (must use `_tmp` intermediate because new names collide with old names):
- Move each old file to `<NewName>_tmp.tsx`, then strip `_tmp`.

**Pass 2 — `src/App.tsx`:** rewrite imports + routes in order. Routes use the new slug paths. Add **legacy redirects** so existing `/step/1`…`/step/10` URLs still work:

```tsx
<Route path="/step/1-name" element={<Step1Name />} />
... (2-10 in order)
<Route path="/step/secret-ingredient" element={<StepSecretIngredient />} />
{/* Legacy numeric redirects */}
{WIZARD_STEPS.map(s => (
  <Route key={s.num} path={`/step/${s.num}`}
         element={<Navigate to={s.path} replace />} />
))}
<Route path="/step/:step" element={<StepPlaceholder />} />
```

**Pass 3 — Update all internal navigation** to use `pathForStep(n)` / step constants from `wizardSteps.ts`:

- `src/components/WizardShell.tsx` — replace regex + hardcoded `TOTAL_STEPS = 10` with `stepNumFromSlug(useParams().step)` and `pathForStep(currentStep ± 1)`.
- `src/components/ProgressBar.tsx` — drop local `TOTAL_STEPS`, import from `wizardSteps`, navigate via `pathForStep(stepNum)`.
- `src/pages/Login.tsx` — `navigate("/step/1")` → `navigate(pathForStep(1))` (3 spots).
- `src/pages/steps/Step10.tsx` (becomes `Step9Generating.tsx`) — `/step/10` → `pathForStep(10)`, `/step/8` → `pathForStep(8)`.
- `src/pages/steps/Step10Summary.tsx` (becomes `Step8Summary.tsx`) — `/step/9` → `pathForStep(9)`, `/step/7` → `pathForStep(7)`.
- `src/pages/steps/Step11.tsx` (becomes `Step10Preview.tsx`) — `/step/1` → `pathForStep(1)`.

## Why this works without breaking anything

- All component name references outside the step files are isolated to `src/App.tsx` (verified with grep).
- All hard-coded `/step/N` URLs are in 6 known files (verified with grep) — every one gets replaced with `pathForStep()`.
- The legacy `/step/N` → `/step/N-slug` redirects mean any bookmarked URL, deep link, or stale reference still lands on the right step.
- The progress bar's "current step" math still works because it reads `currentStep` from a derived helper, not from a regex on the URL.

## Out of scope (per earlier answer)

- Portrait deferral (removing `useCharacterPortrait` from Step 7 character). Will be handled in a follow-up.
- Step content / behavior — pure rename + URL refactor.

## Verification

1. App builds.
2. Visit each new URL (`/step/1-name` … `/step/10-preview`) — correct content renders.
3. Visit legacy `/step/3` → URL bar updates to `/step/3-genre`.
4. Progress-bar dots clickable & navigate to slug URLs.
5. Login → continues to `/step/1-name`. Step 10 "start over" → `/step/1-name`.
6. Step 8 approve → Step 9. Step 9 finish → Step 10. Back buttons work.
