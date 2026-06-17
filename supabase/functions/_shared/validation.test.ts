import {
  assertEquals,
  assertThrows,
} from "jsr:@std/assert";
import { assertUuid } from "./validation.ts";

Deno.test("assertUuid: returns a valid UUID unchanged", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  assertEquals(assertUuid(id), id);
});

Deno.test("assertUuid: accepts uppercase UUIDs", () => {
  const id = "123E4567-E89B-12D3-A456-426614174000";
  assertEquals(assertUuid(id), id);
});

Deno.test("assertUuid: throws on garbage string", () => {
  assertThrows(() => assertUuid("not-a-uuid"), Error, "Invalid id");
});

Deno.test("assertUuid: throws on empty string", () => {
  assertThrows(() => assertUuid(""), Error, "Invalid id");
});

Deno.test("assertUuid: throws on non-string input", () => {
  assertThrows(() => assertUuid(12345), Error, "Invalid id");
  assertThrows(() => assertUuid(null), Error, "Invalid id");
  assertThrows(() => assertUuid(undefined), Error, "Invalid id");
});

Deno.test("assertUuid: uses the provided label in the error message", () => {
  assertThrows(() => assertUuid("bad", "book_id"), Error, "Invalid book_id");
});

Deno.test("assertUuid: rejects a UUID with a trailing segment", () => {
  assertThrows(
    () => assertUuid("123e4567-e89b-12d3-a456-426614174000-extra"),
    Error,
    "Invalid id",
  );
});
