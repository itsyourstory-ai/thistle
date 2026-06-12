import {
  assertEquals,
  assertThrows,
  assertStringIncludes,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE,
  layoutIdForStoryPage,
  layoutForStoryPage,
  layoutScheduleForPrompt,
} from "./layoutSequences.ts";

// ── layoutIdForStoryPage ──────────────────────────────────────────────────────

Deno.test("layoutIdForStoryPage: story page 1 returns first layout in sequence", () => {
  assertEquals(layoutIdForStoryPage(1), DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE[0]);
});

Deno.test("layoutIdForStoryPage: story page 30 returns last layout in sequence", () => {
  const last = DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE.length;
  assertEquals(
    layoutIdForStoryPage(last),
    DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE[last - 1],
  );
});

Deno.test("layoutIdForStoryPage: story page 31 wraps to start of sequence", () => {
  const seqLen = DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE.length;
  assertEquals(layoutIdForStoryPage(seqLen + 1), DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE[0]);
});

Deno.test("layoutIdForStoryPage: page 60 wraps correctly for a 30-page sequence", () => {
  const seqLen = DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE.length;
  // page 60 (1-based) → 0-based=59 → 59 % 30 = 29 → last element
  assertEquals(
    layoutIdForStoryPage(seqLen * 2),
    DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE[seqLen - 1],
  );
});

Deno.test("layoutIdForStoryPage: page 0 or negative clamps to first layout", () => {
  // Math.max(0, 0-1)=0 → index 0
  assertEquals(layoutIdForStoryPage(0), DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE[0]);
  assertEquals(layoutIdForStoryPage(-5), DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE[0]);
});

Deno.test("layoutIdForStoryPage: returns a known layout id for every position in sequence", () => {
  const seqLen = DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE.length;
  for (let i = 1; i <= seqLen; i++) {
    const id = layoutIdForStoryPage(i);
    assertEquals(typeof id, "string");
    assertEquals(id.length > 0, true);
  }
});

// ── layoutForStoryPage ────────────────────────────────────────────────────────

Deno.test("layoutForStoryPage: returns a layout object with expected shape for page 1", () => {
  const layout = layoutForStoryPage(1);
  assertEquals(typeof layout.id, "string");
  assertEquals(typeof layout.label, "string");
  assertEquals(typeof layout.compositionCue, "string");
  assertEquals(Array.isArray(layout.appliesTo), true);
});

Deno.test("layoutForStoryPage: layout id matches layoutIdForStoryPage result", () => {
  for (let page = 1; page <= 10; page++) {
    assertEquals(layoutForStoryPage(page).id, layoutIdForStoryPage(page));
  }
});

// ── layoutScheduleForPrompt ───────────────────────────────────────────────────

Deno.test("layoutScheduleForPrompt: contains an entry for each story page", () => {
  const schedule = layoutScheduleForPrompt();
  const seqLen = DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE.length;
  assertStringIncludes(schedule, "Story page 1:");
  assertStringIncludes(schedule, `Story page ${seqLen}:`);
});

Deno.test("layoutScheduleForPrompt: each line includes a layout id", () => {
  const lines = layoutScheduleForPrompt().split("\n");
  assertEquals(lines.length, DEFAULT_30_STORY_PAGE_LAYOUT_SEQUENCE.length);
  for (const line of lines) {
    assertEquals(line.includes(":"), true);
  }
});
