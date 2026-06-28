import { assertEquals } from "jsr:@std/assert";
import { mockSentEmails, __resetLoopsMock, LOOPS_TEMPLATES } from "./loops.ts";
import { maybeSendWelcome, sendAccountDeletionEmail } from "./accountEmails.ts";

function makeFakeDb() {
  const calls: Array<{ table: string; values: Record<string, unknown>; eq: [string, unknown] }> = [];
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

Deno.test("maybeSendWelcome: sends email and records update when welcomed_at is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();
  const result = await maybeSendWelcome(db, { id: "user-1", email: "u@example.com" }, { welcomed_at: null });

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(mockSentEmails[0].payload.transactionalId, LOOPS_TEMPLATES.welcome);
  assertEquals(mockSentEmails[0].payload.email, "u@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {});
  assertEquals(db.calls.length, 1);
  assertEquals(db.calls[0].table, "profiles");
  assertEquals(db.calls[0].eq[0], "id");
  assertEquals(db.calls[0].eq[1], "user-1");
  assertEquals(typeof db.calls[0].values.welcomed_at, "string");
});

Deno.test("maybeSendWelcome: skips when welcomed_at is already set", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();
  const result = await maybeSendWelcome(
    db,
    { id: "user-1", email: "u@example.com" },
    { welcomed_at: "2026-01-01T00:00:00.000Z" },
  );

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
  assertEquals(db.calls.length, 0);
});

Deno.test("maybeSendWelcome: skips when profile is null", async () => {
  __resetLoopsMock();
  const db = makeFakeDb();
  const result = await maybeSendWelcome(db, { id: "user-1", email: "u@example.com" }, null);

  assertEquals(result, false);
  assertEquals(mockSentEmails.length, 0);
});

Deno.test("sendAccountDeletionEmail: sends correct template and email", async () => {
  __resetLoopsMock();
  const result = await sendAccountDeletionEmail("leaving@example.com");

  assertEquals(result, true);
  assertEquals(mockSentEmails.length, 1);
  assertEquals(mockSentEmails[0].payload.transactionalId, LOOPS_TEMPLATES.accountDeletion);
  assertEquals(mockSentEmails[0].payload.email, "leaving@example.com");
  assertEquals(mockSentEmails[0].payload.dataVariables, {});
});
