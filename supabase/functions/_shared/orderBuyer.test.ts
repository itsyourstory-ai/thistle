import { assert, assertEquals } from "jsr:@std/assert";
import { saveBuyerDetailsOnOrder, trySaveBuyerDetailsOnOrder } from "./orderBuyer.ts";

// THI-67: when a promo code stops working between "Apply" and "Pay",
// create-payment-intent returns the order unchanged. It must still save the
// buyer's details (the receipt needs the email) without touching the price.

interface UpdateCall {
  table: string;
  values: Record<string, unknown>;
  col: string;
  val: unknown;
}

function fakeDb(error: unknown = null) {
  const calls: UpdateCall[] = [];
  const db = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              calls.push({ table, values, col, val });
              return Promise.resolve({ error });
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

const SHIPPING = {
  name: "Sarah",
  street1: "1 Main St",
  city: "Austin",
  state_code: "TX",
  postcode: "78701",
  country_code: "US",
  phone: "5125550100",
};

Deno.test("invalid promo code: the buyer's name, email and shipping are still saved on the order", async () => {
  const { db, calls } = fakeDb();
  await saveBuyerDetailsOnOrder(db, "order-1", {
    buyer_name: "Sarah",
    buyer_email: "sarah@example.com",
    shipping: SHIPPING,
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "orders");
  assertEquals(calls[0].col, "id");
  assertEquals(calls[0].val, "order-1");
  assertEquals(calls[0].values.buyer_name, "Sarah");
  assertEquals(calls[0].values.buyer_email, "sarah@example.com");
  assertEquals(calls[0].values.shipping, SHIPPING);
});

Deno.test("invalid promo code: the price on the order is never changed", async () => {
  const { db, calls } = fakeDb();
  await saveBuyerDetailsOnOrder(db, "order-1", {
    buyer_name: "Sarah",
    buyer_email: "sarah@example.com",
    shipping: null,
  });
  const written = Object.keys(calls[0].values);
  for (const field of ["amount_cents", "base_amount_cents", "discount_cents", "discount_code", "product"]) {
    assert(!written.includes(field), `${field} must not be written`);
  }
});

Deno.test("invalid promo code: a request with no buyer details doesn't blank ones saved earlier", async () => {
  // The "Apply" click sends no name or email. A bad code typed after the
  // details were saved must not erase them.
  const { db, calls } = fakeDb();
  await saveBuyerDetailsOnOrder(db, "order-1", {
    buyer_name: null,
    buyer_email: null,
    shipping: null,
  });
  assertEquals(calls, []);
});

Deno.test("invalid promo code: only the details that were sent are written", async () => {
  const { db, calls } = fakeDb();
  await saveBuyerDetailsOnOrder(db, "order-1", {
    buyer_name: null,
    buyer_email: "sarah@example.com",
    shipping: null,
  });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].values.buyer_email, "sarah@example.com");
  assert(!("buyer_name" in calls[0].values));
  assert(!("shipping" in calls[0].values));
});

Deno.test("invalid promo code: a database error is thrown so the caller can log it", async () => {
  const { db } = fakeDb(new Error("boom"));
  let threw = false;
  try {
    await saveBuyerDetailsOnOrder(db, "order-1", {
      buyer_name: "Sarah",
      buyer_email: "sarah@example.com",
      shipping: null,
    });
  } catch {
    threw = true;
  }
  assert(threw);
});

// ── trySaveBuyerDetailsOnOrder ───────────────────────────────────────────────
// create-payment-intent calls this on the invalid-promo-code path. A failed
// save must never break the response, because payment has to go ahead.

Deno.test("invalid promo code: a failed buyer-details save is reported as false, not thrown", async () => {
  const { db } = fakeDb(new Error("boom"));
  const saved = await trySaveBuyerDetailsOnOrder(db, "order-1", {
    buyer_name: "Sarah",
    buyer_email: "sarah@example.com",
    shipping: null,
  });
  assertEquals(saved, false);
});

Deno.test("invalid promo code: a successful buyer-details save is reported as true", async () => {
  const { db, calls } = fakeDb();
  const saved = await trySaveBuyerDetailsOnOrder(db, "order-1", {
    buyer_name: "Sarah",
    buyer_email: "sarah@example.com",
    shipping: null,
  });
  assertEquals(saved, true);
  assertEquals(calls.length, 1);
});

Deno.test("invalid promo code: nothing to save is not a failure", async () => {
  const { db, calls } = fakeDb();
  const saved = await trySaveBuyerDetailsOnOrder(db, "order-1", {
    buyer_name: null,
    buyer_email: null,
    shipping: null,
  });
  assertEquals(saved, true);
  assertEquals(calls, []);
});
