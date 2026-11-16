import { assertEquals } from "jsr:@std/assert";
import { isValidEmail, sanitizeUserText, stripDataUrls } from "./sanitize.ts";

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

// ── stripDataUrls ────────────────────────────────────────────────────────────

Deno.test("stripDataUrls: replaces any base64 data URL string with null, at any depth", () => {
  const input = { a: "data:image/png;base64,AAAA", b: { c: ["ok", "data:image/jpeg;base64,BBBB"] } };
  assertEquals<unknown>(stripDataUrls(input), { a: null, b: { c: ["ok", null] } });
});

Deno.test("stripDataUrls: nulls the known photo fields even when they are not data URLs", () => {
  const input = { photo: "draft-photos/u/d/photo-0.jpg", photos: ["x"], photoDataUrl: "y", name: "Ellie" };
  assertEquals<unknown>(stripDataUrls(input), { photo: null, photos: null, photoDataUrl: null, name: "Ellie" });
});

Deno.test("stripDataUrls: leaves ordinary values alone", () => {
  assertEquals<unknown>(stripDataUrls({ n: 3, t: true, s: "hello", z: null }), { n: 3, t: true, s: "hello", z: null });
  assertEquals(stripDataUrls(null), null);
  assertEquals(stripDataUrls("plain"), "plain");
});
