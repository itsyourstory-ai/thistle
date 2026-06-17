export const WIZARD_STEPS = [
  { num: 1, slug: "1-name", path: "/step/1-name" },
  { num: 2, slug: "2-buyer", path: "/step/2-buyer" },
  { num: 3, slug: "3-genre", path: "/step/3-genre" },
  { num: 4, slug: "4-lesson", path: "/step/4-lesson" },
  { num: 5, slug: "5-interests", path: "/step/5-interests" },
  { num: 6, slug: "6-art-style", path: "/step/6-art-style" },
  { num: 7, slug: "7-character", path: "/step/7-character" },
  { num: 8, slug: "8-dedication", path: "/step/8-dedication" },
  { num: 9, slug: "9-story", path: "/step/9-story" },
  { num: 10, slug: "10-cast", path: "/step/10-cast" },
  { num: 11, slug: "11-preview", path: "/step/11-preview" },
  { num: 12, slug: "12-generating", path: "/step/12-generating" },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;

export const pathForStep = (n: number): string =>
  WIZARD_STEPS[n - 1]?.path ?? "/step/1-name";

export const stepNumFromSlug = (slug?: string): number => {
  if (!slug) return 1;
  const found = WIZARD_STEPS.find((s) => s.slug === slug || String(s.num) === slug);
  return found?.num ?? 1;
};
