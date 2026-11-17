// Saving the buyer's details on an order without touching its price (THI-67).
//
// create-payment-intent normally rewrites the whole order on every call. But
// when a promo code has stopped working (expired or turned off after the buyer
// clicked "Apply"), it answers with the order exactly as it was, so the buyer
// isn't charged a different amount than the one on screen. That early answer
// used to skip the order update entirely, so the name and email never got
// saved and no receipt could be sent. This helper saves just those fields.

import type { ShippingAddress } from "./stripe.ts";

export interface BuyerDetails {
  buyer_name: string | null;
  buyer_email: string | null;
  shipping: ShippingAddress | null;
}

// Minimal slice of the Supabase client used by saveBuyerDetailsOnOrder.
export interface OrderUpdateDb {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(col: string, val: unknown): PromiseLike<{ error: unknown }>;
    };
  };
}

/**
 * Save whichever buyer details the request sent, and nothing else. Details the
 * request left out are not written, so a call with none (like the "Apply"
 * click) can't erase ones saved earlier. Price fields are never written.
 * Throws on a database error; the caller decides whether that matters.
 */
export async function saveBuyerDetailsOnOrder(
  db: OrderUpdateDb,
  orderId: string,
  details: BuyerDetails,
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (details.buyer_name) values.buyer_name = details.buyer_name;
  if (details.buyer_email) values.buyer_email = details.buyer_email;
  if (details.shipping) values.shipping = details.shipping;
  if (Object.keys(values).length === 0) return;

  const { error } = await db
    .from("orders")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;
}

/**
 * Same as saveBuyerDetailsOnOrder, but a database error is logged and reported
 * as `false` instead of thrown. create-payment-intent uses this on the
 * invalid-promo-code path, where payment must go ahead either way.
 *   true  = saved (or there was nothing to save)
 *   false = the save failed
 */
export async function trySaveBuyerDetailsOnOrder(
  db: OrderUpdateDb,
  orderId: string,
  details: BuyerDetails,
): Promise<boolean> {
  try {
    await saveBuyerDetailsOnOrder(db, orderId, details);
    return true;
  } catch (err) {
    console.error("create-payment-intent: saving buyer details failed:", err);
    return false;
  }
}
