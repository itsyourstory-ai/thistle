// Retrying a book that failed or got stuck (THI-10).
//
// The buyer's paid order already holds everything needed to make the book, so a
// retry only has to say which book. The server restarts the same book (the
// story, or just the pictures if the story was already written) and the
// paid-order check still applies.

import { callEdge } from "@/lib/edgeFunctions";

// AIDEV-NOTE: Mirror of STALE_STORY_MS in supabase/functions/_shared/orderBook.ts.
// A book at "story" for longer than this has lost its worker; the server will
// restart it, so the page offers "Try again" instead of a spinner. Keep in sync.
export const STALE_STORY_MS = 10 * 60 * 1000;

/**
 * True when a book has been writing its story for longer than a story run can
 * take. Without a usable start time we can't tell, so we say no (the server
 * judges that case itself when asked).
 */
export function isStuckAtStory(
  status: string | null | undefined,
  progress: { started_at?: string } | null | undefined,
  now: number = Date.now(),
): boolean {
  if (status !== "story") return false;
  const started = progress?.started_at ? Date.parse(progress.started_at) : NaN;
  if (Number.isNaN(started)) return false;
  return now - started > STALE_STORY_MS;
}

/**
 * `restarted: false` means the server found the book already running and started
 * nothing (for example, the buyer's clock runs ahead of the server's).
 */
export type RetryResult = { ok: true; restarted: boolean } | { ok: false; message: string };

const FALLBACK_MESSAGE = "We couldn't restart your book. Please try again in a minute.";

/** generate-book's own `{ error }` message from a failed call, if it can be read. */
async function readServerMessage(error: unknown): Promise<string | null> {
  try {
    const body = await (error as { context?: { json?: () => Promise<unknown> } })?.context?.json?.();
    const message = (body as { error?: unknown } | null)?.error;
    return typeof message === "string" && message ? message : null;
  } catch {
    return null;
  }
}

/** Ask the server to restart the buyer's own book. */
export async function retryBook(bookId: string): Promise<RetryResult> {
  try {
    const { data, error } = await callEdge("generate-book", { retry_book_id: bookId });
    if (error) return { ok: false, message: (await readServerMessage(error)) ?? FALLBACK_MESSAGE };
    if (data?.error) return { ok: false, message: String(data.error) };
    return { ok: true, restarted: data?.existing !== true };
  } catch {
    return { ok: false, message: FALLBACK_MESSAGE };
  }
}
