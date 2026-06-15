# Plan: Prior Page Continuity References

## Goal

Feed the 1–2 most recently generated page images into each new page image generation request. This reduces page-to-page drift in illustration style, palette, lighting, and environment — without changing story content or layouts.

## Current state

`generate-book-images/index.ts` builds each page prompt with only the character portrait(s) as image references (via `anchorPreamble`). Prior generated pages are not referenced.

The shared helper `buildPageReferencePreamble()` in `supabase/functions/_shared/imageReferencePrompting.ts` already handles the correct prompt language for mixed character + prior-page references — it just isn't wired in yet.

## What to change

In `generate-book-images/index.ts`:

1. As pages are generated sequentially, collect the URLs/data of completed page images.
2. For each new page, append the most recent 1–2 completed page images to the reference image array (after the character portrait references).
3. Replace the inline `anchorPreamble` string (around line 337) with a call to `buildPageReferencePreamble({ characterReferenceCount, priorSceneReferenceCount })` from `_shared/imageReferencePrompting.ts`.

## Reference

`buildPageReferencePreamble` is in `supabase/functions/_shared/imageReferencePrompting.ts`. It emits the correct hierarchy instructions:

- Character references first (portrait #1 canonical, #2–#3 pose variety only)
- Prior page references last (style/palette/environment continuity only — not pose/composition)
- Appends the no-text-in-illustration rule

## Notes

- Prior page references should be **the most recent 1–2 pages only** — using more risks the model drifting toward copying those scenes rather than following the new page prompt.
- Prior page references must come **after** character references in the image array so the hierarchy is respected.
- This is a quality improvement only — no schema changes, no wizard changes, no new tables.
