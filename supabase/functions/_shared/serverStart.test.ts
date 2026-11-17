import { assert, assertEquals } from "jsr:@std/assert";
import {
  clearSeedPortraitForBook,
  loadRetryInputs,
  loadServerStartInputs,
  MAX_SEED_PORTRAIT_CHARS,
  prepareOrderBookInputs,
  saveBookInputsIfSent,
  saveOrderBookInputs,
  startBookForOrder,
} from "./serverStart.ts";

// ── prepareOrderBookInputs ───────────────────────────────────────────────────
// The app sends these on the pre-payment create-payment-intent call. The field
// names here (brief, seed_portrait_data_url) must match what the app sends.

const PORTRAIT = "data:image/png;base64,AAAA";

Deno.test("order inputs: nothing to save when the request has no brief", () => {
  assertEquals(prepareOrderBookInputs({ product: "digital", draft_id: "d1" }), null);
});

Deno.test("order inputs: a brief that isn't an object is ignored", () => {
  for (const brief of ["text", 5, null, ["a"]]) {
    assertEquals(prepareOrderBookInputs({ brief }), null);
  }
});

Deno.test("order inputs: reference photos are stripped from the saved brief", () => {
  const result = prepareOrderBookInputs({
    brief: {
      child: { name: "Ellie" },
      protagonist: { photos: ["data:image/jpeg;base64,BBBB"], photoDataUrl: "data:image/jpeg;base64,BBBB" },
    },
    seed_portrait_data_url: PORTRAIT,
  });
  assertEquals(result?.brief, {
    child: { name: "Ellie" },
    protagonist: { photos: null, photoDataUrl: null },
  });
});

Deno.test("order inputs: the seed portrait is kept when it is an image data URL", () => {
  const result = prepareOrderBookInputs({ brief: { a: 1 }, seed_portrait_data_url: PORTRAIT });
  assertEquals(result?.seed_portrait_data_url, PORTRAIT);
});

Deno.test("order inputs: a missing or bad seed portrait is dropped but the brief is still saved", () => {
  const tooBig = "data:image/png;base64," + "A".repeat(MAX_SEED_PORTRAIT_CHARS);
  for (const seed of [undefined, null, "", "https://example.com/x.png", "data:text/html;base64,AAAA", 42, tooBig]) {
    const result = prepareOrderBookInputs({ brief: { a: 1 }, seed_portrait_data_url: seed });
    assertEquals(result, { brief: { a: 1 }, seed_portrait_data_url: null });
  }
});

// ── saveOrderBookInputs ──────────────────────────────────────────────────────

Deno.test("order inputs: saved as one row per order, replacing any earlier save", async () => {
  const calls: { table: string; row: Record<string, unknown>; opts: unknown }[] = [];
  const db = {
    from(table: string) {
      return {
        upsert(row: Record<string, unknown>, opts: unknown) {
          calls.push({ table, row, opts });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await saveOrderBookInputs(db, "order-1", { brief: { a: 1 }, seed_portrait_data_url: PORTRAIT });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "order_book_inputs");
  assertEquals(calls[0].row.order_id, "order-1");
  assertEquals(calls[0].row.brief, { a: 1 });
  assertEquals(calls[0].row.seed_portrait_data_url, PORTRAIT);
  assertEquals(calls[0].opts, { onConflict: "order_id" });
});

Deno.test("order inputs: a database error while saving is thrown so the caller can log it", async () => {
  const db = {
    from: () => ({ upsert: () => Promise.resolve({ error: new Error("boom") }) }),
  };
  let threw = false;
  try {
    await saveOrderBookInputs(db, "order-1", { brief: {}, seed_portrait_data_url: null });
  } catch {
    threw = true;
  }
  assert(threw);
});

// ── loadServerStartInputs ────────────────────────────────────────────────────

type Rows = Record<string, Record<string, unknown> | null>;

/** Fake read client: `from(table).select(..).eq(..).maybeSingle()` returns rows[table]. */
function fakeReadDb(rows: Rows, errors: Record<string, unknown> = {}) {
  return {
    from(table: string) {
      return {
        select() {
          const filter = {
            eq: () => filter,
            maybeSingle: () => Promise.resolve({ data: rows[table] ?? null, error: errors[table] ?? null }),
          };
          return filter;
        },
      };
    },
  };
}

const ORDER = {
  id: "order-1",
  user_id: "user-1",
  draft_id: "draft-1",
  buyer_name: "Sarah",
  buyer_email: "sarah@example.com",
};
const INPUTS = { brief: { child: { name: "Ellie" } }, seed_portrait_data_url: PORTRAIT };

Deno.test("server start: loads the owner, buyer and saved inputs from the order", async () => {
  const result = await loadServerStartInputs(
    fakeReadDb({ orders: ORDER, order_book_inputs: INPUTS }),
    "order-1",
  );
  assertEquals(result, {
    ok: true,
    orderId: "order-1",
    userId: "user-1",
    draftId: "draft-1",
    buyerName: "Sarah",
    buyerEmail: "sarah@example.com",
    brief: { child: { name: "Ellie" } },
    seedPortraitDataUrl: PORTRAIT,
  });
});

Deno.test("server start: a missing order_id is a 400", async () => {
  for (const orderId of [undefined, null, "", 5]) {
    const result = await loadServerStartInputs(fakeReadDb({}), orderId);
    assertEquals(result, { ok: false, status: 400, error: "order_id is required." });
  }
});

Deno.test("server start: an unknown order is a 404", async () => {
  const result = await loadServerStartInputs(fakeReadDb({ orders: null }), "order-x");
  assertEquals(result, { ok: false, status: 404, error: "Order not found." });
});

Deno.test("server start: an order with no saved inputs is a 422 (older orders, or the save failed)", async () => {
  const result = await loadServerStartInputs(fakeReadDb({ orders: ORDER, order_book_inputs: null }), "order-1");
  assertEquals(result, { ok: false, status: 422, error: "No saved book details for this order." });
});

Deno.test("server start: a database error is a 500, so the webhook retries", async () => {
  const result = await loadServerStartInputs(
    fakeReadDb({ orders: ORDER }, { orders: new Error("db down") }),
    "order-1",
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.status, 500);
});

// ── loadRetryInputs (THI-10) ─────────────────────────────────────────────────
// The buyer's browser retries a failed book with just `retry_book_id`. The
// server finds the caller's own order for that book and loads its saved inputs.

/** Fake read client that applies `.eq()` filters to real row lists, like Postgres would. */
function fakeFilteringDb(tables: Record<string, Record<string, unknown>[]>, errors: Record<string, unknown> = {}) {
  return {
    from(table: string) {
      return {
        select() {
          const filters: [string, unknown][] = [];
          const filter = {
            eq(col: string, val: unknown) {
              filters.push([col, val]);
              return filter;
            },
            maybeSingle() {
              const match = (tables[table] ?? []).find((row) => filters.every(([c, v]) => row[c] === v));
              return Promise.resolve({ data: match ?? null, error: errors[table] ?? null });
            },
          };
          return filter;
        },
      };
    },
  };
}

const RETRY_TABLES = {
  orders: [{ ...ORDER, book_id: "book-1" }],
  order_book_inputs: [{ order_id: "order-1", ...INPUTS }],
};

Deno.test("retry: loads the saved inputs for the caller's own book", async () => {
  const result = await loadRetryInputs(fakeFilteringDb(RETRY_TABLES), "user-1", "book-1");
  assertEquals(result, {
    ok: true,
    orderId: "order-1",
    userId: "user-1",
    draftId: "draft-1",
    buyerName: "Sarah",
    buyerEmail: "sarah@example.com",
    brief: { child: { name: "Ellie" } },
    seedPortraitDataUrl: PORTRAIT,
  });
});

Deno.test("retry: someone else's book is a 404, same as a book that doesn't exist", async () => {
  const result = await loadRetryInputs(fakeFilteringDb(RETRY_TABLES), "user-2", "book-1");
  assertEquals(result, { ok: false, status: 404, error: "Book not found." });
});

Deno.test("retry: a book with no order (made with the dev bypass) is a 404", async () => {
  const result = await loadRetryInputs(fakeFilteringDb(RETRY_TABLES), "user-1", "book-unlinked");
  assertEquals(result, { ok: false, status: 404, error: "Book not found." });
});

Deno.test("retry: an order with no saved inputs is a 422 with a message the buyer can act on", async () => {
  const result = await loadRetryInputs(
    fakeFilteringDb({ orders: RETRY_TABLES.orders, order_book_inputs: [] }),
    "user-1",
    "book-1",
  );
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 422);
    assert(result.error.includes("support@thistlebook.com"));
  }
});

Deno.test("retry: an id that isn't a UUID is a 404, not a server error", async () => {
  const result = await loadRetryInputs(
    fakeFilteringDb(RETRY_TABLES, { orders: { code: "22P02", message: "invalid input syntax for type uuid" } }),
    "user-1",
    "not-a-uuid",
  );
  assertEquals(result, { ok: false, status: 404, error: "Book not found." });
});

Deno.test("retry: a missing book id is a 400", async () => {
  for (const bookId of [undefined, null, "", 5]) {
    const result = await loadRetryInputs(fakeFilteringDb(RETRY_TABLES), "user-1", bookId);
    assertEquals(result, { ok: false, status: 400, error: "retry_book_id is required." });
  }
});

Deno.test("retry: a database error is a 500", async () => {
  const result = await loadRetryInputs(
    fakeFilteringDb(RETRY_TABLES, { orders: new Error("db down") }),
    "user-1",
    "book-1",
  );
  assertEquals(result, { ok: false, status: 500, error: "Order lookup failed." });
});

// ── saveBookInputsIfSent ─────────────────────────────────────────────────────
// create-payment-intent calls this on every path that returns, so the app can
// rely on book_inputs_saved (true / false / null = nothing was sent).

Deno.test("save inputs: nothing sent → null (no database call)", async () => {
  let called = false;
  const db = { from: () => ({ upsert: () => { called = true; return Promise.resolve({ error: null }); } }) };
  assertEquals(await saveBookInputsIfSent(db, "order-1", { product: "digital" }), null);
  assertEquals(called, false);
});

Deno.test("save inputs: saved → true", async () => {
  const db = { from: () => ({ upsert: () => Promise.resolve({ error: null }) }) };
  assertEquals(await saveBookInputsIfSent(db, "order-1", { brief: { a: 1 }, seed_portrait_data_url: PORTRAIT }), true);
});

Deno.test("save inputs: a database error → false, not thrown (payment must not break)", async () => {
  const db = { from: () => ({ upsert: () => Promise.resolve({ error: new Error("boom") }) }) };
  assertEquals(await saveBookInputsIfSent(db, "order-1", { brief: { a: 1 } }), false);
});

// ── startBookForOrder ────────────────────────────────────────────────────────

function httpError(status: number, body?: unknown) {
  return { context: { status, json: () => Promise.resolve(body) } };
}

Deno.test("start book: calls generate-book with just the order id", async () => {
  const seen: { name: string; body: unknown }[] = [];
  const result = await startBookForOrder(async (name, body) => {
    seen.push({ name, body });
    return { data: { id: "book-1", queued: true }, error: null };
  }, "order-1");
  assertEquals(result.outcome, "started");
  assertEquals(seen, [{ name: "generate-book", body: { order_id: "order-1" } }]);
});

Deno.test("start book: the order already has a book → already_started", async () => {
  const result = await startBookForOrder(
    async () => ({ data: { id: "book-1", existing: true }, error: null }),
    "order-1",
  );
  assertEquals(result.outcome, "already_started");
});

Deno.test("start book: a 4xx (no saved inputs, refunded, not found) is skipped, not retried", async () => {
  for (const status of [400, 402, 404, 422]) {
    const result = await startBookForOrder(async () => ({ data: null, error: httpError(status) }), "order-1");
    assertEquals(result.outcome, "skipped");
    assertEquals(result.status, status);
  }
});

Deno.test("start book: a skipped result carries generate-book's reason, so the log says why", async () => {
  const result = await startBookForOrder(
    async () => ({ data: null, error: httpError(422, { error: "No saved book details for this order." }) }),
    "order-1",
  );
  assertEquals(result, { outcome: "skipped", status: 422, detail: "No saved book details for this order." });
});

Deno.test("start book: a reason that can't be read doesn't break the result", async () => {
  const error = { context: { status: 403, json: () => Promise.reject(new Error("not json")) } };
  const result = await startBookForOrder(async () => ({ data: null, error }), "order-1");
  assertEquals(result, { outcome: "skipped", status: 403, detail: undefined });
});

Deno.test("start book: a 5xx, 408, 429 or an error with no status is retried", async () => {
  for (const status of [500, 502, 546, 408, 429]) {
    const result = await startBookForOrder(async () => ({ data: null, error: httpError(status) }), "order-1");
    assertEquals(result.outcome, "retry");
  }
  const noStatus = await startBookForOrder(async () => ({ data: null, error: new Error("network") }), "order-1");
  assertEquals(noStatus.outcome, "retry");
});

Deno.test("start book: a thrown error is retried", async () => {
  const result = await startBookForOrder(() => Promise.reject(new Error("offline")), "order-1");
  assertEquals(result.outcome, "retry");
});

// ── clearSeedPortraitForBook ─────────────────────────────────────────────────
// Once a book is done the saved portrait isn't needed again, and it's a
// multi-MB likeness of a child, so it is cleared. The brief stays (it has no photos).

function fakeClearDb(orderIds: string[], opts: { selectError?: unknown; updateError?: unknown } = {}) {
  const updates: { table: string; values: Record<string, unknown>; ids: string[] }[] = [];
  const selects: { table: string; col: string; val: unknown }[] = [];
  const db = {
    from(table: string) {
      return {
        select() {
          return {
            eq(col: string, val: unknown) {
              selects.push({ table, col, val });
              return Promise.resolve({
                data: opts.selectError ? null : orderIds.map((id) => ({ id })),
                error: opts.selectError ?? null,
              });
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            in(_col: string, ids: string[]) {
              updates.push({ table, values, ids });
              return Promise.resolve({ error: opts.updateError ?? null });
            },
          };
        },
      };
    },
  };
  return { db, updates, selects };
}

Deno.test("clear portrait: nulls the saved portrait for the order that owns the book", async () => {
  const { db, updates, selects } = fakeClearDb(["order-1"]);
  await clearSeedPortraitForBook(db, "book-1");
  assertEquals(selects, [{ table: "orders", col: "book_id", val: "book-1" }]);
  assertEquals(updates, [{
    table: "order_book_inputs",
    values: { seed_portrait_data_url: null },
    ids: ["order-1"],
  }]);
});

Deno.test("clear portrait: a book with no order (dev bypass) changes nothing", async () => {
  const { db, updates } = fakeClearDb([]);
  await clearSeedPortraitForBook(db, "book-1");
  assertEquals(updates, []);
});

Deno.test("clear portrait: database errors are thrown so the caller can log them", async () => {
  for (const opts of [{ selectError: new Error("a") }, { updateError: new Error("b") }]) {
    const { db } = fakeClearDb(["order-1"], opts);
    let threw = false;
    try {
      await clearSeedPortraitForBook(db, "book-1");
    } catch {
      threw = true;
    }
    assert(threw);
  }
});
