import { assertEquals, assertRejects } from "jsr:@std/assert";
import {
  sendTransactional,
  upsertContact,
  sendEvent,
  mockSentEmails,
  __resetLoopsMock,
} from "./loops.ts";

// ── mock transport (LOOPS_TRANSPORT unset) ────────────────────────────────────

Deno.test("sendTransactional: records transactional payload in mock mode", async () => {
  __resetLoopsMock();
  await sendTransactional("tmpl_123", "user@example.com", { foo: "bar" });
  assertEquals(mockSentEmails.length, 1);
  assertEquals(mockSentEmails[0].kind, "transactional");
  assertEquals(mockSentEmails[0].payload.transactionalId, "tmpl_123");
  assertEquals(mockSentEmails[0].payload.email, "user@example.com");
  assertEquals((mockSentEmails[0].payload.dataVariables as Record<string, unknown>).foo, "bar");
});

Deno.test("upsertContact: records contact payload in mock mode", async () => {
  __resetLoopsMock();
  await upsertContact("user@example.com", { firstName: "Jordan" });
  assertEquals(mockSentEmails.length, 1);
  assertEquals(mockSentEmails[0].kind, "contact");
  assertEquals(mockSentEmails[0].payload.email, "user@example.com");
  assertEquals(mockSentEmails[0].payload.firstName, "Jordan");
});

Deno.test("sendEvent: records event payload in mock mode", async () => {
  __resetLoopsMock();
  await sendEvent("user@example.com", "order_placed", { orderId: "abc" });
  assertEquals(mockSentEmails.length, 1);
  assertEquals(mockSentEmails[0].kind, "event");
  assertEquals(mockSentEmails[0].payload.email, "user@example.com");
  assertEquals(mockSentEmails[0].payload.eventName, "order_placed");
  assertEquals(mockSentEmails[0].payload.orderId, "abc");
});

// ── accumulation and reset ────────────────────────────────────────────────────

Deno.test("mockSentEmails accumulates across multiple calls", async () => {
  __resetLoopsMock();
  await sendTransactional("tmpl_a", "a@example.com", {});
  await upsertContact("b@example.com", {});
  await sendEvent("c@example.com", "signup", {});
  assertEquals(mockSentEmails.length, 3);
  assertEquals(mockSentEmails[0].kind, "transactional");
  assertEquals(mockSentEmails[1].kind, "contact");
  assertEquals(mockSentEmails[2].kind, "event");
});

Deno.test("__resetLoopsMock empties mockSentEmails", async () => {
  __resetLoopsMock();
  await sendTransactional("tmpl_a", "a@example.com", {});
  assertEquals(mockSentEmails.length, 1);
  __resetLoopsMock();
  assertEquals(mockSentEmails.length, 0);
});

// ── live transport: missing key throws ────────────────────────────────────────

Deno.test("sendTransactional: throws in live mode when LOOPS_API_KEY is missing", async () => {
  const prevTransport = Deno.env.get("LOOPS_TRANSPORT");
  const prevKey = Deno.env.get("LOOPS_API_KEY");
  try {
    Deno.env.set("LOOPS_TRANSPORT", "live");
    if (prevKey !== undefined) Deno.env.delete("LOOPS_API_KEY");
    await assertRejects(
      () => sendTransactional("tmpl_123", "user@example.com", {}),
      Error,
      "LOOPS_API_KEY",
    );
  } finally {
    if (prevTransport !== undefined) {
      Deno.env.set("LOOPS_TRANSPORT", prevTransport);
    } else {
      Deno.env.delete("LOOPS_TRANSPORT");
    }
    if (prevKey !== undefined) Deno.env.set("LOOPS_API_KEY", prevKey);
  }
});
