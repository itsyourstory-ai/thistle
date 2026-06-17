import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { applyDedication } from "./prompts.ts";
import type { RawBookPage } from "./prompts.ts";

function makePage(role: RawBookPage["role"], text: string): RawBookPage {
  return { page_number: role === "title" ? 1 : role === "dedication" ? 2 : 3, role, layout_id: "text-bottom-third", text };
}

const PAGES: RawBookPage[] = [
  makePage("title", ""),
  makePage("dedication", ""),
  makePage("story", "Once upon a time…"),
];

Deno.test("applyDedication: replaces dedication page text with the provided string", () => {
  const result = applyDedication(PAGES, "For Leo, with all our love.");
  assertEquals(result[1].text, "For Leo, with all our love.");
});

Deno.test("applyDedication: does not touch title or story pages", () => {
  const result = applyDedication(PAGES, "For Leo, with all our love.");
  assertEquals(result[0].text, "");
  assertEquals(result[2].text, "Once upon a time…");
});

Deno.test("applyDedication: no-op when dedicationText is undefined", () => {
  const result = applyDedication(PAGES, undefined);
  assertEquals(result[1].text, "");
});

Deno.test("applyDedication: no-op when dedicationText is empty string", () => {
  const result = applyDedication(PAGES, "");
  assertEquals(result[1].text, "");
});

Deno.test("applyDedication: no-op when dedicationText is only whitespace", () => {
  const result = applyDedication(PAGES, "   ");
  assertEquals(result[1].text, "");
});

Deno.test("applyDedication: preserves newlines in the dedication", () => {
  const text = "For Leo,\nwith all our love.";
  const result = applyDedication(PAGES, text);
  assertEquals(result[1].text, text);
});

Deno.test("applyDedication: strips control chars but preserves newlines", () => {
  const dirty = "For Leo," + String.fromCharCode(0) + "\nwith love.";
  const result = applyDedication(PAGES, dirty);
  assertEquals(result[1].text, "For Leo,\nwith love.");
});

Deno.test("applyDedication: caps at 600 chars", () => {
  const long = "x".repeat(700);
  const result = applyDedication(PAGES, long);
  assertEquals(result[1].text.length, 600);
});

Deno.test("applyDedication: returns original array reference when no-op", () => {
  const result = applyDedication(PAGES, "");
  assertEquals(result, PAGES);
});
