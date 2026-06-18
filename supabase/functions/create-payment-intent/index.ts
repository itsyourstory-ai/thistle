import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  requireAuthedUser,
  unauthorized,
  createServiceRoleClient,
  rateLimitExceeded,
} from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import {
  baseAmountFor,
  validateShipping,
  computeAmount,
  type ShippingAddress,
} from "../_shared/stripe.ts";
import { sanitizeUserText, isValidEmail } from "../_shared/sanitize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await requireAuthedUser(req);
    if (!user) return unauthorized(corsHeaders, 401, "Authentication required.");

    const supabase = createServiceRoleClient();
    const allowed = await checkRateLimit(supabase, user.id, "create-payment-intent", 10, 60);
    if (!allowed) return rateLimitExceeded(corsHeaders);

    const body = await req.json();
    const product: string = body.product;
    const draft_id: string = body.draft_id;
    const discount_code: string | null = body.discount_code ?? null;
    const shipping: ShippingAddress | null = body.shipping ?? null;
    const buyer_name: string | null = body.buyer_name
      ? sanitizeUserText(body.buyer_name, 200)
      : null;
    const rawBuyerEmail = body.buyer_email ? sanitizeUserText(body.buyer_email, 200) : null;
    const buyer_email: string | null = rawBuyerEmail && isValidEmail(rawBuyerEmail) ? rawBuyerEmail : null;

    if (!product || !draft_id) {
      return jsonResponse({ error: "product and draft_id are required." }, 400);
    }

    // Validate product and derive base amount
    let baseCents: number;
    try {
      baseCents = baseAmountFor(product);
    } catch {
      return jsonResponse({ error: "Invalid product." }, 400);
    }

    // Validate shipping for hardcover; digital always passes
    const shippingValidation = validateShipping(product, shipping);
    if (!shippingValidation.ok) {
      return jsonResponse(
        { error: "Invalid shipping address.", errors: shippingValidation.errors },
        400,
      );
    }

    // Normalise shipping: force country_code to US for hardcover, null for digital
    const normalizedShipping: ShippingAddress | null =
      product === "hardcover" && shipping
        ? { ...shipping, country_code: "US" }
        : null;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      // @ts-ignore — Deno requires the fetch http client; type definition mismatch is expected
      apiVersion: "2024-04-10",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Resolve discount code — invalid codes don't block the flow, they return
    // discount_invalid: true and the amount stays unchanged.
    let discountCents = 0;
    let discountInvalid = false;
    if (discount_code) {
      const codes = await stripe.promotionCodes.list({
        code: discount_code,
        active: true,
        limit: 1,
      });
      if (codes.data.length === 0 || !codes.data[0].active) {
        discountInvalid = true;
      } else {
        const coupon = codes.data[0].coupon;
        if (coupon.amount_off) {
          discountCents = coupon.amount_off;
        } else if (coupon.percent_off) {
          discountCents = Math.floor(baseCents * coupon.percent_off / 100);
        }
      }
    }

    const amountCents = computeAmount(baseCents, discountCents);

    // Look up any existing order for this (user, draft) pair
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, stripe_payment_intent_id, stripe_customer_id, amount_cents, discount_cents")
      .eq("user_id", user.id)
      .eq("draft_id", draft_id)
      .maybeSingle();

    // Invalid discount code: return the current PI state unchanged — don't
    // overwrite a previously applied valid discount or update the PI amount.
    if (discountInvalid && existingOrder?.stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(existingOrder.stripe_payment_intent_id);
      return jsonResponse({
        client_secret: pi.client_secret,
        order_id: existingOrder.id,
        amount_cents: existingOrder.amount_cents,
        discount_cents: existingOrder.discount_cents,
        discount_invalid: true,
      });
    }

    let orderId: string;
    let clientSecret: string;

    // Create or reuse Stripe customer keyed on email
    let stripeCustomerId: string | null = existingOrder?.stripe_customer_id ?? null;
    if (buyer_email && !stripeCustomerId) {
      const existing = await stripe.customers.list({ email: buyer_email, limit: 1 });
      stripeCustomerId = existing.data.length > 0
        ? existing.data[0].id
        : (await stripe.customers.create({
          name: buyer_name ?? undefined,
          email: buyer_email,
        })).id;
    }

    const appliedDiscountCode = discount_code ?? null;
    const appliedDiscountCents = discountCents;

    if (existingOrder?.stripe_payment_intent_id) {
      // Re-use existing order and PI — update amount and metadata in place
      orderId = existingOrder.id;
      const pi = await stripe.paymentIntents.update(
        existingOrder.stripe_payment_intent_id,
        {
          amount: amountCents,
          customer: stripeCustomerId ?? undefined,
          metadata: { order_id: orderId, user_id: user.id, draft_id },
        },
      );
      clientSecret = pi.client_secret!;

      await supabase.from("orders").update({
        product,
        base_amount_cents: baseCents,
        discount_code: appliedDiscountCode,
        discount_cents: appliedDiscountCents,
        amount_cents: amountCents,
        buyer_name,
        buyer_email,
        shipping: normalizedShipping,
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      }).eq("id", orderId);
    } else {
      // New order: generate the ID locally so it can serve as the Stripe idempotency key
      orderId = crypto.randomUUID();
      const pi = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency: "usd",
          customer: stripeCustomerId ?? undefined,
          metadata: { order_id: orderId, user_id: user.id, draft_id },
        },
        { idempotencyKey: orderId },
      );
      clientSecret = pi.client_secret!;

      await supabase.from("orders").insert({
        id: orderId,
        user_id: user.id,
        draft_id,
        product,
        base_amount_cents: baseCents,
        discount_code: appliedDiscountCode,
        discount_cents: appliedDiscountCents,
        amount_cents: amountCents,
        currency: "usd",
        buyer_name,
        buyer_email,
        shipping: normalizedShipping,
        stripe_payment_intent_id: pi.id,
        stripe_customer_id: stripeCustomerId,
        status: "pending",
      });
    }

    return jsonResponse({
      client_secret: clientSecret,
      order_id: orderId,
      amount_cents: amountCents,
      discount_cents: appliedDiscountCents,
      ...(discountInvalid ? { discount_invalid: true } : {}),
    });
  } catch (err) {
    console.error("create-payment-intent error:", err);
    return jsonResponse({ error: "Internal server error." }, 500);
  }
});
