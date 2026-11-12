// One paid order = one book (THI-36).
//
// generate-book asks two questions about an order before it writes a story:
//   1. Can this order pay for a book? (refunded orders can't)
//   2. Does it already have a book, and in what state?
// These are pure so they can be unit-tested; the handler does the DB reads.

export type OrderPaymentState = "paid" | "refunded" | "check_stripe";

/**
 * Whether an order can pay for a book, from the `orders.status` column.
 * Refunds are checked here because Stripe keeps a refunded PaymentIntent's
 * status at "succeeded", so the Stripe fallback would let it through.
 */
export function orderPaymentState(order: { status?: string | null }): OrderPaymentState {
  if (order.status === "refunded") return "refunded";
  if (order.status === "paid") return "paid";
  return "check_stripe";
}

export interface ExistingBook {
  id: string;
  /** `generated_books.pipeline_status`. "failed" is the only failed state. */
  pipeline_status: string | null;
  /** True once the story text is saved (`generated_books.parsed` is set). */
  has_story: boolean;
  /**
   * When the current story attempt started (`pipeline_progress.started_at`,
   * falling back to `created_at`). Used to spot a story run whose worker died
   * without marking the book failed.
   */
  story_started_at: string | null;
}

/**
 * Writing the story normally takes a minute or two. A book still at "story"
 * after this long lost its worker (timeout, deploy, eviction) and will never
 * finish or be marked failed, so it's safe to restart.
 */
export const STALE_STORY_MS = 10 * 60 * 1000;

function isStaleStory(book: ExistingBook, now: number): boolean {
  if (book.pipeline_status !== "story" || book.has_story) return false;
  const started = book.story_started_at ? Date.parse(book.story_started_at) : NaN;
  // No usable timestamp: treat as stale rather than leave the buyer stuck.
  if (Number.isNaN(started)) return true;
  return now - started > STALE_STORY_MS;
}

export type BookDecision =
  /** No usable book: create one. `claimFrom` is the order's current book_id (null, or a stale id). */
  | { action: "create"; claimFrom: string | null }
  /** A book is in progress or done: return its id, start nothing. */
  | { action: "existing"; bookId: string }
  /**
   * The book failed (or its story run died): restart the same book, from the
   * story or from the images. `reason` tells the handler which state to claim.
   */
  | { action: "restart"; bookId: string; from: "story" | "images"; reason: "failed" | "stale_story" };

/**
 * What generate-book should do for an order, given `orders.book_id` and the
 * linked `generated_books` row (null if the order has no book or the row is gone).
 */
export function decideBookForOrder(
  orderBookId: string | null,
  book: ExistingBook | null,
  now: number = Date.now(),
): BookDecision {
  if (!orderBookId || !book) return { action: "create", claimFrom: orderBookId ?? null };
  if (book.pipeline_status === "failed") {
    return {
      action: "restart",
      bookId: book.id,
      from: book.has_story ? "images" : "story",
      reason: "failed",
    };
  }
  if (isStaleStory(book, now)) {
    return { action: "restart", bookId: book.id, from: "story", reason: "stale_story" };
  }
  return { action: "existing", bookId: book.id };
}

// Minimal slice of the Supabase client used by claimOrderBook, so tests can fake it.
interface ClaimFilter {
  eq(col: string, val: unknown): ClaimFilter;
  is(col: string, val: null): ClaimFilter;
  select(cols: string): PromiseLike<{ data: unknown[] | null; error: unknown }>;
}
export interface OrdersDb {
  from(table: string): { update(values: Record<string, unknown>): ClaimFilter };
}

/**
 * Link `bookId` to the order, but only if the order still has the book_id we
 * saw (`claimFrom`) and belongs to `userId`. Returns false if another call got
 * there first, so two generate-book calls at once can't both start a book.
 */
export async function claimOrderBook(
  db: OrdersDb,
  args: { orderId: string; userId: string; bookId: string; claimFrom: string | null },
): Promise<boolean> {
  const base = db
    .from("orders")
    .update({ book_id: args.bookId, updated_at: new Date().toISOString() })
    .eq("id", args.orderId)
    .eq("user_id", args.userId);
  const filtered = args.claimFrom === null
    ? base.is("book_id", null)
    : base.eq("book_id", args.claimFrom);
  const { data, error } = await filtered.select("id");
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}
