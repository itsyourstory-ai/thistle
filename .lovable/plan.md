## Goal

Unify the two "type-or-pick chip" pickers — Interests (Step 5) and Personality (Step 7 `MiniPersonality`, used for both protagonist and supporting characters) — so they share one visual language. Everything else about their behavior (editable interest inputs, FIFO cap, trait toggles) stays exactly as-is.

## What changes visually

Both pickers will use the same pill specs:

**Selected pills (chosen items)**
- 2px solid border in `hsl(var(--wizard-primary))` (same green outline used on all other standardized selection boxes from the previous pass).
- Light tint background: `hsl(var(--wizard-primary) / 0.08)`.
- Text in `hsl(var(--wizard-primary))`.
- `X` remove icon in the same green (currently faded gray at 50% opacity → change to `hsl(var(--wizard-primary))` at ~70% opacity, full opacity on hover).
- No checkmark badge (explicit per your ask).

**Suggestion pills (clickable to add)**
- Keep dashed border (unchanged behavior).
- Same green dashed border color, same green text — already the case.
- Same hover: subtle tint background + `-translate-y-0.5` lift (same as Step 5 today; bring Step 7 in line).

**Size — all pills, both pickers, ~40px tall**
- Single shared spec: `px-4 py-2 text-sm` with `border-2`, `rounded-full`, `gap-1.5`. With `text-sm` (line-height ~20px) + 8px top/bottom padding + 2px borders this lands at ~40px. No fixed `h-*` class.
- Today Step 5 pills are bigger (`px-5 py-2.5 text-base`, ~44px) and Step 7 `MiniPersonality` pills are much smaller (`px-3 py-1 text-xs`, ~24px). Both get normalized to the same ~40px spec.
- The dashed "+ Add interest" button in Step 5 uses the same shared spec so it visually matches.
- Inline `<input>` inside an interest pill keeps `text-sm` so the row height stays consistent whether the chip is a suggestion or a filled entry.

## Where it applies

| File | Component | What's normalized |
|------|-----------|-------------------|
| `src/pages/steps/Step5Interests.tsx` | filled interest pills, suggestion pills, "+ Add interest" button | size, selected border (was tinted background only — now also gets the 2px green border), X icon color |
| `src/pages/steps/Step7Character.tsx` | `MiniPersonality` (used for protagonist + each supporting character) | size (was much smaller), green border on selected, X icon color, hover treatment on suggestions |

Out of scope (unchanged): Interests copy/warning, max-3 cap behavior, FIFO replacement, trait pool itself, the `SelectableTile` boxes from the previous pass, gender/hair pills.

## Implementation approach

1. **New tiny shared module** `src/components/pillStyles.ts` exporting three constants used by both pickers:
   - `PILL_BASE = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border-2 transition-all"`
   - `PILL_SELECTED` → solid green border + tint bg + green text.
   - `PILL_SUGGESTION` → dashed green border + green text + hover lift + hover tint.
   - Plus a `PILL_REMOVE_BTN` class for the `X` button (green at ~70% opacity, hover 100%).

   Keeping it as flat constants (not a wrapper component) so the two pickers — which differ in internals (Step 5 has an inline editable `<input>`, Step 7 is pure buttons) — can each keep their own JSX.

2. **`Step5Interests.tsx`** — swap `pillBase` + `pillFilledStyle` + the dashed-suggestion classNames for the shared constants. The `<input>` inside the filled pill becomes `text-sm` to match the new pill height. The X button uses `PILL_REMOVE_BTN`. "+ Add interest" button uses the shared suggestion classes (with `border-dashed` already in `PILL_SUGGESTION`, no extra work).

3. **`Step7Character.tsx > MiniPersonality`** — replace the local filled-span classes and the suggestion-button classes with `PILL_SELECTED` and `PILL_SUGGESTION`. X icon picks up `PILL_REMOVE_BTN`. Header text + "pick up to N traits" caption stay as-is.

4. No state, validation, prompt, or schema changes. Pure presentation.

## Files touched

- `src/components/pillStyles.ts` (new)
- `src/pages/steps/Step5Interests.tsx`
- `src/pages/steps/Step7Character.tsx`

## One quick check before I build

The personality pills today are noticeably smaller than the interest pills (xs text vs base text). Sizing them up to ~40px will make the "Personality" section in Step 7 take more vertical space — that's the intended outcome of your "make them all the same size" ask, just flagging so it isn't a surprise.