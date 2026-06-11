import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { isServiceRoleRequest, requireAuthedUser, unauthorized } from "./auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── isServiceRoleRequest ─────────────────────────────────────────────────────

Deno.test("isServiceRoleRequest: true for matching service-role key", () => {
  const key = "super-secret-service-role-key";
  const req = new Request("http://localhost", {
    headers: { Authorization: `Bearer ${key}` },
  });
  assertEquals(isServiceRoleRequest(req, key), true);
});

Deno.test("isServiceRoleRequest: false for anon JWT", () => {
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon" },
  });
  assertEquals(isServiceRoleRequest(req, "super-secret-service-role-key"), false);
});

Deno.test("isServiceRoleRequest: false for missing Authorization header", () => {
  const req = new Request("http://localhost");
  assertEquals(isServiceRoleRequest(req, "super-secret-service-role-key"), false);
});

Deno.test("isServiceRoleRequest: false when service-role key is empty string", () => {
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer " },
  });
  assertEquals(isServiceRoleRequest(req, ""), false);
});

Deno.test("isServiceRoleRequest: false when injected key is undefined/missing", () => {
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer some-key" },
  });
  // Pass empty string to simulate missing env var
  assertEquals(isServiceRoleRequest(req, ""), false);
});

// ── requireAuthedUser ────────────────────────────────────────────────────────

Deno.test("requireAuthedUser: returns user when getUser resolves one", async () => {
  const fakeUser = { id: "abc-123", email: "test@example.com" } as any;
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer valid-user-token" },
  });
  const user = await requireAuthedUser(req, async () => ({
    data: { user: fakeUser },
  }));
  assertEquals(user, fakeUser);
});

Deno.test("requireAuthedUser: returns null when getUser yields no user", async () => {
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer anon-key" },
  });
  const user = await requireAuthedUser(req, async () => ({
    data: { user: null },
  }));
  assertEquals(user, null);
});

Deno.test("requireAuthedUser: returns null for missing Authorization header", async () => {
  const req = new Request("http://localhost");
  const user = await requireAuthedUser(req, async () => ({
    data: { user: null },
  }));
  assertEquals(user, null);
});

// ── unauthorized ─────────────────────────────────────────────────────────────

Deno.test("unauthorized: 401 with correct JSON body", async () => {
  const res = unauthorized(corsHeaders, 401, "Authentication required.");
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body.error, "Authentication required.");
});

Deno.test("unauthorized: 403 with correct JSON body", async () => {
  const res = unauthorized(corsHeaders, 403, "Forbidden.");
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error, "Forbidden.");
});

Deno.test("unauthorized: includes CORS headers", () => {
  const res = unauthorized(corsHeaders, 401, "Authentication required.");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(res.headers.get("Content-Type"), "application/json");
});
