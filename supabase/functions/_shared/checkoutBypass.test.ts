import { assertEquals } from "jsr:@std/assert";
import { isCheckoutBypassAllowed } from "./checkoutBypass.ts";

const TEST_KEY = "sk_test_abc";
const LIVE_KEY = "sk_live_abc";

Deno.test("checkout bypass: refused when not requested", () => {
  assertEquals(
    isCheckoutBypassAllowed(false, { ALLOW_CHECKOUT_BYPASS: "true", STRIPE_SECRET_KEY: TEST_KEY }),
    false,
  );
});

Deno.test("checkout bypass: refused on a Stripe test key alone (THI-37)", () => {
  assertEquals(isCheckoutBypassAllowed(true, { STRIPE_SECRET_KEY: TEST_KEY }), false);
});

Deno.test("checkout bypass: refused when the setting is anything but \"true\"", () => {
  for (const value of ["", "1", "TRUE", "yes", "false", " true"]) {
    assertEquals(
      isCheckoutBypassAllowed(true, { ALLOW_CHECKOUT_BYPASS: value, STRIPE_SECRET_KEY: TEST_KEY }),
      false,
      `value ${JSON.stringify(value)}`,
    );
  }
});

Deno.test("checkout bypass: allowed when explicitly turned on with a test key", () => {
  assertEquals(
    isCheckoutBypassAllowed(true, { ALLOW_CHECKOUT_BYPASS: "true", STRIPE_SECRET_KEY: TEST_KEY }),
    true,
  );
});

Deno.test("checkout bypass: allowed when turned on with no Stripe key (local dev)", () => {
  assertEquals(isCheckoutBypassAllowed(true, { ALLOW_CHECKOUT_BYPASS: "true" }), true);
});

Deno.test("checkout bypass: always refused on a live Stripe key, even when turned on", () => {
  assertEquals(
    isCheckoutBypassAllowed(true, { ALLOW_CHECKOUT_BYPASS: "true", STRIPE_SECRET_KEY: LIVE_KEY }),
    false,
  );
});

Deno.test("checkout bypass: always refused on a restricted live Stripe key", () => {
  assertEquals(
    isCheckoutBypassAllowed(true, { ALLOW_CHECKOUT_BYPASS: "true", STRIPE_SECRET_KEY: "rk_live_abc" }),
    false,
  );
});
