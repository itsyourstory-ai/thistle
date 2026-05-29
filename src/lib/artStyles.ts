// Frontend art-style catalogue used by the Step 6 picker (labels, emojis,
// preview thumbnails).
//
// IMPORTANT: the `prompt` strings below are duplicated in
// `supabase/functions/_shared/prompts.ts` (ART_STYLE_PROMPTS), which is the
// canonical place for ALL backend prompt copy. The duplication exists only
// so the frontend can show preview text without importing from the edge
// function. When you change a `prompt` here, also change it in
// `supabase/functions/_shared/prompts.ts` AND regenerate the matching
// preview in `public/art-styles/{value}.jpg` so the picker reflects what
// the cover model will actually paint.

export interface ArtStyle {
  value: string;
  label: string;
  emoji: string;
  desc: string;
  /** Style fragment fed verbatim to the image model. */
  prompt: string;
  /** Path under /public for the example thumbnail. */
  preview: string;
}

export const ART_STYLES: ArtStyle[] = [
  {
    value: "watercolor",
    label: "Watercolor Storybook",
    emoji: "🖼️",
    desc: "Soft, painterly, classic",
    prompt:
      "soft watercolor children's book illustration, hand-painted texture, gentle washes, warm muted palette, paper grain visible, classic storybook feel",
    preview: "/art-styles/watercolor.jpg",
  },
  {
    value: "cozy-sketch",
    label: "Cozy Sketch",
    emoji: "✏️",
    desc: "Charming hand-drawn linework",
    prompt:
      "charming hand-drawn children's book illustration, visible pencil and ink linework, light watercolor wash fill, warm earthy tones, sketchbook feel",
    preview: "/art-styles/cozy-sketch.jpg",
  },
  {
    value: "bold-bright",
    label: "Bold & Bright",
    emoji: "🌈",
    desc: "Vivid colors, modern and punchy",
    prompt:
      "modern vibrant children's book illustration, bold black outlines, flat saturated colors, playful punchy palette, contemporary cartoon style",
    preview: "/art-styles/bold-bright.jpg",
  },
  {
    value: "dreamy-pastel",
    label: "Dreamy Pastel",
    emoji: "🌙",
    desc: "Soft tones, gentle and ethereal",
    prompt:
      "dreamy pastel children's book illustration, soft glowing light, gentle pinks lavenders and creams, ethereal and calm, bedtime story feel",
    preview: "/art-styles/dreamy-pastel.jpg",
  },
];

export function getArtStylePrompt(value: string | undefined): string {
  return (
    ART_STYLES.find((s) => s.value === value)?.prompt ?? ART_STYLES[0].prompt
  );
}
