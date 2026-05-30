// =============================================================================
//  PAGE LAYOUT REGISTRY — first-class, extensible.
// =============================================================================
//
//  Adding a new page layout = appending one entry to PAGE_LAYOUTS. The engine,
//  output schema (zod/JSON-Schema enum), prompt-time layout table, image-prompt
//  composition cue, and the dev preview renderer all pick it up automatically.
//
//  Only add a brand-new value to TextPlacement or IllustrationCoverage when a
//  layout truly cannot be described with the existing enums — the dev preview
//  has one render branch per value.
// =============================================================================

export type PageRole = "title" | "dedication" | "story";

export type TextPlacement =
  | "none"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "center"
  | "facing-page";

export type IllustrationCoverage =
  | "full"
  | "three-quarter"
  | "half"
  | "spot"
  | "none";

export type StoryBeat =
  | "opening"
  | "rising"
  | "turn"
  | "climax"
  | "resolution"
  | "closing";

export interface PageLayout {
  id: string;
  label: string;
  appliesTo: PageRole[];
  /** Soft hint appended to the per-page image prompt. */
  compositionCue: string;
  textPlacement: TextPlacement;
  illustrationCoverage: IllustrationCoverage;
  /** Optional: story beats this layout is best suited to. */
  preferFor?: StoryBeat[];
}

export const PAGE_LAYOUTS: PageLayout[] = [
  {
    id: "title",
    label: "Title page",
    appliesTo: ["title"],
    textPlacement: "center",
    illustrationCoverage: "full",
    compositionCue:
      "reuse the cover artwork; no new illustration prompt for this page",
  },
  {
    id: "dedication-spot",
    label: "Dedication with spot illustration",
    appliesTo: ["dedication"],
    textPlacement: "top",
    illustrationCoverage: "spot",
    compositionCue:
      "square 1:1 canvas — small, centered decorative spot motif on a clean cream background, single motif, no full scene",
  },
  {
    id: "full-bleed",
    label: "Full bleed (image only)",
    appliesTo: ["story"],
    textPlacement: "none",
    illustrationCoverage: "full",
    compositionCue:
      "square 1:1 full-bleed illustration; no text overlay so the composition can fill the entire canvas",
    preferFor: ["climax", "turn"],
  },
  {
    id: "text-bottom-third",
    label: "Text bottom / image top",
    appliesTo: ["story"],
    textPlacement: "bottom",
    illustrationCoverage: "three-quarter",
    compositionCue:
      "square 1:1 canvas — reserve the lower third as a calm text-safe area; place important faces, hands, props, and story action in the upper and middle portions; keep the text area low-detail, low-contrast, and free of readable text",
  },
  {
    id: "text-top-third",
    label: "Text top / image bottom",
    appliesTo: ["story"],
    textPlacement: "top",
    illustrationCoverage: "three-quarter",
    compositionCue:
      "square 1:1 canvas — reserve the upper third as a calm text-safe area; place important faces, hands, props, and story action in the middle and lower portions; keep the text area low-detail, low-contrast, and free of readable text",
  },
  {
    id: "text-left-half",
    label: "Text left / image right",
    appliesTo: ["story"],
    textPlacement: "left",
    illustrationCoverage: "half",
    compositionCue:
      "square 1:1 canvas — reserve the left 40–45% as a calm text-safe area; compose the main scene, expressions, and story action on the right side; keep the text side low-detail, low-contrast, and free of readable text",
    preferFor: ["opening", "rising"],
  },
  {
    id: "text-right-half",
    label: "Text right / image left",
    appliesTo: ["story"],
    textPlacement: "right",
    illustrationCoverage: "half",
    compositionCue:
      "square 1:1 canvas — reserve the right 40–45% as a calm text-safe area; compose the main scene, expressions, and story action on the left side; keep the text side low-detail, low-contrast, and free of readable text",
    preferFor: ["resolution", "closing"],
  },
  {
    id: "text-center-card",
    label: "Text center / framed illustration",
    appliesTo: ["story"],
    textPlacement: "center",
    illustrationCoverage: "three-quarter",
    compositionCue:
      "square 1:1 canvas — reserve a large calm centered text-safe area; frame characters, setting details, and decorative story elements around the center without crowding it; keep the center softly textured, low-detail, low-contrast, and free of readable text",
    preferFor: ["turn", "resolution", "closing"],
  },
];

// ---- Helpers ---------------------------------------------------------------

export function getLayout(id: string): PageLayout | undefined {
  return PAGE_LAYOUTS.find((l) => l.id === id);
}

export function layoutIdsForRole(role: PageRole): string[] {
  return PAGE_LAYOUTS.filter((l) => l.appliesTo.includes(role)).map((l) => l.id);
}

export function allLayoutIds(): string[] {
  return PAGE_LAYOUTS.map((l) => l.id);
}

/**
 * Serializes the registry into a compact markdown table for the prompt.
 * Adding/removing a layout updates the prompt automatically.
 */
export function serializeLayoutRegistryForPrompt(): string {
  const storyOnly = PAGE_LAYOUTS.filter((l) => l.appliesTo.includes("story"));
  const rows = storyOnly.map((l) => {
    const prefer = l.preferFor?.length
      ? l.preferFor.join("/")
      : "any";
    return `| \`${l.id}\` | ${l.label} | ${prefer} | ${l.compositionCue} |`;
  });
  return [
    "| layout_id | label | best for beats | composition cue |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
}
