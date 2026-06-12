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
