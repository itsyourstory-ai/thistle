// get-book-image — returns ONE page image of a book to its owner (THI-20).
//
// The browser can't read `book_images` (service-role only), so the customer
// book viewer calls this instead. One image per request keeps each response
// small: the reader loads the page on screen, not the whole book.
//
// Request:  { book_id: uuid, slot: integer }   (slot = page number)
// Response: { image_data_url: string }   (404 if not found or not the caller's)
//
// Auth: user JWT (verify_jwt = false in config.toml; checked here). Ownership
// is enforced in _shared/bookImage.ts.

import {
  createServiceRoleClient,
  requireAuthedUser,
  unauthorized,
} from "../_shared/auth.ts";
import { getOwnedBookImage, type BookImageDb } from "../_shared/bookImage.ts";
import { assertUuid } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Books are 32 pages (_shared/layoutSequences.ts); leave headroom.
const MAX_SLOT = 64;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const user = await requireAuthedUser(req);
  if (!user) {
    return unauthorized(corsHeaders, 401, "Unauthorized");
  }

  let bookId: string;
  let slot: number;
  try {
    const body = await req.json();
    bookId = assertUuid(body?.book_id, "book_id");
    if (!Number.isInteger(body?.slot) || body.slot < 1 || body.slot > MAX_SLOT) {
      throw new Error(`slot must be an integer from 1 to ${MAX_SLOT}`);
    }
    slot = body.slot;
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Invalid request" }, 400);
  }

  try {
    const result = await getOwnedBookImage(
      createServiceRoleClient() as unknown as BookImageDb,
      { userId: user.id, bookId, slot },
    );
    if (!result.ok) return json({ error: "Not found" }, 404);
    return json({ image_data_url: result.dataUrl });
  } catch (err) {
    console.error("[get-book-image] lookup failed:", err);
    return json({ error: "Could not load the image" }, 500);
  }
});
