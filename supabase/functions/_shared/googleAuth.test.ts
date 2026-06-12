import { assertEquals, assertRejects, assertMatch } from "jsr:@std/assert";
import {
  getAccessToken,
  googleApiFetch,
  __resetTokenCacheForTests,
  redactUrl,
} from "./googleAuth.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Generate a real RSA-2048 key pair so signing actually runs end-to-end.
async function generateTestKeyPair(): Promise<{ privateKeyPem: string; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
  return { privateKeyPem: pem, publicKey: pair.publicKey };
}

function makeServiceAccountJson(privateKeyPem: string, email = "test@test-project.iam.gserviceaccount.com"): string {
  return JSON.stringify({ client_email: email, private_key: privateKeyPem });
}

function setEnv(json: string) {
  (Deno.env as any).set("GOOGLE_SERVICE_ACCOUNT_JSON", json);
}

function clearEnv() {
  (Deno.env as any).delete("GOOGLE_SERVICE_ACCOUNT_JSON");
}

function mockTokenFetch(token = "test-access-token", expiresIn = 3600): () => void {
  const original = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async (input: any, _init?: any) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "https://oauth2.googleapis.com/token") {
      called += 1;
      return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), { status: 200 });
    }
    return original(input, _init);
  };
  (mockTokenFetch as any)._getCallCount = () => called;
  return () => { globalThis.fetch = original; };
}

// ---------------------------------------------------------------------------
// redactUrl
// ---------------------------------------------------------------------------

Deno.test("redactUrl strips query string", () => {
  assertEquals(
    redactUrl("https://oauth2.googleapis.com/token?foo=bar&baz=secret"),
    "https://oauth2.googleapis.com/token",
  );
});

Deno.test("redactUrl returns fallback for unparseable url", () => {
  assertEquals(redactUrl("not a url"), "[unparseable url]");
});

// ---------------------------------------------------------------------------
// Private-key normalisation
// ---------------------------------------------------------------------------

Deno.test("loadServiceAccount: normalises escaped \\n in private_key", async () => {
  const { privateKeyPem } = await generateTestKeyPair();
  // Simulate how Supabase secrets escape newlines.
  const escaped = privateKeyPem.replace(/\n/g, "\\n");
  const json = JSON.stringify({ client_email: "a@b.com", private_key: escaped });
  setEnv(json);
  __resetTokenCacheForTests();

  const restore = mockTokenFetch();
  try {
    // If normalisation works the key import won't throw.
    const token = await getAccessToken();
    assertEquals(token, "test-access-token");
  } finally {
    restore();
    clearEnv();
    __resetTokenCacheForTests();
  }
});

// ---------------------------------------------------------------------------
// JWT claims
// ---------------------------------------------------------------------------

Deno.test("getAccessToken: JWT has correct iss, scope, aud claims", async () => {
  const { privateKeyPem } = await generateTestKeyPair();
  setEnv(makeServiceAccountJson(privateKeyPem));
  __resetTokenCacheForTests();

  let capturedAssertion: string | null = null;
  const original = globalThis.fetch;
  globalThis.fetch = async (_input: any, init?: any) => {
    const body = new URLSearchParams(init?.body);
    capturedAssertion = body.get("assertion");
    return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
  };

  try {
    await getAccessToken();
    // Decode the JWT payload (second segment).
    const parts = capturedAssertion!.split(".");
    assertEquals(parts.length, 3);
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    assertEquals(payload.iss, "test@test-project.iam.gserviceaccount.com");
    assertMatch(payload.scope, /https:\/\/www\.googleapis\.com\/auth\/drive/);
    assertMatch(payload.scope, /https:\/\/www\.googleapis\.com\/auth\/documents/);
    assertEquals(payload.aud, "https://oauth2.googleapis.com/token");
    const now = Math.floor(Date.now() / 1000);
    assertEquals(payload.exp - payload.iat, 3600);
    assertEquals(payload.iat <= now + 2, true);
  } finally {
    globalThis.fetch = original;
    clearEnv();
    __resetTokenCacheForTests();
  }
});

// ---------------------------------------------------------------------------
// Token caching
// ---------------------------------------------------------------------------

Deno.test("getAccessToken: caches token within TTL — only one fetch call", async () => {
  const { privateKeyPem } = await generateTestKeyPair();
  setEnv(makeServiceAccountJson(privateKeyPem));
  __resetTokenCacheForTests();

  let fetchCallCount = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCallCount += 1;
    return new Response(JSON.stringify({ access_token: "cached-tok", expires_in: 3600 }), { status: 200 });
  };

  try {
    const t1 = await getAccessToken();
    const t2 = await getAccessToken();
    assertEquals(t1, "cached-tok");
    assertEquals(t2, "cached-tok");
    assertEquals(fetchCallCount, 1, "should only mint once within TTL");
  } finally {
    globalThis.fetch = original;
    clearEnv();
    __resetTokenCacheForTests();
  }
});

Deno.test("getAccessToken: re-mints after __resetTokenCacheForTests", async () => {
  const { privateKeyPem } = await generateTestKeyPair();
  setEnv(makeServiceAccountJson(privateKeyPem));
  __resetTokenCacheForTests();

  let fetchCallCount = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCallCount += 1;
    return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
  };

  try {
    await getAccessToken();
    __resetTokenCacheForTests();
    await getAccessToken();
    assertEquals(fetchCallCount, 2, "should re-mint after cache reset");
  } finally {
    globalThis.fetch = original;
    clearEnv();
    __resetTokenCacheForTests();
  }
});

// ---------------------------------------------------------------------------
// googleApiFetch — 401 retry
// ---------------------------------------------------------------------------

Deno.test("googleApiFetch: retries once on 401 with a fresh token", async () => {
  const { privateKeyPem } = await generateTestKeyPair();
  setEnv(makeServiceAccountJson(privateKeyPem));
  __resetTokenCacheForTests();

  let tokenMintCount = 0;
  let apiCallCount = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      tokenMintCount += 1;
      return new Response(JSON.stringify({ access_token: `tok-${tokenMintCount}`, expires_in: 3600 }), { status: 200 });
    }
    // First API call → 401; second → 200.
    apiCallCount += 1;
    if (apiCallCount === 1) {
      return new Response("Unauthorized", { status: 401 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const result = await googleApiFetch("https://www.googleapis.com/drive/v3/files");
    assertEquals(result.ok, true);
    assertEquals(tokenMintCount, 2, "should mint a second token after 401");
    assertEquals(apiCallCount, 2, "should retry the API call once");
  } finally {
    globalThis.fetch = original;
    clearEnv();
    __resetTokenCacheForTests();
  }
});

Deno.test("googleApiFetch: throws on non-401 error", async () => {
  const { privateKeyPem } = await generateTestKeyPair();
  setEnv(makeServiceAccountJson(privateKeyPem));
  __resetTokenCacheForTests();

  const original = globalThis.fetch;
  globalThis.fetch = async (input: any, _init?: any) => {
    const url = typeof input === "string" ? input : String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    }
    return new Response("Server Error", { status: 500 });
  };

  try {
    await assertRejects(
      () => googleApiFetch("https://www.googleapis.com/drive/v3/files"),
      Error,
      "500",
    );
  } finally {
    globalThis.fetch = original;
    clearEnv();
    __resetTokenCacheForTests();
  }
});

Deno.test("getAccessToken: throws when env var is missing", async () => {
  clearEnv();
  __resetTokenCacheForTests();
  await assertRejects(
    () => getAccessToken(),
    Error,
    "GOOGLE_SERVICE_ACCOUNT_JSON is not configured",
  );
});
