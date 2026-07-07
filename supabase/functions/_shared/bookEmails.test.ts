import { assertEquals } from "jsr:@std/assert";
import { __resetLoopsMock, LOOPS_TEMPLATES, mockSentEmails } from "./loops.ts";
import {
  type GeneratedBookRow,
  maybeSendCreating,
  maybeSendFailed,
  maybeSendReady,
} from "./bookEmails.ts";

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

function makeBook(overrides: Partial<GeneratedBookRow> = {}): GeneratedBookRow {
  return {
    id: "book-1",
    buyer_email: "buyer@example.com",
    brief: {
      child: {
        name: "Mira",
      },
    },
    creating_email_sent_at: null,
    ready_email_sent_at: null,
    failed_email_sent_at: null,
    ...overrides,
  };
}

function assertSingleBookStamp(
  db: ReturnType<typeof makeFakeDb>,
  column: string,
  bookId = "book-1",
) {
  assertEquals(db.calls.length, 1);
  assertEquals(db.calls[0].table, "generated_books");
  assertEquals(db.calls[0].eq, ["id", bookId]);
  assertEquals(typeof db.calls[0].values[column], "string");
}

Deno.test("maybeSendCreating: sends creating email and stamps book", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendCreating(db, makeBook());

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(
    mockSentEmails[0].payload.transactionalId,
    LOOPS_TEMPLATES.bookCreating,
  );
  assertEquals(mockSentEmails[0].payload.email, "buyer@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    childName: "Mira",
    etaText: "about 5–10 minutes",
  });
  assertSingleBookStamp(db, "creating_email_sent_at");
});

Deno.test("maybeSendCreating: skips when already stamped", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendCreating(
    db,
    makeBook({ creating_email_sent_at: "2026-01-01T00:00:00.000Z" }),
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendCreating: skips when buyer_email is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendCreating(db, makeBook({ buyer_email: null }));

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendReady: sends ready email and stamps book", async () => {
  __resetLoopsMock();
  Deno.env.set("APP_BASE_URL", "https://thistlebook.com");
  const db = makeFakeDb();

  const result = await maybeSendReady(db, makeBook());

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(
    mockSentEmails[0].payload.transactionalId,
    LOOPS_TEMPLATES.bookReady,
  );
  assertEquals(mockSentEmails[0].payload.email, "buyer@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    childName: "Mira",
    previewUrl: "https://thistlebook.com/dashboard",
    bookId: "book-1",
  });
  assertSingleBookStamp(db, "ready_email_sent_at");
});

Deno.test("maybeSendReady: skips when already stamped", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendReady(
    db,
    makeBook({ ready_email_sent_at: "2026-01-01T00:00:00.000Z" }),
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendReady: skips when buyer_email is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendReady(db, makeBook({ buyer_email: null }));

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendFailed: sends failed email and stamps book", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendFailed(db, makeBook());

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(
    mockSentEmails[0].payload.transactionalId,
    LOOPS_TEMPLATES.bookFailed,
  );
  assertEquals(mockSentEmails[0].payload.email, "buyer@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    childName: "Mira",
    supportUrl: "mailto:support@thistlebook.com",
  });
  assertSingleBookStamp(db, "failed_email_sent_at");
});

Deno.test("maybeSendFailed: skips when already stamped", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendFailed(
    db,
    makeBook({ failed_email_sent_at: "2026-01-01T00:00:00.000Z" }),
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendFailed: skips when buyer_email is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();

  const result = await maybeSendFailed(db, makeBook({ buyer_email: null }));

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendReady: preview URL resolves from APP_BASE_URL with dashboard path", async () => {
  __resetLoopsMock();
  Deno.env.set("APP_BASE_URL", "https://thistlebook.com/");
  const db = makeFakeDb();

  const result = await maybeSendReady(db, makeBook());

  assertEquals(result, true);
  assertEquals(mockSentEmails[0].payload.dataVariables, {
    childName: "Mira",
    previewUrl: "https://thistlebook.com/dashboard",
    bookId: "book-1",
  });
});

Deno.test("maybeSend*: swallows send/stamp errors and resolves false", async () => {
  __resetLoopsMock();
  const throwingDb = {
    from() {
      return {
        update() {
          return {
            eq() {
              throw new Error("db unavailable");
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof maybeSendCreating>[0];

  // The email is sent (mock) but the stamp write throws — the helper must not
  // reject, so an email-layer failure can never break book generation.
  const result = await maybeSendCreating(throwingDb, makeBook());

  assertEquals(result, false);
});
