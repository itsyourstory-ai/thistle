/**
 * Minimal IndexedDB-backed cache for Supabase edge function responses.
 *
 * Used when cacheMode is "record" or "replay" in the dev test panel:
 *
 *   record  — calls Supabase live, stores the response, returns it.
 *             Run this once to snapshot a real response.
 *
 *   replay  — on a cache hit, returns the stored response immediately
 *             (no Supabase call, no tokens). On a miss, falls back to
 *             live and stores the result (same as record for that call).
 *
 * Keys are "{fnName}:{SHA-ish hash of body}" so different briefs don't
 * collide. Uses IndexedDB (not localStorage) because image data-URLs
 * are large and would overflow localStorage quotas.
 *
 * AIDEV-NOTE: Only used in DEV. Never imported in production code paths.
 */

const DB_NAME = "thistle_edge_cache";
const STORE_NAME = "responses";
const DB_VERSION = 1;

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Key derivation ────────────────────────────────────────────────────────────
// Simple deterministic hash — good enough for dev caching; not cryptographic.

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

function cacheKey(fnName: string, body: Record<string, unknown>): string {
  // Exclude large photo data-URLs from the hash to keep keys short and stable
  // even when the photo changes. We key on the brief structure, not pixel data.
  const stripped = JSON.stringify(body, (k, v) => {
    if (typeof v === "string" && v.startsWith("data:image/") && v.length > 200) {
      return `[photo:${v.length}]`;
    }
    return v;
  });
  return `${fnName}:${simpleHash(stripped)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt to read a cached response. Returns null on miss.
 */
export async function cacheGet(
  fnName: string,
  body: Record<string, unknown>,
): Promise<{ data: unknown; error: null } | null> {
  try {
    const db = await openDb();
    const hit = await idbGet(db, cacheKey(fnName, body));
    if (hit == null) return null;
    return hit as { data: unknown; error: null };
  } catch {
    return null; // silently degrade
  }
}

/**
 * Store a response in the cache.
 */
export async function cachePut(
  fnName: string,
  body: Record<string, unknown>,
  response: { data: unknown; error: unknown },
): Promise<void> {
  if (response.error) return; // never cache errors
  try {
    const db = await openDb();
    await idbPut(db, cacheKey(fnName, body), { data: response.data, error: null });
  } catch {
    // silently degrade
  }
}

/**
 * Delete all cached entries (useful to force a fresh record pass).
 */
export async function cacheClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // silently degrade
  }
}
