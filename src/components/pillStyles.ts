/**
 * Shared pill styles for the chip pickers (Interests, MiniPersonality).
 * Kept as flat class strings so each picker can keep its own internal JSX
 * (Step 5 has an editable <input> inside the filled chip; Step 7 doesn't).
 */

export const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border-2 transition-all";

/** Chosen / filled pill — solid green outline + tint, NO checkmark badge. */
export const PILL_SELECTED =
  `${PILL_BASE} border-[hsl(var(--wizard-primary))] bg-[hsl(var(--wizard-primary)/0.08)] text-[hsl(var(--wizard-primary))]`;

/** Suggestion pill — dashed green outline + hover lift. */
export const PILL_SUGGESTION =
  `${PILL_BASE} border-dashed border-[hsl(var(--wizard-primary)/0.4)] bg-white text-[hsl(var(--wizard-primary))] hover:bg-[hsl(var(--wizard-primary)/0.05)] hover:-translate-y-0.5`;

/** X remove button inside a selected pill — green, faded until hover. */
export const PILL_REMOVE_BTN =
  "ml-0.5 text-[hsl(var(--wizard-primary))] opacity-70 hover:opacity-100 transition-opacity";
