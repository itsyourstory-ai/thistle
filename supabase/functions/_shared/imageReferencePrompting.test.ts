import {
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert";
import {
  normalizeOutfitSourceIndex,
  orderPhotosWithOutfitSourceFirst,
  outfitSourceInstruction,
  buildPageReferencePreamble,
} from "./imageReferencePrompting.ts";

// ── normalizeOutfitSourceIndex ────────────────────────────────────────────────

Deno.test("normalizeOutfitSourceIndex: returns 0 when photoCount is 0", () => {
  assertEquals(normalizeOutfitSourceIndex(1, 0), 0);
  assertEquals(normalizeOutfitSourceIndex(0, 0), 0);
});

Deno.test("normalizeOutfitSourceIndex: accepts valid 0-based index", () => {
  assertEquals(normalizeOutfitSourceIndex(0, 3), 0);
  assertEquals(normalizeOutfitSourceIndex(1, 3), 1);
  assertEquals(normalizeOutfitSourceIndex(2, 3), 2);
});

Deno.test("normalizeOutfitSourceIndex: prefers the 0-based interpretation for in-range values", () => {
  // n=1 is a valid 0-based index for photoCount=3, so it stays 1 — the
  // 0-based branch wins before the 1-based fallback is considered.
  assertEquals(normalizeOutfitSourceIndex(1, 3), 1);
});

Deno.test("normalizeOutfitSourceIndex: treats n === photoCount as a 1-based index", () => {
  // n=3 is out of 0-based range (0–2) but valid as 1-based → 0-based 2.
  // This is the only case where the 1-based fallback actually applies.
  assertEquals(normalizeOutfitSourceIndex(3, 3), 2);
});

Deno.test("normalizeOutfitSourceIndex: clamps negative values to 0", () => {
  assertEquals(normalizeOutfitSourceIndex(-1, 3), 0);
  assertEquals(normalizeOutfitSourceIndex(-99, 3), 0);
});

Deno.test("normalizeOutfitSourceIndex: clamps out-of-range values to 0", () => {
  // n=5 is neither a valid 0-based (0–2) nor 1-based (1–3) index for photoCount=3
  assertEquals(normalizeOutfitSourceIndex(5, 3), 0);
  assertEquals(normalizeOutfitSourceIndex(100, 3), 0);
});

Deno.test("normalizeOutfitSourceIndex: returns 0 for non-numeric input", () => {
  assertEquals(normalizeOutfitSourceIndex("abc", 3), 0);
  assertEquals(normalizeOutfitSourceIndex(null, 3), 0);
  assertEquals(normalizeOutfitSourceIndex(undefined, 3), 0);
  assertEquals(normalizeOutfitSourceIndex(NaN, 3), 0);
});

Deno.test("normalizeOutfitSourceIndex: floors floating-point values", () => {
  assertEquals(normalizeOutfitSourceIndex(1.9, 3), 1);
});

// ── orderPhotosWithOutfitSourceFirst ──────────────────────────────────────────

Deno.test("orderPhotosWithOutfitSourceFirst: returns empty array for empty input", () => {
  assertEquals(orderPhotosWithOutfitSourceFirst([], 0), []);
});

Deno.test("orderPhotosWithOutfitSourceFirst: returns unchanged single-photo array", () => {
  assertEquals(orderPhotosWithOutfitSourceFirst(["a.jpg"], 0), ["a.jpg"]);
});

Deno.test("orderPhotosWithOutfitSourceFirst: moves outfit source to position 0", () => {
  const photos = ["first.jpg", "second.jpg", "third.jpg"];
  assertEquals(
    orderPhotosWithOutfitSourceFirst(photos, 1),
    ["second.jpg", "first.jpg", "third.jpg"],
  );
});

Deno.test("orderPhotosWithOutfitSourceFirst: no-op when outfit source is already first", () => {
  const photos = ["a.jpg", "b.jpg", "c.jpg"];
  assertEquals(orderPhotosWithOutfitSourceFirst(photos, 0), ["a.jpg", "b.jpg", "c.jpg"]);
});

Deno.test("orderPhotosWithOutfitSourceFirst: handles last-photo outfit source", () => {
  const photos = ["a.jpg", "b.jpg", "c.jpg"];
  assertEquals(
    orderPhotosWithOutfitSourceFirst(photos, 2),
    ["c.jpg", "a.jpg", "b.jpg"],
  );
});

// ── outfitSourceInstruction ───────────────────────────────────────────────────

Deno.test("outfitSourceInstruction: returns empty string for 0 photos", () => {
  assertEquals(outfitSourceInstruction(0), "");
});

Deno.test("outfitSourceInstruction: returns single-photo wording for 1 photo", () => {
  const text = outfitSourceInstruction(1);
  assertStringIncludes(text, "Image #1");
  assertStringIncludes(text, "OUTFIT SOURCE");
  // Single-photo variant should NOT mention "Images #2 onward".
  assertEquals(text.includes("Images #2"), false);
});

Deno.test("outfitSourceInstruction: returns multi-photo wording for 2+ photos", () => {
  const text = outfitSourceInstruction(2);
  assertStringIncludes(text, "Image #1");
  assertStringIncludes(text, "OUTFIT SOURCE");
  assertStringIncludes(text, "Images #2");
});

Deno.test("outfitSourceInstruction: multi-photo wording applies for large counts too", () => {
  assertStringIncludes(outfitSourceInstruction(5), "Images #2");
});

// ── buildPageReferencePreamble ────────────────────────────────────────────────

Deno.test("buildPageReferencePreamble: returns empty string when no character refs", () => {
  assertEquals(
    buildPageReferencePreamble({ characterReferenceCount: 0, priorSceneReferenceCount: 0 }),
    "",
  );
});

Deno.test("buildPageReferencePreamble: singular character reference uses 'Image #1'", () => {
  const text = buildPageReferencePreamble({
    characterReferenceCount: 1,
    priorSceneReferenceCount: 0,
  });
  assertStringIncludes(text, "Image #1");
  assertStringIncludes(text, "CANONICAL CHARACTER REFERENCE");
});

Deno.test("buildPageReferencePreamble: multiple character refs uses 'Images #1–#N'", () => {
  const text = buildPageReferencePreamble({
    characterReferenceCount: 3,
    priorSceneReferenceCount: 0,
  });
  assertStringIncludes(text, "Images #1–#3");
  assertStringIncludes(text, "CHARACTER REFERENCES");
});

Deno.test("buildPageReferencePreamble: prior scene refs numbered after character refs", () => {
  const text = buildPageReferencePreamble({
    characterReferenceCount: 2,
    priorSceneReferenceCount: 1,
  });
  // Character refs occupy #1–#2; prior scene starts at #3.
  assertStringIncludes(text, "Image #3");
  assertStringIncludes(text, "PRIOR PAGE REFERENCE");
});

Deno.test("buildPageReferencePreamble: multiple prior scene refs use range notation", () => {
  const text = buildPageReferencePreamble({
    characterReferenceCount: 1,
    priorSceneReferenceCount: 3,
  });
  // Character at #1; prior scenes #2–#4.
  assertStringIncludes(text, "Images #2–#4");
  assertStringIncludes(text, "PRIOR PAGE REFERENCES");
});

Deno.test("buildPageReferencePreamble: always appends the no-text instruction", () => {
  const text = buildPageReferencePreamble({
    characterReferenceCount: 1,
    priorSceneReferenceCount: 0,
  });
  assertStringIncludes(text, "Do not generate readable text");
});
