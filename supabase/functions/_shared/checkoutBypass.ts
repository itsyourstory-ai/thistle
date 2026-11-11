// Decides whether generate-book may skip the paid-order check (the dev
// "Bypass checkout" toggle). Pure: callers pass in the env values.
//
// The bypass is honored only when ALLOW_CHECKOUT_BYPASS is exactly "true".
// A Stripe test key alone is never enough (THI-37), because the shared
// staging/production project can run on test keys. As a second guard, it is
// always refused on a live Stripe key (secret sk_live_ or restricted rk_live_).

export interface CheckoutBypassEnv {
  ALLOW_CHECKOUT_BYPASS?: string;
  STRIPE_SECRET_KEY?: string;
}

export function isCheckoutBypassAllowed(requested: boolean, env: CheckoutBypassEnv): boolean {
  if (!requested) return false;
  if (env.ALLOW_CHECKOUT_BYPASS !== "true") return false;
  if (/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? "")) return false;
  return true;
}
