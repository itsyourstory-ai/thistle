import { assert, assertEquals } from "jsr:@std/assert";
import { __resetLoopsMock, LOOPS_TEMPLATES, mockSentEmails } from "./loops.ts";
import { finishBook, summarizeGaps, verifyComplete } from "./bookCompletion.ts";
import type { GeneratedBookRow } from "./bookEmails.ts";

// A small fake of the two tables finishBook touches. `images` are the
// book_images rows; `updates` records every generated_books update.
function makeFakeDb(images: Array<Record<string, unknown>>) {
  const updates: Array<{ table: string; values: Record<string, unknown>; id: unknown }> = [];
  const db = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return Promise.resolve({ data: table === "book_images" ? images : [], error: null });
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq(_col: string, id: unknown) {
              updates.push({ table, values, id });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
    updates,
  };
  return db;
}

const PARSED = {
  pages: [
    { page_number: 1, image_prompt: "a fox" },
    { page_number: 2, image_prompt: "a bear" },
  ],
};

function makeBook(overrides: Partial<GeneratedBookRow> = {}): GeneratedBookRow {
  return {
    id: "book-1",
    buyer_email: "buyer@example.com",
    brief: { child: { name: "Mira" } },
    creating_email_sent_at: null,
    ready_email_sent_at: null,
    failed_email_sent_at: null,
    ...overrides,
  };
}

function image(kind: string, slot: number, driveFileId: string | null, status = "ok") {
  return { kind, slot, status, drive_file_id: driveFileId };
}

const ALL_GENERATED_NONE_UPLOADED = [
  image("portrait", 1, null),
  image("page", 1, null),
  image("page", 2, null),
];

const ALL_GENERATED_AND_UPLOADED = [
  image("portrait", 1, "f0"),
  image("page", 1, "f1"),
  image("page", 2, "f2"),
];

// ── finishBook ───────────────────────────────────────────────────────────────

Deno.test("customer gets their book and the ready email even when every Drive upload failed", async () => {
  __resetLoopsMock();
  const db = makeFakeDb(ALL_GENERATED_NONE_UPLOADED);

  const result = await finishBook(db, makeBook(), PARSED);

  assertEquals(result.ok, true);
  assertEquals(db.updates[0].values.pipeline_status, "done");
  assertEquals(mockSentEmails.length, 1);
  assertEquals(mockSentEmails[0].payload.transactionalId, LOOPS_TEMPLATES.bookReady);
  assertEquals(db.updates.some((u) => u.values.pipeline_status === "failed"), false);
});

Deno.test("Drive upload failures are logged as errors so they show up in alerts", async () => {
  __resetLoopsMock();
  const db = makeFakeDb(ALL_GENERATED_NONE_UPLOADED);
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logged.push(args.join(" "));
  try {
    const result = await finishBook(db, makeBook(), PARSED);
    assertEquals(result.ok && result.notUploaded, ["portrait/1", "page/1", "page/2"]);
  } finally {
    console.error = original;
  }
  assertEquals(logged.length, 1);
  assert(logged[0].includes("book-1"));
  assert(logged[0].includes("page/2"));
});

Deno.test("a book whose images all reached Drive is done without any error logged", async () => {
  __resetLoopsMock();
  const db = makeFakeDb(ALL_GENERATED_AND_UPLOADED);
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logged.push(args.join(" "));
  try {
    const result = await finishBook(db, makeBook(), PARSED);
    assertEquals(result.ok && result.notUploaded, []);
  } finally {
    console.error = original;
  }
  assertEquals(logged.length, 0);
  assertEquals(db.updates[0].values.pipeline_status, "done");
  assertEquals(mockSentEmails[0].payload.transactionalId, LOOPS_TEMPLATES.bookReady);
});

Deno.test("a book with a page that was never generated still fails and sends the failed email", async () => {
  __resetLoopsMock();
  const db = makeFakeDb([
    image("portrait", 1, "f0"),
    image("page", 1, "f1"),
    image("page", 2, null, "failed"),
  ]);

  const result = await finishBook(db, makeBook(), PARSED);

  assertEquals(result.ok, false);
  assertEquals(db.updates[0].values.pipeline_status, "failed");
  assertEquals(db.updates[0].values.pipeline_error, "Book incomplete: missing 1 page(s) (2)");
  assertEquals(mockSentEmails.length, 1);
  assertEquals(mockSentEmails[0].payload.transactionalId, LOOPS_TEMPLATES.bookFailed);
});

// ── verifyComplete ───────────────────────────────────────────────────────────

Deno.test("a missing portrait counts as an incomplete book", async () => {
  const db = makeFakeDb([image("page", 1, "f1"), image("page", 2, "f2")]);

  const verdict = await verifyComplete(db, "book-1", PARSED);

  assertEquals(verdict.ok, false);
  assertEquals(verdict.gaps, [{ kind: "portrait", slot: 1, reason: "not_generated" }]);
});

Deno.test("images that were not uploaded to Drive are listed but don't make the book incomplete", async () => {
  const db = makeFakeDb([
    image("portrait", 1, "f0"),
    image("page", 1, null),
    image("page", 2, "f2"),
  ]);

  const verdict = await verifyComplete(db, "book-1", PARSED);

  assertEquals(verdict.ok, true);
  assertEquals(verdict.gaps, []);
  assertEquals(verdict.notUploaded, ["page/1"]);
});

// ── summarizeGaps ────────────────────────────────────────────────────────────

Deno.test("the failure summary names the missing pages and portrait", () => {
  assertEquals(
    summarizeGaps([
      { kind: "page", slot: 3, reason: "not_generated" },
      { kind: "page", slot: 5, reason: "not_generated" },
      { kind: "portrait", slot: 1, reason: "not_generated" },
    ]),
    "Book incomplete: missing 2 page(s) (3, 5); portrait not generated",
  );
});
