import { assertEquals, assertRejects } from "jsr:@std/assert";
import { getOwnedBookImage } from "./bookImage.ts";

type Row = Record<string, unknown>;

// Minimal fake of the Supabase read chain: select(...).eq(...).eq(...).maybeSingle()
function makeFakeDb(tables: Record<string, Row[]>, failTable?: string) {
  return {
    from(table: string) {
      return {
        select(_cols: string) {
          const filters: Array<[string, unknown]> = [];
          const chain = {
            eq(col: string, val: unknown) {
              filters.push([col, val]);
              return chain;
            },
            // deno-lint-ignore require-await
            async maybeSingle() {
              if (table === failTable) return { data: null, error: new Error("db down") };
              const rows = (tables[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v));
              return { data: rows[0] ?? null, error: null };
            },
          };
          return chain;
        },
      };
    },
  };
}

const PAGE_URL = "data:image/png;base64,PAGE3";

function makeTables(overrides: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    generated_books: [
      { id: "b1", user_id: "u1" },
      { id: "b2", user_id: "someone-else" },
    ],
    book_images: [
      { book_id: "b1", kind: "page", slot: 3, status: "ok", image_data_url: PAGE_URL },
      { book_id: "b2", kind: "page", slot: 3, status: "ok", image_data_url: "data:image/png;base64,SECRET" },
    ],
    ...overrides,
  };
}

Deno.test("book image: owner gets their page image", async () => {
  const db = makeFakeDb(makeTables());
  const result = await getOwnedBookImage(db, { userId: "u1", bookId: "b1", slot: 3 });
  assertEquals(result, { ok: true, dataUrl: PAGE_URL });
});

Deno.test("book image: someone else's book is not found, even though the image exists", async () => {
  const db = makeFakeDb(makeTables());
  const result = await getOwnedBookImage(db, { userId: "u1", bookId: "b2", slot: 3 });
  assertEquals(result, { ok: false, reason: "not_found" });
});

Deno.test("book image: a book that doesn't exist is not found", async () => {
  const db = makeFakeDb(makeTables());
  const result = await getOwnedBookImage(db, { userId: "u1", bookId: "nope", slot: 3 });
  assertEquals(result, { ok: false, reason: "not_found" });
});

Deno.test("book image: a page whose image failed to generate is not found", async () => {
  const db = makeFakeDb(makeTables({
    book_images: [{ book_id: "b1", kind: "page", slot: 3, status: "failed", image_data_url: null }],
  }));
  const result = await getOwnedBookImage(db, { userId: "u1", bookId: "b1", slot: 3 });
  assertEquals(result, { ok: false, reason: "not_found" });
});

Deno.test("book image: a page without an image row is not found", async () => {
  const db = makeFakeDb(makeTables());
  const result = await getOwnedBookImage(db, { userId: "u1", bookId: "b1", slot: 9 });
  assertEquals(result, { ok: false, reason: "not_found" });
});

Deno.test("book image: an image that isn't a data URL is never returned", async () => {
  for (const image_data_url of ["https://example.com/x.png", "javascript:alert(1)", "", null]) {
    const db = makeFakeDb(makeTables({
      book_images: [{ book_id: "b1", kind: "page", slot: 3, status: "ok", image_data_url }],
    }));
    const result = await getOwnedBookImage(db, { userId: "u1", bookId: "b1", slot: 3 });
    assertEquals(result, { ok: false, reason: "not_found" });
  }
});

Deno.test("book image: only page images are served, not other kinds in the same slot", async () => {
  const db = makeFakeDb(makeTables({
    book_images: [{ book_id: "b1", kind: "portrait", slot: 3, status: "ok", image_data_url: "data:image/png;base64,PORTRAIT" }],
  }));
  const result = await getOwnedBookImage(db, { userId: "u1", bookId: "b1", slot: 3 });
  assertEquals(result, { ok: false, reason: "not_found" });
});

Deno.test("book image: a database error is thrown, not reported as not found", async () => {
  const db = makeFakeDb(makeTables(), "generated_books");
  await assertRejects(
    () => getOwnedBookImage(db, { userId: "u1", bookId: "b1", slot: 3 }),
    Error,
    "db down",
  );
});
