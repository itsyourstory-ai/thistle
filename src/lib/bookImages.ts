import { callEdge } from "@/lib/edgeFunctions";

/**
 * Loads one page image of the signed-in user's own book.
 *
 * Images can't be read straight from the database (book_images is
 * service-role only), so they come from the get-book-image edge function,
 * one at a time to keep each response small. The function answers 404 for a
 * book that isn't the caller's, which surfaces here as a thrown error.
 */
export async function fetchBookImage(bookId: string, slot: number): Promise<string> {
  const { data, error } = await callEdge("get-book-image", {
    book_id: bookId,
    slot,
  });
  if (error) throw error;
  const url: unknown = data?.image_data_url;
  if (typeof url !== "string" || !url) throw new Error("No image returned.");
  return url;
}
