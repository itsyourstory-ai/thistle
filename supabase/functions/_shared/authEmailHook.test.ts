import { assertEquals } from "jsr:@std/assert";
import { Webhook } from "npm:standardwebhooks@1";
import { mockSentEmails, __resetLoopsMock, LOOPS_TEMPLATES } from "./loops.ts";
import { handleAuthEmailHook } from "./authEmailHook.ts";

const TEST_SECRET = "whsec_dGVzdHNlY3JldHZhbHVlZm9ydGVzdGluZw==";

function makeRequest(
  emailActionType: string,
  extra: Record<string, unknown> = {},
  badSig = false,
): Request {
  const wh = new Webhook(TEST_SECRET);
  const body = JSON.stringify({
    user: { email: "u@example.com" },
    email_data: {
      email_action_type: emailActionType,
      token_hash: "tok123",
      redirect_to: "https://app.test/",
      ...extra,
    },
  });
  const msgId = "msg_test_123";
  const ts = new Date();
  const sig = badSig ? "v1,bad" : wh.sign(msgId, ts, body);

  return new Request("https://x.invalid/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": msgId,
      "webhook-timestamp": String(Math.floor(ts.getTime() / 1000)),
      "webhook-signature": sig,
    },
    body,
  });
}

// ── signup ────────────────────────────────────────────────────────────────────

Deno.test("signup → sends confirmEmail", async () => {
  __resetLoopsMock();
  const prevSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const prevUrl = Deno.env.get("SUPABASE_URL");
  try {
    Deno.env.set("SEND_EMAIL_HOOK_SECRET", "v1," + TEST_SECRET);
    Deno.env.set("SUPABASE_URL", "https://supabase.test");

    const req = makeRequest("signup");
    const res = await handleAuthEmailHook(req);

    assertEquals(res.status, 200);
    assertEquals(mockSentEmails.length, 1);
    assertEquals(mockSentEmails[0].payload.transactionalId, LOOPS_TEMPLATES.confirmEmail);
    const vars = mockSentEmails[0].payload.dataVariables as Record<string, string>;
    assertEquals(typeof vars.confirmationUrl, "string");
    assertEquals(vars.confirmationUrl.includes("tok123"), true);
    assertEquals(vars.confirmationUrl.includes("signup"), true);
    assertEquals(vars.confirmationUrl.includes("redirect_to"), true);
  } finally {
    if (prevSecret !== undefined) Deno.env.set("SEND_EMAIL_HOOK_SECRET", prevSecret);
    else Deno.env.delete("SEND_EMAIL_HOOK_SECRET");
    if (prevUrl !== undefined) Deno.env.set("SUPABASE_URL", prevUrl);
    else Deno.env.delete("SUPABASE_URL");
  }
});

// ── recovery ──────────────────────────────────────────────────────────────────

Deno.test("recovery → sends passwordReset", async () => {
  __resetLoopsMock();
  const prevSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const prevUrl = Deno.env.get("SUPABASE_URL");
  try {
    Deno.env.set("SEND_EMAIL_HOOK_SECRET", "v1," + TEST_SECRET);
    Deno.env.set("SUPABASE_URL", "https://supabase.test");

    const req = makeRequest("recovery");
    const res = await handleAuthEmailHook(req);

    assertEquals(res.status, 200);
    assertEquals(mockSentEmails.length, 1);
    assertEquals(mockSentEmails[0].payload.transactionalId, LOOPS_TEMPLATES.passwordReset);
    const vars = mockSentEmails[0].payload.dataVariables as Record<string, string>;
    assertEquals(typeof vars.resetUrl, "string");
    assertEquals(vars.resetUrl.includes("tok123"), true);
  } finally {
    if (prevSecret !== undefined) Deno.env.set("SEND_EMAIL_HOOK_SECRET", prevSecret);
    else Deno.env.delete("SEND_EMAIL_HOOK_SECRET");
    if (prevUrl !== undefined) Deno.env.set("SUPABASE_URL", prevUrl);
    else Deno.env.delete("SUPABASE_URL");
  }
});

// ── invalid signature ─────────────────────────────────────────────────────────

Deno.test("invalid signature → 401, no send", async () => {
  __resetLoopsMock();
  const prevSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const prevUrl = Deno.env.get("SUPABASE_URL");
  try {
    Deno.env.set("SEND_EMAIL_HOOK_SECRET", "v1," + TEST_SECRET);
    Deno.env.set("SUPABASE_URL", "https://supabase.test");

    const req = makeRequest("signup", {}, true);
    const res = await handleAuthEmailHook(req);

    assertEquals(res.status, 401);
    assertEquals(mockSentEmails.length, 0);
  } finally {
    if (prevSecret !== undefined) Deno.env.set("SEND_EMAIL_HOOK_SECRET", prevSecret);
    else Deno.env.delete("SEND_EMAIL_HOOK_SECRET");
    if (prevUrl !== undefined) Deno.env.set("SUPABASE_URL", prevUrl);
    else Deno.env.delete("SUPABASE_URL");
  }
});

// ── unmapped action type ──────────────────────────────────────────────────────

Deno.test("unmapped action type → 200, no send", async () => {
  __resetLoopsMock();
  const prevSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const prevUrl = Deno.env.get("SUPABASE_URL");
  try {
    Deno.env.set("SEND_EMAIL_HOOK_SECRET", "v1," + TEST_SECRET);
    Deno.env.set("SUPABASE_URL", "https://supabase.test");

    const req = makeRequest("email_change");
    const res = await handleAuthEmailHook(req);

    assertEquals(res.status, 200);
    assertEquals(mockSentEmails.length, 0);
  } finally {
    if (prevSecret !== undefined) Deno.env.set("SEND_EMAIL_HOOK_SECRET", prevSecret);
    else Deno.env.delete("SEND_EMAIL_HOOK_SECRET");
    if (prevUrl !== undefined) Deno.env.set("SUPABASE_URL", prevUrl);
    else Deno.env.delete("SUPABASE_URL");
  }
});

// ── non-POST ──────────────────────────────────────────────────────────────────

Deno.test("non-POST → 400", async () => {
  const req = new Request("https://x.invalid/", { method: "GET" });
  const res = await handleAuthEmailHook(req);
  assertEquals(res.status, 400);
});
