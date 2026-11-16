// Shared sanitizers for user-supplied free text before it is concatenated
// into an AI prompt or stored.

// Caps length and strips control chars / null bytes from free-text user input
// before it is concatenated into an AI prompt. Keep it conservative — do not
// mangle legitimate names or story notes.
export function sanitizeUserText(input: unknown, maxLen = 2000): string {
  if (typeof input !== "string") return "";
  // Strip C0 control chars (incl. null bytes) and DEL. Tabs/newlines are
  // control chars too; story notes rarely need them and dropping them keeps
  // prompt structure intact.
  // deno-lint-ignore no-control-regex
  return input
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function isValidEmail(s: unknown): boolean {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Recursively strip base64 `data:` URLs and known photo fields from a brief.
// The text engine never reads these, and dragging multi-MB strings through
// JSON.parse + multiple in-memory copies blows the edge-runtime memory ceiling
// (HTTP 546 "WORKER_LIMIT"). Also keeps reference photos of children out of
// the database copy of the brief.
// deno-lint-ignore no-explicit-any
export function stripDataUrls<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    // deno-lint-ignore no-explicit-any
    return (value.startsWith("data:") ? null : value) as any;
  }
  // deno-lint-ignore no-explicit-any
  if (Array.isArray(value)) return value.map(stripDataUrls) as any;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "photo" || k === "photos" || k === "photoDataUrl") {
        out[k] = null;
        continue;
      }
      out[k] = stripDataUrls(v);
    }
    // deno-lint-ignore no-explicit-any
    return out as any;
  }
  return value;
}
