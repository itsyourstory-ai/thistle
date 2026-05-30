import { getLayout, type PageLayout } from "./layouts.ts";

// =============================================================================
//  STORY LAYOUT SEQUENCES
// =============================================================================
//
// Keep story-page layout assignment deterministic. The text/story model can
// write scene facts, but the app controls production layout so generated books
// look intentionally designed instead of model-random.
//
// This sequence is for the 30 story pages in the current 32-page book shape:
// title page + dedication page + 30 story pages. Story page 1 corresponds to
// absolute book page 3.
// =============================================================================

export const DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE = [
  "text-bottom-third",
  "text-bottom-third",
  "text-top-third",
  "text-top-third",
  "text-left-half",
  "text-right-half",
  "full-bleed",
  "text-bottom-third",
  "text-bottom-third",
  "text-top-third",
  "text-top-third",
  "text-left-half",
  "text-right-half",
  "text-center-card",
  "full-bleed",
  "text-bottom-third",
  "text-bottom-third",
  "text-top-third",
  "text-top-third",
  "text-left-half",
  "text-right-half",
  "full-bleed",
  "text-bottom-third",
  "text-bottom-third",
  "text-top-third",
  "text-top-third",
  "text-left-half",
  "text-right-half",
  "text-center-card",
  "text-bottom-third",
] as const;

export type StoryLayoutId = typeof DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE[number];

export function layoutIdForStoryPage(storyPageIndex: number): StoryLayoutId {
  const zeroBased = Math.max(0, storyPageIndex - 1);
  return DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE[
    zeroBased % DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE.length
  ];
}

export function layoutForStoryPage(storyPageIndex: number): PageLayout {
  const id = layoutIdForStoryPage(storyPageIndex);
  const layout = getLayout(id);
  if (!layout) throw new Error(`Unknown story layout id: ${id}`);
  return layout;
}

export function layoutScheduleForPrompt(): string {
  return DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE
    .map((layoutId, i) => `Story page ${i + 1}: ${layoutId}`)
    .join("\n");
}
