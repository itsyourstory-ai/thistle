# UX Audit Wizard — Backlog Implementation Plan

## Context

The UX audit in [docs/plans/ux-audit-wizard.md](docs/plans/ux-audit-wizard.md) reviewed the full 11-step
book-creation wizard and produced a prioritized 15-item fix backlog (the table at the end of that doc).
This plan implements **all 15 items**. The highest-value issues are structural rather than cosmetic:
a mobile header that overlaps, a checkout that asks for payment before honestly showing what exists,
inconsistent navigation chrome across the AI steps, weak progress orientation, and a few error-recovery gaps.

Decisions confirmed with the user before planning:
- **#3 (chrome):** Full refactor — migrate steps 8–11 onto the shared `WizardShell`.
- **#10 (step 7 upsell):** Soften only — make "Continue anyway" the primary dialog action; leave the $3 upsell in place.
- **#14 (Spanish):** Hide the "Español" tile (fold it into the existing "More coming soon" treatment); add a name `maxLength`.
- **#5 (step 11 CTA):** Improve copy + keep the email payoff. Add story-stage feedback and make "Create another book"
  a softer secondary action. Do **not** build or link a book-view page (deferred as its own feature).

## Key files

Shared chrome:
- [src/components/WizardShell.tsx](src/components/WizardShell.tsx) — shared header + bottom bar (Back/Skip/Continue), `onBeforeContinue` gate, `canContinue` from context.
- [src/components/WizardHeader.tsx](src/components/WizardHeader.tsx) — header; the `absolute left-1/2 -translate-x-1/2` ProgressBar that overlaps "Save & exit".
- [src/components/ProgressBar.tsx](src/components/ProgressBar.tsx) — 11 dots, `STEP_LABELS`, `PROGRESS_MESSAGES`, tap-to-jump, hover tooltips.
- [src/contexts/WizardContext.tsx](src/contexts/WizardContext.tsx) — `canContinue`/`setCanContinue`, `isGenerating`.
- [src/lib/wizardSteps.ts](src/lib/wizardSteps.ts) — `TOTAL_STEPS`, `pathForStep`, step map.

Steps (`src/pages/steps/`): `Step1Name.tsx`, `Step2Buyer.tsx`, `Step3Genre.tsx`, `Step4Lesson.tsx`,
`Step5Interests.tsx`, `Step7Character/index.tsx`, `Step7Character/FormPrimitives.tsx`,
`Step8Summary.tsx`, `Step9Cast.tsx`, `Step10Preview.tsx`, `Step9Generating.tsx` (serves step 11).

---

## Phase 1 — Shared foundations

### Task 1 — Global header & progress (#1 High, #7 Med)
**Files:** `WizardHeader.tsx`, `ProgressBar.tsx`

- **#1 Mobile header overlap:** Remove the `absolute left-1/2 -translate-x-1/2` wrapper around `<ProgressBar>`.
  Lay the header out as a 3-column grid (`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center`): left spacer,
  center progress (`min-w-0 flex justify-center`), right actions. The center column now reserves real space and
  can shrink, so the caption no longer runs under "Save & exit" at 375px. Add `truncate`/`max-w-full` to the
  caption span so long messages clip rather than collide.
- **#7 Progress orientation (in `ProgressBar.tsx`):**
  - **Distinguish current step.** Today `i < currentStep` fills completed *and* current identically. Use three
    states: completed (`stepNum < currentStep`) solid primary; **current** (`stepNum === currentStep`) distinct —
    wider (e.g. `w-8`) + solid primary; future (`stepNum > currentStep`) faded `/0.15`.
  - **"Step X of N" + visible label.** Replace the hover-only label problem by rendering a visible line, e.g.
    `Step {currentStep} of {TOTAL_STEPS} · {STEP_LABELS[currentStep]}`, alongside/under the existing encouragement
    caption. Keep tooltips for desktop but no longer rely on them.
  - **No forward jumps.** Only allow tapping dots for `stepNum <= currentStep` (already-valid/visited steps).
    Future dots: not clickable, `cursor-default`, `tabIndex={-1}`, `aria-disabled`. Keep the existing
    `isGenerating` lock.
  - **Touch target.** Wrap each dot in a larger padded hit area (≈`py-2` / min 32px tall) while keeping the
    2px visual bar, so taps are reliable on mobile.
- **Tests:** ProgressBar render tests — current step has distinct style; future dots are non-navigable; "Step X of N"
  text present. Header: assert no absolute-centered progress (snapshot or class check is acceptable).

### Task 2 — Extend `WizardShell` API (foundational for #3 and #8)
**Files:** `WizardShell.tsx`

Add three optional props so the AI steps and disabled-reason hints can share the one shell:
- `continueLabel?: string` (default `"Continue →"`) — used by steps 9 ("Approve & continue →") and 10 ("Pay {price} & start crafting").
- `missingHint?: string` — small muted text rendered just above the bottom bar **only when `!canContinue`**. Used by #8.
- `footer?: ReactNode` — when provided, replaces the default Back/Skip/Continue bar entirely (keeps the header).
  Used by step 11, whose CTAs are state-dependent (generating / done / error).

The existing `onBeforeContinue` async gate already supports steps 9/10 doing work (set answer / validate + pay)
before `goNext()` navigates. No context changes needed.
- **Tests:** WizardShell renders `continueLabel`; `missingHint` shows only when disabled; `footer` replaces the default bar.

---

## Phase 2 — AI steps onto the shell (depend on Task 2) (#3 Med + bundled fixes)

Each step keeps `<WizardHeader>` (already shared) and now wraps its body in `<WizardShell>`, deleting its
hand-rolled bottom bar. Replace raw styled `<button>`s with the shared `Button` component.

### Task 3 — Step 8 onto shell + friendly error recovery (#6 Med, #13 Low)
**Files:** `Step8Summary.tsx`
- Migrate to `WizardShell`; drive `setCanContinue(!!summary && !loading && !editing)`.
- **#6:** Replace the raw error string (`<p>{error}</p>`) with friendly copy matching steps 9/11 (e.g.
  "We couldn't craft the story just yet. Try again, or write it yourself."). Add a **non-dead-end path**: when the
  first generation fails (no prior summary), offer an explicit "Write it manually" affordance that opens the editor
  so the user is never stranded behind a disabled Continue. Keep Regenerate.
- **#13:** This is the main offender for raw error copy; while here, confirm the toast description also uses
  friendly tone. (Steps 9/11 already friendly — no change expected there.)
- **Tests:** failed first generation shows friendly copy + a manual-entry path; Continue enabled once a summary exists and not editing.

### Task 4 — Step 9 onto shell + cover gate + surprise-name portraits (#4 Med, #12 Low)
**Files:** `Step9Cast.tsx`
- Migrate to `WizardShell` with `continueLabel="Approve & continue →"`; move the existing `approve()` logic into
  `onBeforeContinue` (set `selectedConcept`, then shell navigates to step 10).
- **#4:** Gate `canContinue` on `cover.status === "ready"` (and ideally portraits settled). Use `missingHint`
  like "Waiting for the cover to finish…" when not ready, instead of silently allowing approval with a missing cover.
- **#12:** The portrait grid filters `c?.id && c?.name`, hiding surprise-named supporting characters that still
  appear in the final book. Show a card for them (e.g. labelled "A surprise friend 🎁") or otherwise reconcile
  preview with output.
- **Tests:** Approve disabled until cover ready; surprise-name character renders a portrait card.

### Task 5 — Step 10 onto shell (adds Back) + honest checkout copy (#2 High, #3 Back button)
**Files:** `Step10Preview.tsx`
- Migrate to `WizardShell` — this automatically restores a **Back button** (currentStep 10 > 1), closing the #3
  step-10 gap. Set `continueLabel` to the dynamic "Pay {price} & start crafting"; move buyer name/email validation
  + pay into `onBeforeContinue`.
- **#2:** Re-word the heading/subhead to set honest expectations. Current "{name}'s book is ready." / "Preview the
  book and choose how you'd like it delivered." oversells (only the cover exists pre-payment). Reframe to something
  like "{name}'s story is ready to print." with a subhead that states the cover + story are shown now and **every
  inside page is reviewable and editable after checkout** — make that post-checkout promise prominent (promote the
  existing reassurance box), not buried.
- **Tests:** Back button present on step 10; pay blocked until name/email valid; updated copy assertions.

### Task 6 — Step 11 feedback + finish moment (#5 Med)
**Files:** `Step9Generating.tsx`
- Wrap in `WizardShell` using the `footer` override (its CTAs are state-dependent and live in the body).
- **Story-stage feedback:** Today the bar only renders when `progress && progress.total > 0`, so the initial
  story-writing stage shows no bar. Add an **indeterminate bar or stage label** ("Writing {name}'s story…" as a
  labelled stage) so the slowest part doesn't read as stuck.
- **Finish moment:** Keep the email payoff. Make success a proper celebration that reinforces "We've emailed
  everything to {email}", with **"Create another book"** as a softer **secondary** action (not the lone CTA, and
  not auto-routing to step 1 as the only path). Do not add a book-view link (deferred).
- **Tests:** indeterminate/stage feedback renders during the pre-`total` stage; success state shows email payoff + secondary "Create another book".

---

## Phase 3 — Selection-step fixes

### Task 7 — Disabled-Continue reasons (#8 Med)
**Files:** `Step1Name.tsx`, `Step2Buyer.tsx`, `Step3Genre.tsx`, `Step4Lesson.tsx`, `Step7Character/index.tsx`
- Each step passes a computed `missingHint` to `WizardShell` (from Task 2), shown only while Continue is disabled.
- **Step 3 is the priority:** mood is required but below the fold. When a genre is picked but no mood, show
  "Almost there — choose a mood below 👇"; when no genre, "Choose a genre to continue." Consider scrolling/anchoring
  the mood section into view on genre select.
- **Tests:** hint text appears when required fields missing (extend `src/test/stepValidation.test.tsx`).

### Task 8 — Step 1: hide Español + name maxLength (#14 Low)
**Files:** `Step1Name.tsx`
- Move "Español" out of the active language tiles into the existing "More coming soon" treatment (so it's no longer
  selectable). Ensure no step depends on `language === "español"`.
- Add a sensible `maxLength` (e.g. 40) to the name `<Input>`.
- **Tests:** name input enforces maxLength; Español not selectable.

### Task 9 — Step 5 interests polish (#11 Low)
**Files:** `Step5Interests.tsx`
- **Emoji parity:** give custom-typed interest pills a default emoji (e.g. ✨) so the pill row isn't mismatched
  against suggestion pills.
- **Inclusivity:** add a non-binary (and/or neutral fallback) entry to `BOOST_BY_GENDER` so gender-neutral children
  get tailored suggestions instead of the age-only base list.
- **Copyright note:** raise visibility (move up / increase from `text-xs`, or add an icon) so it's not missed.
- **Tests:** custom pill renders an emoji; non-binary yields boosted suggestions.

### Task 10 — Step 2 tile polish (#15 Low/XS)
**Files:** `Step2Buyer.tsx`
- Even out tile heights so "Someone else" wrapping to two lines doesn't make its tile taller than row-mates
  (e.g. fixed min-height / consistent line clamp).
- De-duplicate the ✨ emoji reused by both "Someone else" (relationship) and "Other" (occasion) — give one a
  distinct emoji.
- **Tests:** light — assert distinct emojis; visual height parity verified via preview.

### Task 11 — Step 7: photo validation + softened nudge (#9 Med, #10 Med→soften)
**Files:** `Step7Character/FormPrimitives.tsx`, `Step7Character/index.tsx`
- **#9:** In `handleFiles`, validate **type and size** (not just count) on the drag-and-drop path before
  `FileReader.readAsDataURL` — reject non-images and oversized files with a friendly toast. Add a `FileReader.onerror`
  handler. (`accept="image/*"` only filters the picker, not drops.)
- **#10 (soften only):** In the "Continue without any extra characters?" dialog, make **"Continue anyway"** the
  primary (`variant="wizard"`) action and "Add a character" the secondary/outline. Leave the $3 third-character
  upsell where it is.
- **Tests:** non-image / oversized dropped files are rejected; valid images accepted; dialog primary is "Continue anyway".

---

## Execution & verification

This is large; execute via `/execute-plan` with clones. Suggested batching/ordering:
1. **Task 1** and **Task 2** first (foundations — Phase 2 & 3 depend on Task 2's `WizardShell` props).
2. After Task 2 lands: Tasks 3–6 (one step file each — parallelizable) and Tasks 7–11 (one step file each — parallelizable).
Keep each clone to a single step/area so file ownership doesn't overlap (Task 7 and Task 8 both touch `Step1Name.tsx`
— run them in sequence or merge those two edits in one clone). Max ~7 files per check-in.

**Per project rules (non-negotiable):**
- TDD: write the vitest test first, then implement, for every behavior change.
- After each task: `npm test` (and `npm run lint`).
- After multi-file edits / before merge: `npm run build` to catch TypeScript errors.

**End-to-end manual verification (preview MCP, dev auth bypass + seed profiles from `src/lib/devSeeds.ts`):**
- Mobile (375px) and desktop: confirm header no longer overlaps "Save & exit" on every step (#1).
- Walk the flow: current-step dot is visually distinct, "Step X of N" visible, forward dots not tappable (#7).
- Step 3: pick only a genre → hint points to mood below the fold (#8).
- Steps 8–11: consistent bottom bar; step 10 has a Back button; step 8 forced-error shows friendly copy + manual path;
  step 9 Approve disabled until cover ready; step 11 shows story-stage feedback and a celebratory finish with a
  secondary "Create another book" (#2, #3, #4, #5, #6).
- Step 7: drag-drop a non-image/large file → rejected; no-characters dialog primary is "Continue anyway" (#9, #10).
