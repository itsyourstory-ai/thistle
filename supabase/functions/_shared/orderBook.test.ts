import { assertEquals } from "jsr:@std/assert";
import {
  claimOrderBook,
  STALE_STORY_MS,
  decideBookForOrder,
  orderPaymentState,
} from "./orderBook.ts";

// ── orderPaymentState ────────────────────────────────────────────────────────

Deno.test("order payment: paid order passes", () => {
  assertEquals(orderPaymentState({ status: "paid" }), "paid");
});

Deno.test("order payment: refunded order is refused (THI-36)", () => {
  // Stripe keeps a refunded PaymentIntent at "succeeded", so the order row's
  // status is the only signal and must be checked before the Stripe fallback.
  assertEquals(orderPaymentState({ status: "refunded" }), "refunded");
});

Deno.test("order payment: pending or failed orders need the Stripe check", () => {
  for (const status of ["pending", "failed", null, undefined, ""]) {
    assertEquals(orderPaymentState({ status }), "check_stripe");
  }
});

// ── decideBookForOrder ───────────────────────────────────────────────────────

const NOW = Date.parse("2026-11-12T12:00:00Z");
const RECENT = new Date(NOW - 60_000).toISOString();
const STALE = new Date(NOW - STALE_STORY_MS - 1).toISOString();

Deno.test("order book: no book yet → create", () => {
  assertEquals(decideBookForOrder(null, null), { action: "create", claimFrom: null });
});

Deno.test("order book: in-progress book → return it, create nothing", () => {
  for (const pipeline_status of ["story", "portraits", "pages", "uploading", "idle", null]) {
    assertEquals(
      decideBookForOrder("book-1", { id: "book-1", pipeline_status, has_story: false, story_started_at: RECENT }, NOW),
      { action: "existing", bookId: "book-1" },
    );
  }
});

Deno.test("order book: finished book → return it, create nothing", () => {
  assertEquals(
    decideBookForOrder("book-1", { id: "book-1", pipeline_status: "done", has_story: true, story_started_at: RECENT }),
    { action: "existing", bookId: "book-1" },
  );
});

Deno.test("order book: failed before the story was written → restart the same book from the story", () => {
  assertEquals(
    decideBookForOrder("book-1", { id: "book-1", pipeline_status: "failed", has_story: false, story_started_at: RECENT }),
    { action: "restart", bookId: "book-1", from: "story", reason: "failed" },
  );
});

Deno.test("order book: failed during images → restart the same book from the images", () => {
  assertEquals(
    decideBookForOrder("book-1", { id: "book-1", pipeline_status: "failed", has_story: true, story_started_at: RECENT }),
    { action: "restart", bookId: "book-1", from: "images", reason: "failed" },
  );
});

Deno.test("order book: story run whose worker died (stuck at story) → restart the same book", () => {
  assertEquals(
    decideBookForOrder("book-1", { id: "book-1", pipeline_status: "story", has_story: false, story_started_at: STALE }, NOW),
    { action: "restart", bookId: "book-1", from: "story", reason: "stale_story" },
  );
});

Deno.test("order book: story still being written → return it, don't restart", () => {
  assertEquals(
    decideBookForOrder("book-1", { id: "book-1", pipeline_status: "story", has_story: false, story_started_at: RECENT }, NOW),
    { action: "existing", bookId: "book-1" },
  );
});

Deno.test("order book: stuck at story with no start time → restart", () => {
  assertEquals(
    decideBookForOrder("book-1", { id: "book-1", pipeline_status: "story", has_story: false, story_started_at: null }, NOW),
    { action: "restart", bookId: "book-1", from: "story", reason: "stale_story" },
  );
});

Deno.test("order book: slow images are never treated as stale", () => {
  assertEquals(
    decideBookForOrder("book-1", { id: "book-1", pipeline_status: "pages", has_story: true, story_started_at: STALE }, NOW),
    { action: "existing", bookId: "book-1" },
  );
});

Deno.test("order book: linked book row is missing → create and replace the stale link", () => {
  assertEquals(decideBookForOrder("gone", null), { action: "create", claimFrom: "gone" });
});

// ── claimOrderBook ───────────────────────────────────────────────────────────

type Filter = [op: "eq" | "is", col: string, val: unknown];

function makeFakeOrders(row: { id: string; user_id: string; book_id: string | null }) {
  const updates: Array<{ values: Record<string, unknown>; filters: Filter[] }> = [];
  const db = {
    from(table: string) {
      if (table !== "orders") throw new Error(`unexpected table ${table}`);
      return {
        update(values: Record<string, unknown>) {
          const filters: Filter[] = [];
          const chain = {
            eq(col: string, val: unknown) {
              filters.push(["eq", col, val]);
              return chain;
            },
            is(col: string, val: null) {
              filters.push(["is", col, val]);
              return chain;
            },
            async select(_cols: string) {
              updates.push({ values, filters });
              const matches = filters.every(([, col, val]) =>
                (row as Record<string, unknown>)[col] === val
              );
              if (!matches) return { data: [], error: null };
              Object.assign(row, values);
              return { data: [{ id: row.id }], error: null };
            },
          };
          return chain;
        },
      };
    },
  };
  return { db, row, updates };
}

Deno.test("claim: links the book when the order has none", async () => {
  const fake = makeFakeOrders({ id: "o1", user_id: "u1", book_id: null });
  assertEquals(await claimOrderBook(fake.db, { orderId: "o1", userId: "u1", bookId: "b1", claimFrom: null }), true);
  assertEquals(fake.row.book_id, "b1");
});

Deno.test("claim: loses when another call already linked a book (two calls at once)", async () => {
  const fake = makeFakeOrders({ id: "o1", user_id: "u1", book_id: "winner" });
  assertEquals(await claimOrderBook(fake.db, { orderId: "o1", userId: "u1", bookId: "b2", claimFrom: null }), false);
  assertEquals(fake.row.book_id, "winner");
});

Deno.test("claim: replaces a stale link only if it's still the stale one", async () => {
  const fake = makeFakeOrders({ id: "o1", user_id: "u1", book_id: "gone" });
  assertEquals(await claimOrderBook(fake.db, { orderId: "o1", userId: "u1", bookId: "b1", claimFrom: "gone" }), true);
  assertEquals(fake.row.book_id, "b1");
});

Deno.test("claim: never touches another user's order", async () => {
  const fake = makeFakeOrders({ id: "o1", user_id: "someone-else", book_id: null });
  assertEquals(await claimOrderBook(fake.db, { orderId: "o1", userId: "u1", bookId: "b1", claimFrom: null }), false);
  assertEquals(fake.row.book_id, null);
});
