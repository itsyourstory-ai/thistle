// Server-side book start (THI-38).
//
// A buyer's browser used to be the only thing that started book generation, so
// a closed tab after paying meant a paid order with no book. Now:
//   1. At checkout, create-payment-intent saves the brief and the approved
//      character portrait on the order (`order_book_inputs`).
//   2. When Stripe says the payment succeeded, stripe-webhook calls
//      generate-book with just the order id (`startBookForOrder`).
//   3. generate-book, seeing the service-role key, loads everything it needs
//      from the order (`loadServerStartInputs`).
// These helpers are pure (database and invoke are passed in) so tests can fake them.

import { stripDataUrls } from "./sanitize.ts";

/** Largest seed portrait we will store (characters of the base64 data URL). */
export const MAX_SEED_PORTRAIT_CHARS = 12_000_000;

// ── Saving inputs at checkout ────────────────────────────────────────────────

export interface OrderBookInputs {
  brief: Record<string, unknown>;
  seed_portrait_data_url: string | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read the brief and seed portrait out of a create-payment-intent request.
 * Returns null when there is no usable brief (most calls don't send one).
 * Reference photos are stripped from the brief; the seed portrait is kept only
 * if it is an image data URL under the size cap.
 */
export function prepareOrderBookInputs(body: Record<string, unknown>): OrderBookInputs | null {
  if (!isPlainObject(body.brief)) return null;
  const seed = body.seed_portrait_data_url;
  const validSeed = typeof seed === "string" &&
    seed.startsWith("data:image/") &&
    seed.length <= MAX_SEED_PORTRAIT_CHARS;
  return {
    brief: stripDataUrls(body.brief),
    seed_portrait_data_url: validSeed ? seed : null,
  };
}

// Minimal slice of the Supabase client used by saveOrderBookInputs.
export interface InputsWriteDb {
  from(table: string): {
    upsert(
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ): PromiseLike<{ error: unknown }>;
  };
}

/** Save (or replace) the order's brief and seed portrait. Throws on a database error. */
export async function saveOrderBookInputs(
  db: InputsWriteDb,
  orderId: string,
  inputs: OrderBookInputs,
): Promise<void> {
  const { error } = await db.from("order_book_inputs").upsert(
    {
      order_id: orderId,
      brief: inputs.brief,
      seed_portrait_data_url: inputs.seed_portrait_data_url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "order_id" },
  );
  if (error) throw error;
}

/**
 * Save the brief and portrait if the request sent them. create-payment-intent
 * calls this on every path that returns a response, and reports the result as
 * `book_inputs_saved` so the app can retry before the buyer pays.
 *   true  = saved
 *   false = the save failed (logged, not thrown: payment must not break)
 *   null  = the request had nothing to save
 */
export async function saveBookInputsIfSent(
  db: InputsWriteDb,
  orderId: string,
  body: Record<string, unknown>,
): Promise<boolean | null> {
  const inputs = prepareOrderBookInputs(body);
  if (!inputs) return null;
  // The portrait anchors the hero's look in the book. Without it the server
  // start still works, but the book may not match the portrait the buyer approved.
  if (body.seed_portrait_data_url && !inputs.seed_portrait_data_url) {
    console.warn(
      `create-payment-intent: seed portrait dropped for order ${orderId} (not an image data URL, or over the size limit)`,
    );
  }
  try {
    await saveOrderBookInputs(db, orderId, inputs);
    return true;
  } catch (err) {
    console.error("create-payment-intent: saving order book inputs failed:", err);
    return false;
  }
}

// Minimal slice of the Supabase client used by clearSeedPortraitForBook.
export interface ClearSeedDb {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): PromiseLike<{ data: { id: string }[] | null; error: unknown }>;
    };
    update(values: Record<string, unknown>): {
      in(col: string, vals: string[]): PromiseLike<{ error: unknown }>;
    };
  };
}

/**
 * Once a book is done, drop the saved portrait: it is a multi-MB likeness of a
 * child and nothing needs it again. The brief stays (it has no photos), so a
 * late repeat of the payment webhook still finds saved details. Throws on a
 * database error; the caller decides whether that matters.
 */
export async function clearSeedPortraitForBook(db: ClearSeedDb, bookId: string): Promise<void> {
  const { data: orders, error: ordersErr } = await db
    .from("orders")
    .select("id")
    .eq("book_id", bookId);
  if (ordersErr) throw ordersErr;
  if (!orders?.length) return;

  const { error } = await db
    .from("order_book_inputs")
    .update({ seed_portrait_data_url: null })
    .in("order_id", orders.map((o) => o.id));
  if (error) throw error;
}

// ── generate-book's service-role entry ───────────────────────────────────────

// Minimal slice of the Supabase client used by loadServerStartInputs.
interface ReadFilter {
  eq(col: string, val: unknown): ReadFilter;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
}
export interface InputsReadDb {
  from(table: string): { select(cols: string): ReadFilter };
}

export type ServerStartInputs =
  | {
    ok: true;
    orderId: string;
    /** The order's owner. The book is created for this user. */
    userId: string;
    draftId: string | null;
    buyerName: string | null;
    buyerEmail: string | null;
    brief: Record<string, unknown>;
    seedPortraitDataUrl: string | null;
  }
  | { ok: false; status: 400 | 404 | 422 | 500; error: string };

/**
 * Everything generate-book needs to start a book from just an order id.
 * Whether the order is paid is NOT decided here; generate-book's paid-order
 * gate still runs afterwards, exactly as for a browser call.
 */
export async function loadServerStartInputs(
  db: InputsReadDb,
  orderId: unknown,
): Promise<ServerStartInputs> {
  if (typeof orderId !== "string" || !orderId) {
    return { ok: false, status: 400, error: "order_id is required." };
  }

  const { data: order, error: orderErr } = await db
    .from("orders")
    .select("id, user_id, draft_id, buyer_name, buyer_email")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) return { ok: false, status: 500, error: "Order lookup failed." };
  if (!order) return { ok: false, status: 404, error: "Order not found." };

  const { data: inputs, error: inputsErr } = await db
    .from("order_book_inputs")
    .select("brief, seed_portrait_data_url")
    .eq("order_id", orderId)
    .maybeSingle();
  if (inputsErr) return { ok: false, status: 500, error: "Saved book details lookup failed." };
  if (!inputs || !isPlainObject(inputs.brief)) {
    return { ok: false, status: 422, error: "No saved book details for this order." };
  }

  return {
    ok: true,
    orderId,
    userId: order.user_id as string,
    draftId: (order.draft_id as string | null) ?? null,
    buyerName: (order.buyer_name as string | null) ?? null,
    buyerEmail: (order.buyer_email as string | null) ?? null,
    brief: inputs.brief,
    seedPortraitDataUrl: (inputs.seed_portrait_data_url as string | null) ?? null,
  };
}

/**
 * Inputs for a buyer's retry of their own failed book (THI-10).
 *
 * After a reload the browser has no wizard answers, so it sends just the book
 * id. We find the order that paid for that book, but only if it belongs to
 * `userId` (the signed-in caller): edge functions write with service_role, which
 * skips RLS, so this filter is what stops a request from touching another
 * buyer's book. Someone else's book looks exactly like a missing one (404).
 * The rest comes from the order's saved inputs, as for a server start.
 */
export async function loadRetryInputs(
  db: InputsReadDb,
  userId: string,
  bookId: unknown,
): Promise<ServerStartInputs> {
  if (typeof bookId !== "string" || !bookId) {
    return { ok: false, status: 400, error: "retry_book_id is required." };
  }

  const { data: order, error: orderErr } = await db
    .from("orders")
    .select("id")
    .eq("book_id", bookId)
    .eq("user_id", userId)
    .maybeSingle();
  // Postgres 22P02: the id isn't a UUID, so no book can have it.
  if ((orderErr as { code?: string } | null)?.code === "22P02") {
    return { ok: false, status: 404, error: "Book not found." };
  }
  if (orderErr) return { ok: false, status: 500, error: "Order lookup failed." };
  if (!order) return { ok: false, status: 404, error: "Book not found." };

  const loaded = await loadServerStartInputs(db, order.id);
  // Belt and braces: never hand back inputs that belong to someone else.
  if (loaded.ok && loaded.userId !== userId) {
    return { ok: false, status: 404, error: "Book not found." };
  }
  // The buyer sees this message. Older orders have no saved details (THI-38),
  // and "details for this order" means nothing to them.
  if (!loaded.ok && loaded.status === 422) {
    return {
      ok: false,
      status: 422,
      error: "We can't restart this book automatically. Please email support@thistlebook.com and we'll sort it out.",
    };
  }
  return loaded;
}

// ── stripe-webhook's side ────────────────────────────────────────────────────

export type StartOutcome =
  /** generate-book started a new book. */
  | "started"
  /** The order already had a book (the browser got there first, or a repeat). */
  | "already_started"
  /** generate-book refused for a reason a retry can't fix (no saved details, refunded). */
  | "skipped"
  /** A temporary failure: let Stripe deliver the event again. */
  | "retry";

export interface StartResult {
  outcome: StartOutcome;
  /** HTTP status generate-book answered with, when it refused or failed. */
  status?: number;
  /** generate-book's own error message, when it sent one. */
  detail?: string;
}

type Invoke = (
  name: string,
  body: Record<string, unknown>,
) => PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;

/** Ask generate-book to start the book for a paid order, and say what happened. */
export async function startBookForOrder(invoke: Invoke, orderId: string): Promise<StartResult> {
  try {
    const { data, error } = await invoke("generate-book", { order_id: orderId });
    if (!error) return { outcome: data?.existing ? "already_started" : "started" };
    const context = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
    const status = context?.status;
    // A 4xx means this order can't start a book, and asking again won't change
    // that. 408 and 429 are "try later". Anything else (5xx, no status) retries.
    if (typeof status === "number" && status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return { outcome: "skipped", status, detail: await readErrorDetail(context) };
    }
    return { outcome: "retry", status };
  } catch {
    return { outcome: "retry" };
  }
}

/** generate-book's `{ error }` message from a failed invoke, if it can be read. */
async function readErrorDetail(
  context: { json?: () => Promise<unknown> } | undefined,
): Promise<string | undefined> {
  try {
    const body = await context?.json?.();
    const message = (body as { error?: unknown } | null)?.error;
    return typeof message === "string" ? message : undefined;
  } catch {
    return undefined;
  }
}
