// Owner-only lookup of one book page image (THI-20).
//
// `book_images` is service-role only and holds each image as a base64 data
// URL, so the browser can't read it. The `get-book-image` function calls this
// instead: it proves the caller owns the book, then returns a single image.
//
// AIDEV-NOTE: The edge function reads with service_role, which skips RLS, so
// the `user_id` filter on `generated_books` below is the only thing stopping
// one customer from reading another's book. "Not yours" and "doesn't exist"
// return the same result on purpose, so the answer never reveals whether
// someone else's book exists.
//
// AIDEV-NOTE: Pages only, no cover. The approved cover is a data URL, and
// generate-book blanks every data URL out of the brief before saving it
// (stripDataUrls), so the cover is not stored anywhere. Persisting it is a
// separate change.

export type BookImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason: "not_found" };

// Minimal slice of the Supabase client used here, so tests can fake it.
interface ReadFilter {
  eq(col: string, val: unknown): ReadFilter;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
}
export interface BookImageDb {
  from(table: string): { select(cols: string): ReadFilter };
}

const NOT_FOUND: BookImageResult = { ok: false, reason: "not_found" };

/**
 * Returns one page image of a book, but only if the book belongs to `userId`.
 * `slot` is the page number. Throws on a database error (the handler turns
 * that into a 500).
 */
export async function getOwnedBookImage(
  db: BookImageDb,
  args: { userId: string; bookId: string; slot: number },
): Promise<BookImageResult> {
  const { userId, bookId, slot } = args;

  // 1. Ownership: the book must exist AND be this user's.
  const { data: book, error: bookError } = await db
    .from("generated_books")
    .select("id")
    .eq("id", bookId)
    .eq("user_id", userId)
    .maybeSingle();
  if (bookError) throw bookError;
  if (!book) return NOT_FOUND;

  // 2. The page image, if it was generated successfully.
  const { data: image, error: imageError } = await db
    .from("book_images")
    .select("image_data_url")
    .eq("book_id", bookId)
    .eq("kind", "page")
    .eq("slot", slot)
    .eq("status", "ok")
    .maybeSingle();
  if (imageError) throw imageError;

  // Only ever hand the browser an image. Guards against a stray URL or script
  // in a column that is supposed to hold a base64 image.
  const url = image?.image_data_url;
  if (typeof url === "string" && url.startsWith("data:image/")) {
    return { ok: true, dataUrl: url };
  }
  return NOT_FOUND;
}
