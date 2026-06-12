// Shared Google service-account auth for Drive and Docs edge functions.
//
// Usage:
//   import { googleApiFetch } from "../_shared/googleAuth.ts";
//   const data = await googleApiFetch("https://www.googleapis.com/drive/v3/...", { method: "GET" });
//
// Expects env var GOOGLE_SERVICE_ACCOUNT_JSON to contain the full service-account
// JSON credential. Never logs or surfaces the credential value.

export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "[unparseable url]";
  }
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlStr(str: string): string {
  return b64url(new TextEncoder().encode(str).buffer);
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
  }
  // Supabase secrets store escaped newlines — normalise them.
  const privateKey = (sa.private_key as string).replace(/\\n/g, "\n");
  return { client_email: sa.client_email, private_key: privateKey };
}

async function mintAccessToken(): Promise<{ token: string; expiresAt: number }> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlStr(JSON.stringify({
    iss: sa.client_email,
    scope: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents",
    ].join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    // Never surface the JWT in the error — just the status.
    throw new Error(`Token mint failed: ${resp.status}`);
  }
  const json = JSON.parse(text);
  const expiresIn: number = json.expires_in ?? 3600;
  return {
    token: json.access_token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  };
}

// Module-level token cache.
let cachedToken: string | null = null;
let cachedExpiresAt = 0;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedExpiresAt) return cachedToken;
  const { token, expiresAt } = await mintAccessToken();
  cachedToken = token;
  cachedExpiresAt = expiresAt;
  return token;
}

// For tests only — resets the in-memory cache so next call re-mints.
export function __resetTokenCacheForTests(): void {
  cachedToken = null;
  cachedExpiresAt = 0;
}

export async function googleApiFetch(url: string, init: RequestInit = {}): Promise<any> {
  const doFetch = async (token: string): Promise<Response> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    };
    return fetch(url, { ...init, headers });
  };

  let token = await getAccessToken();
  let resp = await doFetch(token);

  // On 401 the token may have been revoked — clear cache and retry once.
  if (resp.status === 401) {
    __resetTokenCacheForTests();
    token = await getAccessToken();
    resp = await doFetch(token);
  }

  const text = await resp.text();
  if (!resp.ok) {
    const method = init.method || "GET";
    console.error(`googleApiFetch ${method} ${redactUrl(url)} → ${resp.status}: ${text.slice(0, 400)}`);
    throw new Error(`${method} ${redactUrl(url)} → ${resp.status}`);
  }
  return text ? JSON.parse(text) : {};
}
