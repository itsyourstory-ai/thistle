import { assertEquals } from "jsr:@std/assert";
import {
  canMarkFailed,
  canMarkPaid,
  CAN_BECOME_FAILED_FROM,
  CAN_BECOME_PAID_FROM,
  shouldFinishPaidNotification,
} from "./orderStatus.ts";

// ── canMarkPaid ──────────────────────────────────────────────────────────────

Deno.test("late payment notification: a refunded order is never marked paid again (THI-68)", () => {
  assertEquals(canMarkPaid("refunded"), false);
});

Deno.test("payment notification: pending and failed orders can be marked paid", () => {
  // "failed" matters: a buyer whose first card was declined can retry and succeed.
  assertEquals(canMarkPaid("pending"), true);
  assertEquals(canMarkPaid("failed"), true);
});

Deno.test("payment notification: an already paid order is left alone", () => {
  assertEquals(canMarkPaid("paid"), false);
});

Deno.test("payment notification: an unknown or missing status is never marked paid", () => {
  for (const status of [null, undefined, "", "cancelled"]) {
    assertEquals(canMarkPaid(status), false);
  }
});

Deno.test("payment notification: the database filter lists the same statuses as canMarkPaid", () => {
  // The webhook sends CAN_BECOME_PAID_FROM to the database as the filter, so it
  // must agree with the function the tests above cover.
  for (const status of ["pending", "failed", "paid", "refunded"]) {
    assertEquals(CAN_BECOME_PAID_FROM.includes(status as never), canMarkPaid(status));
  }
});

// ── canMarkFailed ────────────────────────────────────────────────────────────

Deno.test("late failed-payment notification: a refunded order is never marked failed (THI-68)", () => {
  assertEquals(canMarkFailed("refunded"), false);
});

Deno.test("late failed-payment notification: a paid order is never marked failed", () => {
  assertEquals(canMarkFailed("paid"), false);
});

Deno.test("failed-payment notification: a pending order is marked failed", () => {
  assertEquals(canMarkFailed("pending"), true);
});

Deno.test("failed-payment notification: the database filter lists the same statuses as canMarkFailed", () => {
  for (const status of ["pending", "failed", "paid", "refunded"]) {
    assertEquals(CAN_BECOME_FAILED_FROM.includes(status as never), canMarkFailed(status));
  }
});

// ── shouldFinishPaidNotification ─────────────────────────────────────────────

Deno.test("late payment notification: no receipt and no book for a refunded order (THI-68)", () => {
  assertEquals(shouldFinishPaidNotification("refunded"), false);
});

Deno.test("payment notification: a paid order gets its receipt and book (also on a repeat delivery)", () => {
  assertEquals(shouldFinishPaidNotification("paid"), true);
});

Deno.test("payment notification: other statuses still go on to the receipt and book start", () => {
  // These are the states where the status update did not apply (for example a
  // temporary database error). generate-book still runs its own paid check.
  for (const status of ["pending", "failed", null, undefined]) {
    assertEquals(shouldFinishPaidNotification(status), true);
  }
});
