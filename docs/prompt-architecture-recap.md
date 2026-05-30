# Simplified Prompt Architecture Recap

This branch prepares the image-prompt system for a more controlled 30-page children’s book pipeline.

## Core principle

Use fewer model-decided choices and more app-decided structure.

The story model should write the story and scene facts. The app should control layout, reference-image hierarchy, character locks, outfit locks, final image prompt structure, and validation.

## Production flow

1. User completes the wizard.
2. Wizard stores the book brief, child photos, style choice/reference, and story settings.
3. The app creates or reuses 1–3 portrait references.
4. Portrait #1 becomes the canonical character reference.
5. Portraits #2–#3 become alternate pose/body references only.
6. The story engine writes 30 story pages with compact scene fields.
7. The app assigns layouts from a deterministic sequence.
8. The app assembles each final image prompt from:
   - style lock
   - character lock
   - page scene/action/emotion
   - layout cue
   - text-safe-area rule
   - continuity rule
   - negative constraints
9. Page images are generated sequentially.
10. Each page generation uses portrait references plus the prior 1–2 generated scenes as continuity references.

## Layout simplification

The system should rely mostly on a small layout library:

- `text-bottom-third`
- `text-top-third`
- `text-left-half`
- `text-right-half`
- `text-center-card`
- `full-bleed`

The new `text-center-card` layout reserves a calm center area for text and frames illustration around it.

## Deterministic layout sequence

A new `layoutSequences.ts` file defines the default 30-story-page schedule. This reduces layout drift and makes books feel intentionally designed.

The model should not improvise layout page by page unless we intentionally allow an override later.

## Text-safe-area rules

Every text layout should clearly reserve a calm area for future overlay text. The reserved area should be:

- low-detail
- low-contrast
- softly textured
- free of faces, hands, important props, and story-critical action
- free of model-generated letters, words, signs, labels, captions, logos, or watermarks

The image model should never render book text. Real book text should be overlaid later by the app/layout layer.

## Reference-image hierarchy

The image model should receive references in a strict order:

1. Portrait #1: canonical character reference.
2. Portraits #2–#3: alternate poses of the same character.
3. Prior page references: most recent 1–2 generated scenes.

Portrait #1 controls face, hair, skin tone, body shape, outfit, colors, and proportions.

Portraits #2–#3 support pose variety and body proportions only.

Prior page references support illustration style, palette, lighting, environment continuity, and page-to-page consistency only. They should not be copied for exact pose, action, or composition unless the page prompt asks for that.

## Outfit lock

The preferred flow is to let the user choose which uploaded photo is the outfit source. The app should then put that photo first when generating portrait #1 and tell the model:

- Image #1 is the outfit source.
- Recreate the outfit from Image #1 exactly.
- Use the other photos for likeness only.
- Do not blend clothing from multiple photos.

After portrait #1 is approved, the book should use two outfit locks:

1. Visual lock: portrait #1 is the canonical outfit reference.
2. Text lock: a stored `book_outfit` description is injected into page prompts.

## Files added or changed in this branch

- `supabase/functions/_shared/layouts.ts`
  - strengthens text-safe-area wording
  - adds `text-center-card`

- `supabase/functions/_shared/layoutSequences.ts`
  - adds deterministic 30-story-page layout sequence

- `supabase/functions/_shared/imageReferencePrompting.ts`
  - adds helpers for outfit source ordering and page reference preambles

## Next implementation step after approval

Wire the helpers into `generate-book-images/index.ts`:

- reorder uploaded photos so the selected outfit source is Image #1 during portrait generation
- add prior 1–2 completed page images to each page image generation request
- use `buildPageReferencePreamble()` instead of the current inline `anchorPreamble`
- optionally store/accept `outfitSourcePhotoIndex` and `book_outfit` from the wizard/book brief

## Later follow-up

Update the story engine so it either receives the deterministic layout schedule or has layout IDs assigned by the server after generation. The goal is to stop the story model from choosing layouts unpredictably.
