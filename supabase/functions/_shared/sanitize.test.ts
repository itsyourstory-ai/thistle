import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isValidEmail, sanitizeUserText } from "./sanitize.ts";

// ── sanitizeUserText ─────────────────────────────────────────────────────────

Deno.test("sanitizeUserText: returns empty string for non-string input", () => {
  assertEquals(sanitizeUserText(undefined), "");
  assertEquals(sanitizeUserText(null), "");
  assertEquals(sanitizeUserText(123), "");
  assertEquals(sanitizeUserText({}), "");
});

Deno.test("sanitizeUserText: strips control chars and null bytes", () => {
  // NUL (\x00), unit separator (\x1f), and DEL (\x7f) all dropped.
  const dirty = "He" + String.fromCharCode(0) + "llo" +
    String.fromCharCode(0x1f) + "wor" + String.fromCharCode(0x7f) + "ld";
  assertEquals(sanitizeUserText(dirty), "Helloworld");
});

Deno.test("sanitizeUserText: strips tabs and newlines (control chars)", () => {
  assertEquals(sanitizeUserText("a\tb\nc"), "abc");
});

Deno.test("sanitizeUserText: trims surrounding whitespace", () => {
  assertEquals(sanitizeUserText("  hi there  "), "hi there");
});

Deno.test("sanitizeUserText: caps length at maxLen", () => {
  const long = "x".repeat(5000);
  assertEquals(sanitizeUserText(long, 100).length, 100);
});

Deno.test("sanitizeUserText: default maxLen is 2000", () => {
  const long = "x".repeat(5000);
  assertEquals(sanitizeUserText(long).length, 2000);
});

Deno.test("sanitizeUserText: leaves ordinary names and notes intact", () => {
  assertEquals(sanitizeUserText("Émile O'Brien-Smith"), "Émile O'Brien-Smith");
});

// ── isValidEmail ─────────────────────────────────────────────────────────────

Deno.test("isValidEmail: accepts well-formed addresses", () => {
  assertEquals(isValidEmail("a@b.com"), true);
  assertEquals(isValidEmail("jordan.d.bowman@gmail.com"), true);
});

Deno.test("isValidEmail: rejects malformed addresses", () => {
  assertEquals(isValidEmail("no-at-sign"), false);
  assertEquals(isValidEmail("missing@domain"), false);
  assertEquals(isValidEmail("two@@at.com"), false);
  assertEquals(isValidEmail("has space@x.com"), false);
  assertEquals(isValidEmail(""), false);
});

Deno.test("isValidEmail: rejects non-string input", () => {
  assertEquals(isValidEmail(undefined), false);
  assertEquals(isValidEmail(null), false);
  assertEquals(isValidEmail(42), false);
});
