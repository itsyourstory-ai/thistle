import { loadStripe } from "@stripe/stripe-js";

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ?? (import.meta.env.DEV ? "pk_test_placeholder" : undefined);

export const stripePromise = loadStripe(key);
