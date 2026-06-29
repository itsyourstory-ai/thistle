import { assertEquals, assertExists } from "jsr:@std/assert";
import { __resetLoopsMock, LOOPS_TEMPLATES, mockSentEmails } from "./loops.ts";
import {
  maybeSendAbandoned,
  maybeSendPaymentFailed,
  maybeSendReceipt,
  maybeSendRefund,
  type OrderRow,
  resumeLink,
} from "./orderEmails.ts";

function makeFakeDb() {
  const calls: Array<
    { table: string; values: Record<string, unknown>; eq: [string, unknown] }
  > = [];
  const db = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return {
            async eq(col: string, val: unknown) {
              calls.push({ table, values, eq: [col, val] });
              return { error: null };
            },
          };
        },
      };
    },
    calls,
  };
  return db;
}

function makeOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1",
    product: "digital",
    amount_cents: 499,
    buyer_name: "Jordan",
    buyer_email: "buyer@example.com",
    shipping: null,
    draft_id: "draft-1",
    receipt_email_sent_at: null,
    payment_failed_email_sent_at: null,
    refund_email_sent_at: null,
    abandoned_email_sent_at: null,
    ...overrides,
  };
}

function assertSingleOrderStamp(
  db: ReturnType<typeof makeFakeDb>,
  column: string,
  orderId = "order-1",
) {
  assertEquals(db.calls.length, 1);
  assertEquals(db.calls[0].table, "orders");
  assertEquals(db.calls[0].eq, ["id", orderId]);
  assertEquals(typeof db.calls[0].values[column], "string");
}

Deno.test("maybeSendReceipt: sends receipt with hardcover shipping and stamps order", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();
  const order = makeOrder({
    product: "hardcover",
    amount_cents: 5499,
    shipping: {
      name: "Jordan",
      street1: "123 Main St",
      street2: "Apt 4",
      city: "Denver",
      state_code: "CO",
      country_code: "US",
      postcode: "80202",
      phone: "555-0100",
    },
  });

  const result = await maybeSendReceipt(db, order);

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(
    mockSentEmails[0].payload.transactionalId,
    LOOPS_TEMPLATES.orderReceipt,
  );
  assertEquals(mockSentEmails[0].payload.email, "buyer@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    orderId: "order-1",
    product: "hardcover",
    amountCents: 5499,
    buyerName: "Jordan",
    shipping: order.shipping,
  });
  assertSingleOrderStamp(db, "receipt_email_sent_at");
});

Deno.test("maybeSendReceipt: sends digital receipt without shipping", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendReceipt(db, makeOrder());

  assertEquals(result, true);
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    orderId: "order-1",
    product: "digital",
    amountCents: 499,
    buyerName: "Jordan",
  });
  assertSingleOrderStamp(db, "receipt_email_sent_at");
});

Deno.test("maybeSendReceipt: skips when already stamped", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendReceipt(
    db,
    makeOrder({ receipt_email_sent_at: "2026-01-01T00:00:00.000Z" }),
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendReceipt: skips when buyer_email is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendReceipt(db, makeOrder({ buyer_email: null }));

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendPaymentFailed: sends retry URL and stamps order", async () => {
  __resetLoopsMock();
  Deno.env.set("APP_BASE_URL", "https://thistlebook.com");
  const db = makeFakeDb();

  const result = await maybeSendPaymentFailed(db, makeOrder());

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(
    mockSentEmails[0].payload.transactionalId,
    LOOPS_TEMPLATES.paymentFailed,
  );
  assertEquals(mockSentEmails[0].payload.email, "buyer@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    retryUrl: "https://thistlebook.com/resume/draft-1",
  });
  assertSingleOrderStamp(db, "payment_failed_email_sent_at");
});

Deno.test("maybeSendPaymentFailed: skips when already stamped", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendPaymentFailed(
    db,
    makeOrder({ payment_failed_email_sent_at: "2026-01-01T00:00:00.000Z" }),
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendPaymentFailed: skips when buyer_email is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendPaymentFailed(
    db,
    makeOrder({ buyer_email: null }),
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendRefund: sends partial refund amount and stamps order", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendRefund(db, makeOrder(), 1234);

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(
    mockSentEmails[0].payload.transactionalId,
    LOOPS_TEMPLATES.refund,
  );
  assertEquals(mockSentEmails[0].payload.email, "buyer@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    orderId: "order-1",
    amount: 1234,
  });
  assertSingleOrderStamp(db, "refund_email_sent_at");
});

Deno.test("maybeSendRefund: skips when already stamped", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendRefund(
    db,
    makeOrder({ refund_email_sent_at: "2026-01-01T00:00:00.000Z" }),
    1234,
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendRefund: skips when buyer_email is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendRefund(
    db,
    makeOrder({ buyer_email: null }),
    1234,
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendAbandoned: sends resume URL and stamps order", async () => {
  __resetLoopsMock();
  Deno.env.set("APP_BASE_URL", "https://thistlebook.com");
  const db = makeFakeDb();

  const result = await maybeSendAbandoned(db, makeOrder());

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(
    mockSentEmails[0].payload.transactionalId,
    LOOPS_TEMPLATES.abandonedCheckout,
  );
  assertEquals(mockSentEmails[0].payload.email, "buyer@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    resumeUrl: "https://thistlebook.com/resume/draft-1",
  });
  assertSingleOrderStamp(db, "abandoned_email_sent_at");
});

Deno.test("maybeSendAbandoned: skips when already stamped", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendAbandoned(
    db,
    makeOrder({ abandoned_email_sent_at: "2026-01-01T00:00:00.000Z" }),
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendAbandoned: skips when buyer_email is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendAbandoned(db, makeOrder({ buyer_email: null }));

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("resumeLink: falls back to dashboard when draft_id is null", () => {
  Deno.env.set("APP_BASE_URL", "https://thistlebook.com/");

  assertEquals(
    resumeLink(makeOrder({ draft_id: null })),
    "https://thistlebook.com/dashboard",
  );
});

Deno.test("resumeLink: uses localhost fallback when APP_BASE_URL is unset", () => {
  Deno.env.delete("APP_BASE_URL");

  const link = resumeLink(makeOrder({ draft_id: "draft-1" }));

  assertExists(link);
  assertEquals(link, "http://localhost:8080/resume/draft-1");
});
