// Pure helpers for Stripe checkout: price map, shipping validation, amount math.
// No network calls or side effects — all Stripe SDK usage lives in the edge functions.

export const PRICE_MAP: Record<string, number> = {
  digital: 999,
  hardcover: 5499,
};

export function baseAmountFor(product: string): number {
  const amount = PRICE_MAP[product];
  if (amount === undefined) throw new Error(`Unknown product: ${product}`);
  return amount;
}

export interface ShippingAddress {
  name?: string | null;
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state_code?: string | null;
  postcode?: string | null;
  country_code?: string | null;
  phone?: string | null;
}

type ValidationResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

export function validateShipping(
  product: string,
  shipping: ShippingAddress | null | undefined,
): ValidationResult {
  if (product !== "hardcover") return { ok: true };

  const errors: Record<string, string> = {};
  if (!shipping) {
    return {
      ok: false,
      errors: {
        street1: "Required",
        city: "Required",
        state_code: "Required",
        postcode: "Required",
        phone: "Required",
      },
    };
  }

  if (!shipping.street1?.trim()) errors.street1 = "Required";
  if (!shipping.city?.trim()) errors.city = "Required";
  if (!shipping.state_code?.trim()) errors.state_code = "Required";
  if (!shipping.postcode?.trim()) errors.postcode = "Required";
  if (!shipping.phone?.trim()) errors.phone = "Required";

  // country_code is always forced to US — not validated as a user field
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}

export function computeAmount(baseCents: number, discountCents: number): number {
  return Math.max(0, baseCents - discountCents);
}
