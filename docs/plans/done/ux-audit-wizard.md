# UX Audit — Book Creation Wizard (TIC-6)

**Type:** Chore / Research
**Date:** 2026-06-16
**Scope:** The full book-creation wizard, end to end.
**Method:** Live walkthrough of every step using dev auth bypass + the built-in
test-mode seed profiles (`src/lib/devSeeds.ts`), with desktop and mobile
(375 px) viewports, plus a code review of each step component and its
loading / error / empty states. AI-generation steps (8, 9, 11) were exercised
with mocked responses and a forced-error toggle so loading and failure states
could be observed.

> **Note on screenshots.** Screenshots were captured live during the audit and
> are described inline with each finding. The preview tooling returns images to
> the review session rather than to disk, so they are not embedded as files
> here. They can be re-captured or attached to the Notion ticket on request.

---

## Summary

The wizard is, on the whole, **well-crafted and warm** — strong personalization
(child's name woven through headings and copy), consistent visual language on
the selection steps (1–6), thoughtful loading messages, and good draft
persistence (going **Back never loses data**). The highest-value issues are not
visual polish but **structural**: a mobile header that overlaps, an
expectation gap at checkout, inconsistent navigation chrome across the AI steps,
and a few wait-time / error-recovery gaps at the highest-stakes moments.

### The flow has grown to 11 steps, not 10

The ticket lists 10 steps; the live app has **11**, and the later route slugs
have shifted. This drift is itself worth noting (docs/tickets are stale). Actual
flow:

| # | Route | Component | Purpose |
|---|---|---|---|
| 1 | `/step/1-name` | `Step1Name.tsx` | Name / age / gender / language |
| 2 | `/step/2-buyer` | `Step2Buyer.tsx` | Buyer relationship + occasion |
| 3 | `/step/3-genre` | `Step3Genre.tsx` | Genre + mood |
| 4 | `/step/4-lesson` | `Step4Lesson.tsx` | Life lesson |
| 5 | `/step/5-interests` | `Step5Interests.tsx` | Interests (optional) |
| 6 | `/step/6-art-style` | `Step6ArtStyle.tsx` | Art style |
| 7 | `/step/7-character` | `Step7Character/index.tsx` | Protagonist + supporting cast + photos |
| 8 | `/step/8-story` | `Step8Summary.tsx` | AI story concept + title (editable) |
| 9 | `/step/9-cast` | `Step9Cast.tsx` | AI cover + character portraits |
| 10 | `/step/10-preview` | `Step10Preview.tsx` | Plan selection + checkout |
| 11 | `/step/11-generating` | `Step9Generating.tsx` | Full book generation + progress |

(Filename/route offset: `Step9Generating.tsx` serves step 11.)

### Top themes (detailed below)

1. **Mobile header overlap** — the shared header collides on narrow screens. *(High)*
2. **Checkout expectation gap** — "your book is ready / preview the book" but only the cover exists; the user pays before seeing inside pages. *(High)*
3. **Inconsistent chrome on steps 8–11** — each hand-rolls its own header and bottom bar; step 10 has no Back button. *(Medium)*
4. **Wait-time & error-recovery gaps** at the AI moments (steps 8, 9, 11). *(Medium)*
5. **Progress/orientation** — no "Step X of 11", current step indistinct from completed, hover-only tooltips. *(Medium)*

---

## Cross-cutting findings

These span every step (shared components: `WizardShell.tsx`,
`WizardHeader.tsx`, `ProgressBar.tsx`).

- **[HIGH] Mobile header overlaps.** In `WizardHeader.tsx` the `ProgressBar`
  (dots **and** the caption text) is `absolute left-1/2 -translate-x-1/2`, i.e.
  full-width-centered, while "Save & exit" is right-aligned in normal flow. At
  375 px the caption ("Let's meet the star of the show ⭐") runs straight through
  / under "Save & exit" (which is clipped at the right edge). The dev-only "Skip
  step" / "🧪 test" buttons make it worse, but the **caption ↔ Save & exit
  collision persists in production**. Observed on step 1; structural, so it
  affects all 11 steps.
- **[MED] Progress orientation is weak.** `ProgressBar.tsx` renders 11 dots
  (24 × 8 px). The current step's dot is filled the same as completed dots
  (`i < currentStep`), so there's no distinct "you are here." There's no
  numeric "Step X of 11." Step names live only in **hover tooltips**, which are
  invisible on touch. The dots are also `cursor-pointer` and navigate to **any**
  step on click — including jumping *forward* into not-yet-valid or AI steps —
  on an 8 px-tall touch target.
- **[MED] Inconsistent navigation chrome.** Steps 1–7 use `WizardShell` (one
  shared bottom bar with Back / Skip / Continue built from the `Button`
  component, plus a dev-skip). Steps 8–11 each **hand-roll** their own
  `WizardHeader` + bottom bar with raw styled `<button>`s. Result: subtly
  different button shapes/padding, and **step 10 has no Back button at all**
  (see step 10). Consolidating would reduce drift and bugs.
- **[MED] Disabled "Continue" never says why.** Across steps 1–4 and 7 the
  Continue button greys out (`disabled:opacity-40`) until required fields are
  set, but nothing tells the user *what* is missing. Most acute on step 3 (see
  below), where the second required choice is below the fold.
- **[LOW] Error copy is inconsistent.** Step 8 surfaces the **raw** error string
  (e.g. "Empty summary returned.", and in test mode "[test mode] Forced error on
  generate-summary") in red. Steps 9 and 11 use friendly copy ("Couldn't draw
  the cover.", "We had a little trouble crafting the book… your order is safe.").
  Standardize on the friendly tone.
- **[POSITIVE] Data persistence is solid.** Back-navigation preserves all
  answers (in-memory `WizardContext`), and `useDraftPersistence` debounce-saves
  drafts. No data loss observed going Back.

---

## Per-step findings

### Step 1 — Name / age / gender / language (`Step1Name.tsx`)
*Empty and filled states reviewed, desktop + mobile.*

- **[LOW] "Español" is selectable but its support is unclear.** If end-to-end
  Spanish generation isn't wired, this is a broken promise sitting next to a
  "More coming soon" tile. Verify the pipeline honors `language`.
- **[LOW] No max length on the name input.** Long names (tested with
  "Bartholomew-James") risk overflow in downstream headings/cards.
- **[POSITIVE]** Heading personalizes on input ("Let's make a book for Leo.");
  age is collected via book-format tiles with ages labelled — clever and clear.

### Step 2 — Buyer relationship + occasion (`Step2Buyer.tsx`)

- **[LOW] Minor tile inconsistencies.** "Someone else" wraps to two lines,
  giving that tile a taller height than its row-mates; the ✨ emoji is reused for
  both "Someone else" (relationship) and "Other" (occasion).
- **[POSITIVE]** Warm framing ("What a thoughtful gift 💛"), copy explains the
  *why* ("we'll use it to write the perfect dedication").

### Step 3 — Genre + mood (`Step3Genre.tsx`)

- **[MED] Two required choices, second one below the fold.** Genre (10 options)
  fills the viewport; **Mood (6 options) is required but off-screen**. A
  first-timer can pick a genre, see Continue still disabled, and get no hint
  that a second required section exists lower down. Pairs with the cross-cutting
  "disabled Continue gives no reason" issue — consider an inline cue or a
  "next: choose a mood" affordance.
- **[LOW]** Tall tiles with generous whitespace lengthen the scroll.

### Step 4 — Life lesson (`Step4Lesson.tsx`)

- Clean and consistent with step 3. "Just for fun — no lesson needed" is a good
  escape hatch. No notable issues.

### Step 5 — Interests (`Step5Interests.tsx`)

- **[LOW] Pill inconsistency.** Suggestion-added interests carry an emoji;
  custom-typed interests don't, so the pill row looks mismatched (observed: the
  seeded "dragons / climbing trees / dinosaurs" pills render without emoji).
- **[LOW] Gender-neutral children get less-tailored suggestions.**
  `BOOST_BY_GENDER` only has `girl`/`boy` boosts; non-binary falls back to the
  age-only base list. Minor inclusivity gap.
- **[LOW] Copyright guidance is easy to miss** — it's `text-xs` at the very
  bottom, and nothing validates against brand/character names that the AI is
  asked to avoid.
- **[POSITIVE]** Genuinely optional (Skip shown), age/gender-aware suggestions,
  clear max-3 messaging ("That's plenty — 3 is the sweet spot ✨").

### Step 6 — Art style (`Step6ArtStyle.tsx`)

- **[POSITIVE]** Large preview images are the right call for a visual decision;
  auto-defaults sensibly from genre. No notable issues.

### Step 7 — Protagonist + supporting cast + photos (`Step7Character/`)
*The heaviest step in the flow.*

- **[MED] Highest effort-vs-payoff risk / likely drop-off.** A full form —
  photo upload + name + age + gender + up-to-2 personality traits + an
  appearance accordion (hair colour/style, skin tone, glasses, free-text
  features) — is repeated **per character** (hero + up to two supporting). This
  is by far the heaviest ask in the wizard and the most probable abandonment
  point.
- **[MED] "Continue without any extra characters?" nudges extra work.** When the
  user has no supporting cast, Continue opens a dialog whose **primary** button
  is "Add a character" and whose **secondary/outline** button is "Continue
  anyway" — pushing more work on what is an optional step.
- **[MED] Mid-flow upsell.** Adding a 3rd character triggers a "$3.00 (simulated)"
  upsell dialog *before* checkout. Injecting a paywall into the creative flow can
  feel like a pricing surprise; consider surfacing add-on pricing at checkout
  instead.
- **[MED] Photo upload has almost no validation** (`FormPrimitives.tsx`,
  `handleFiles`). Only the **count** is enforced (`Maximum 3 photos` toast).
  `accept="image/*"` filters the file *picker* only — the **drag-and-drop path
  reads any dropped file** via `FileReader` with no type or size check. Large or
  non-image files can be ingested, bloating the draft payload and slowing
  portrait generation.
- **[LOW] Age re-entry.** Step 1 already collected an age range; step 7 requires
  a specific age again as a separate required field — minor redundancy.
- **[LOW] "Upload 2–3 photos … for best results"** implies a floor of 2, but
  0–1 photos are accepted (imagined hero). Fine, but the copy implies a minimum.
- **[POSITIVE]** Tabbed cast "pill bar," genuinely inclusive appearance options
  (placeholder names "hearing aid, uses a wheelchair"), and portrait generation
  is warmed in the background.

### Step 8 — AI story concept + title (`Step8Summary.tsx`)
*Loading, ready, and forced-error states observed.*

- **[MED] A failed first generation can strand the user.** Continue is
  `disabled={!summary || loading || editing}`. If the *first* generation fails
  (no prior summary), the only recovery is Regenerate; if it keeps failing the
  user is stuck, and the message shown is the raw technical error (see
  cross-cutting error-copy note). Consider a friendly error + an explicit
  retry/"edit manually" path that doesn't dead-end.
- **[LOW] Regenerate feedback is subtle.** With an existing summary, Regenerate
  only dims the card behind a translucent overlay (the skeleton appears only on
  first load), so it's easy to miss that anything happened.
- **[LOW] Unlimited regenerate** — each is a real generation call; fine for UX,
  flagged for cost awareness.
- **[POSITIVE]** Auto-generates on arrival, skeleton + rotating messages,
  fully editable title/summary with word-count guidance ("aim for ~150 words"),
  and a "Your story details" recap of prior answers.

### Step 9 — Cover + character portraits (`Step9Cast.tsx`)
*Ready and per-asset loading states observed.*

- **[MED] "Approve & continue" isn't gated on the cover being ready.** The
  button is only `disabled={approving}`. A user can approve while the cover is
  still loading or after it errored; `approve()` then falls back to any prior
  `coverImage`, or proceeds with none. Gate on cover (and ideally portraits)
  status, or at least warn.
- **[LOW] Surprise-name characters vanish from the preview.** The portrait grid
  filters to `c?.id && c?.name`, so a supporting character with a withheld
  ("surprise") name shows **no** portrait card here even though they appear in
  the final book — an inconsistency between preview and output.
- **[POSITIVE]** Each asset has clean ready/loading/error states with friendly
  "Try again" retries, a lightbox zoom, and the cover auto-kicks once its
  dependencies are ready.

### Step 10 — Plan selection + checkout (`Step10Preview.tsx`)

- **[HIGH] Expectation gap: you pay before seeing the book.** The page is titled
  **"{name}'s book is ready."** with subhead **"Preview the book and choose how
  you'd like it delivered,"** but only the **cover** is shown — the inside pages
  don't exist yet (they're generated in step 11, *after* payment). The
  reassurance box does promise post-checkout page review and edits, but the
  framing ("ready", "preview the book") oversells what's actually visible and
  asks for $9.99–$44.99 on the strength of a cover + the step-8 text summary.
  Re-word to set honest expectations (and/or show more before payment).
- **[MED] No Back button.** Unlike steps 8 and 9, this custom step has no
  bottom-bar Back control. To revisit the cover or tweak the story, the user
  must use the tiny progress dots or the browser back button — friction at the
  highest-stakes screen, and inconsistent with neighbouring steps.
- **[LOW] Defaults to the most expensive plan.** Hardcover ($44.99) is
  pre-selected ("⭐ Most popular"). Common pattern; flagged for awareness.
- **[POSITIVE]** Inline name/email validation, trust signals, a strong
  testimonial, and a clear two-plan comparison.

### Step 11 — Full generation + progress (`Step9Generating.tsx`)
*Loading state observed (mocked).*

- **[MED] The longest wait has the least feedback.** The progress bar only
  renders once `progress && progress.total > 0` (the pages/portraits stage).
  During the **initial story-writing stage** there's no bar and no "step X of Y"
  — just the animation and a rotating message ("Writing Leo's story…"), which
  can read as stuck on the slowest part of the pipeline.
- **[MED] Anticlimactic finish.** On success the only CTA is "🎉 Back to start"
  (→ step 1, a brand-new book). There's no "view my book" / dashboard link, and
  delivery is email-only, so the moment of payoff sends the user back to the
  beginning rather than to what they just created.
- **[LOW] "Save & exit" stays live during generation.** `isGenerating` locks the
  progress-dot navigation but not the header's "Save & exit," so a user can
  still navigate away mid-generation.
- **[POSITIVE]** Rich animated book + sparkles, a friendly error state with
  "Try again" / "Back to checkout" / "your order is safe," automatic 90 s stall
  recovery (re-kicks image generation), and a `MIN_DURATION` floor so the
  animation never feels cut short.

---

## Prioritized fix backlog

Ordered by severity, then breadth of impact. Each row is scoped to become its
own ticket.

| # | Sev | Effort | Area | Recommended fix |
|---|-----|--------|------|-----------------|
| 1 | High | S–M | Global header | Fix `WizardHeader` mobile layout so the centered progress + caption never overlap "Save & exit" (e.g. stack the caption, or reserve space / drop the absolute-center on small screens). Affects all 11 steps. |
| 2 | High | S–M | Step 10 | Close the checkout expectation gap: re-word "your book is ready / preview the book" to match what's shown (cover only), make the "review every page after checkout" promise prominent, and/or surface more pre-payment. |
| 3 | Med | M | Steps 8–11 | Unify the AI-step chrome into a shared shell (consistent header + bottom bar + button component); in particular **add a Back button to step 10**. |
| 4 | Med | S | Step 9 | Gate "Approve & continue" on the cover being `ready` (and ideally portraits), or warn before proceeding with a missing cover. |
| 5 | Med | M | Step 11 | Add feedback during the story stage (indeterminate bar or stage label) and replace the lone "Back to start" with a "view your book" / dashboard CTA. |
| 6 | Med | S–M | Step 8 | Friendly error copy + a non-dead-end recovery path when the first generation fails. |
| 7 | Med | M | Global progress | Add "Step X of 11", visually distinguish the current step, and reconsider tap-to-jump-forward + the 8 px touch target / hover-only labels. |
| 8 | Med | S | Steps 1–4, 7 | When Continue is disabled, indicate what's missing (esp. step 3's below-the-fold "mood"). |
| 9 | Med | S | Step 7 | Validate photo uploads on the drag-drop path (file type + size), not just count. |
| 10 | Med | M | Step 7 | Lighten the heaviest step: reconsider the "are you sure?" nudge for the optional cast and the mid-flow $3 upsell (move add-on pricing to checkout). |
| 11 | Low | S | Step 5 | Emoji parity for custom interest pills; add gender-neutral suggestion boosts; raise the visibility of the copyright note. |
| 12 | Low | S | Step 9 | Show surprise-name supporting characters in the portrait grid (or clarify why they're hidden). |
| 13 | Low | S | Global | Standardize error copy to the friendly tone used on steps 9/11. |
| 14 | Low | S | Step 1 | Confirm/Spanish-support for "Español"; add a sensible max length to the name input. |
| 15 | Low | XS | Step 2 | Even out tile heights ("Someone else" wraps); de-duplicate the ✨ emoji. |

---

## Acceptance criteria check

- [x] All 11 steps reviewed against the cross-cutting checklist (clarity,
  progress/orientation, effort vs payoff, error/empty states, wait-time,
  mobile/touch, consistency, flow).
- [x] Findings documented with severity (High / Med / Low). Screenshots captured
  live and described inline (see note at top re: file embedding).
- [ ] Prioritized fix list delivered **and reviewed** — pending your review.
