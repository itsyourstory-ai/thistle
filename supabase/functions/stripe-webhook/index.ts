import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createServiceRoleClient } from "../_shared/auth.ts";
import {
  type DbClient,
  maybeSendPaymentFailed,
  maybeSendReceipt,
  maybeSendRefund,
  type OrderRow,
} from "../_shared/orderEmails.ts";

type SupabaseServiceClient = ReturnType<typeof createServiceRoleClient>;

async function findOrderByPaymentIntent(
  supabase: SupabaseServiceClient,
  paymentIntentId: string,
): Promise<OrderRow | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (error) {
    console.error("stripe-webhook order lookup error:", error);
    return null;
  }

  return data as OrderRow | null;
}

function paymentIntentIdFromCharge(charge: Stripe.Charge): string | null {
  const paymentIntent = charge.payment_intent;
  if (typeof paymentIntent === "string") return paymentIntent;
  return paymentIntent?.id ?? null;
}

async function sendReceiptForPaymentIntent(
  supabase: SupabaseServiceClient,
  paymentIntentId: string,
): Promise<void> {
  try {
    const order = await findOrderByPaymentIntent(supabase, paymentIntentId);
    if (!order) {
      console.warn(
        `stripe-webhook receipt email skipped: no order for PaymentIntent ${paymentIntentId}`,
      );
      return;
    }
    await maybeSendReceipt(supabase as unknown as DbClient, order);
  } catch (err) {
    console.error("stripe-webhook receipt email error:", err);
  }
}

async function sendPaymentFailedForPaymentIntent(
  supabase: SupabaseServiceClient,
  paymentIntentId: string,
): Promise<void> {
  try {
    const order = await findOrderByPaymentIntent(supabase, paymentIntentId);
    if (!order) {
      console.warn(
        `stripe-webhook payment-failed email skipped: no order for PaymentIntent ${paymentIntentId}`,
      );
      return;
    }
    if (order.status === "paid") return;
    await maybeSendPaymentFailed(supabase as unknown as DbClient, order);
  } catch (err) {
    console.error("stripe-webhook payment-failed email error:", err);
  }
}

async function sendRefundForPaymentIntent(
  supabase: SupabaseServiceClient,
  paymentIntentId: string,
  refundedAmountCents: number,
): Promise<void> {
  try {
    const order = await findOrderByPaymentIntent(supabase, paymentIntentId);
    if (!order) {
      console.warn(
        `stripe-webhook refund email skipped: no order for PaymentIntent ${paymentIntentId}`,
      );
      return;
    }
    await maybeSendRefund(
      supabase as unknown as DbClient,
      order,
      refundedAmountCents,
    );
  } catch (err) {
    console.error("stripe-webhook refund email error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    // @ts-ignore — Deno requires the fetch http client
    apiVersion: "2024-04-10",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature!,
      webhookSecret,
    );
  } catch (err) {
    console.error("stripe-webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createServiceRoleClient();

  // Idempotency ledger — insert the event id. A duplicate PK (code 23505)
  // means this event was already processed; return 200 immediately.
  const { error: ledgerError } = await supabase
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, type: event.type });

  if (ledgerError) {
    if (ledgerError.code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // Non-idempotency error — log but still return 200 so Stripe doesn't retry
    // indefinitely for a transient DB issue.
    console.error("stripe_webhook_events insert error:", ledgerError);
  }

  // Handle relevant event types
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_payment_intent_id", pi.id)
      .neq("status", "paid");
    await sendReceiptForPaymentIntent(supabase, pi.id);
  } else if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await supabase
      .from("orders")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("stripe_payment_intent_id", pi.id)
      .neq("status", "paid");
    await sendPaymentFailedForPaymentIntent(supabase, pi.id);
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = paymentIntentIdFromCharge(charge);
    if (!paymentIntentId) {
      console.warn(
        `stripe-webhook refund skipped: charge ${charge.id} has no PaymentIntent`,
      );
    } else {
      await supabase
        .from("orders")
        .update({ status: "refunded", updated_at: new Date().toISOString() })
        .eq("stripe_payment_intent_id", paymentIntentId);
      await sendRefundForPaymentIntent(
        supabase,
        paymentIntentId,
        charge.amount_refunded,
      );
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
