import { assertEquals, assertThrows } from "jsr:@std/assert";
import { baseAmountFor, validateShipping, computeAmount, PRICE_MAP } from "./stripe.ts";

// ── PRICE_MAP / baseAmountFor ─────────────────────────────────────────────────

Deno.test("PRICE_MAP has correct amounts", () => {
  assertEquals(PRICE_MAP.digital, 999);
  assertEquals(PRICE_MAP.hardcover, 5499);
});

Deno.test("baseAmountFor: returns correct amount for digital", () => {
  assertEquals(baseAmountFor("digital"), 999);
});

Deno.test("baseAmountFor: returns correct amount for hardcover", () => {
  assertEquals(baseAmountFor("hardcover"), 5499);
});

Deno.test("baseAmountFor: throws on unknown product", () => {
  assertThrows(() => baseAmountFor("ebook"), Error, "Unknown product");
});

// ── validateShipping ──────────────────────────────────────────────────────────

const validShipping = {
  name: "Jordan Bowman",
  street1: "123 Main St",
  street2: null,
  city: "Denver",
  state_code: "CO",
  postcode: "80203",
  country_code: "US",
  phone: "3035550000",
};

Deno.test("validateShipping: digital always ok, no shipping needed", () => {
  const result = validateShipping("digital", undefined);
  assertEquals(result.ok, true);
});

Deno.test("validateShipping: digital ok even with null shipping", () => {
  const result = validateShipping("digital", null);
  assertEquals(result.ok, true);
});

Deno.test("validateShipping: hardcover with valid shipping returns ok", () => {
  const result = validateShipping("hardcover", validShipping);
  assertEquals(result.ok, true);
});

Deno.test("validateShipping: hardcover forces country_code to US", () => {
  const result = validateShipping("hardcover", { ...validShipping, country_code: "CA" });
  assertEquals(result.ok, true);
});

Deno.test("validateShipping: hardcover missing phone is rejected", () => {
  const result = validateShipping("hardcover", { ...validShipping, phone: "" });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals("phone" in result.errors, true);
  }
});

Deno.test("validateShipping: hardcover missing state_code is rejected", () => {
  const result = validateShipping("hardcover", { ...validShipping, state_code: "" });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals("state_code" in result.errors, true);
  }
});

Deno.test("validateShipping: hardcover missing street1 is rejected", () => {
  const result = validateShipping("hardcover", { ...validShipping, street1: "" });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals("street1" in result.errors, true);
  }
});

Deno.test("validateShipping: hardcover missing city is rejected", () => {
  const result = validateShipping("hardcover", { ...validShipping, city: "" });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals("city" in result.errors, true);
  }
});

Deno.test("validateShipping: hardcover missing postcode is rejected", () => {
  const result = validateShipping("hardcover", { ...validShipping, postcode: "" });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals("postcode" in result.errors, true);
  }
});

Deno.test("validateShipping: hardcover with null shipping returns errors", () => {
  const result = validateShipping("hardcover", null);
  assertEquals(result.ok, false);
});

Deno.test("validateShipping: hardcover with undefined shipping returns errors", () => {
  const result = validateShipping("hardcover", undefined);
  assertEquals(result.ok, false);
});

Deno.test("validateShipping: multiple missing fields all reported", () => {
  const result = validateShipping("hardcover", { ...validShipping, phone: "", state_code: "" });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals("phone" in result.errors, true);
    assertEquals("state_code" in result.errors, true);
  }
});

// ── computeAmount ─────────────────────────────────────────────────────────────

Deno.test("computeAmount: base minus discount", () => {
  assertEquals(computeAmount(999, 100), 899);
});

Deno.test("computeAmount: zero discount returns base", () => {
  assertEquals(computeAmount(5499, 0), 5499);
});

Deno.test("computeAmount: clamps at 0 (never negative)", () => {
  assertEquals(computeAmount(999, 2000), 0);
});

Deno.test("computeAmount: exact zero when discount equals base", () => {
  assertEquals(computeAmount(999, 999), 0);
});
