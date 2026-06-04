// Client-side mirror of supabase/functions/_shared/layouts.ts.
// Kept in sync by hand — same id, label, textPlacement, illustrationCoverage.
// Used only by the dev preview to render layout-aware page cards.

export type PageRole = "title" | "dedication" | "story";
export type TextPlacement =
  | "none" | "top" | "bottom" | "left" | "right" | "center" | "facing-page";
export type IllustrationCoverage =
  | "full" | "three-quarter" | "half" | "spot" | "none";

export interface PageLayout {
  id: string;
  label: string;
  textPlacement: TextPlacement;
  illustrationCoverage: IllustrationCoverage;
}

export const PAGE_LAYOUTS: PageLayout[] = [
  { id: "title", label: "Title page", textPlacement: "center", illustrationCoverage: "full" },
  { id: "dedication-spot", label: "Dedication with spot illustration", textPlacement: "top", illustrationCoverage: "spot" },
  { id: "full-bleed", label: "Full bleed (image only)", textPlacement: "none", illustrationCoverage: "full" },
  { id: "text-bottom-third", label: "Text bottom / image top", textPlacement: "bottom", illustrationCoverage: "three-quarter" },
  { id: "text-top-third", label: "Text top / image bottom", textPlacement: "top", illustrationCoverage: "three-quarter" },
  { id: "text-left-half", label: "Text left / image right", textPlacement: "left", illustrationCoverage: "half" },
  { id: "text-right-half", label: "Text right / image left", textPlacement: "right", illustrationCoverage: "half" },
  { id: "text-center-card", label: "Text center / framed illustration", textPlacement: "center", illustrationCoverage: "three-quarter" },
];

export function getLayout(id: string): PageLayout | undefined {
  return PAGE_LAYOUTS.find((l) => l.id === id);
}
