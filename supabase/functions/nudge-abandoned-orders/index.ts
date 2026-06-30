import {
  createServiceRoleClient,
  isServiceRoleRequest,
  unauthorized,
} from "../_shared/auth.ts";
import {
  abandonedOrderNudgeCutoff,
  type DbClient,
  isAbandonedOrderNudgeCandidate,
  maybeSendAbandoned,
  type OrderRow,
} from "../_shared/orderEmails.ts";

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isServiceRoleRequest(req)) {
    return unauthorized(corsHeaders, 401, "Unauthorized");
  }

  const supabase = createServiceRoleClient();
  const now = new Date();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending")
    .is("abandoned_email_sent_at", null)
    .lt("created_at", abandonedOrderNudgeCutoff(now).toISOString());

  if (error) {
    console.error("[nudge-abandoned-orders] orders lookup failed:", error);
    return jsonResponse({ error: "Failed to select abandoned orders." }, 500);
  }

  let nudged = 0;
  for (const order of (data ?? []) as OrderRow[]) {
    if (!isAbandonedOrderNudgeCandidate(order, now)) continue;

    try {
      const sent = await maybeSendAbandoned(
        supabase as unknown as DbClient,
        order,
      );
      if (sent) nudged += 1;
    } catch (err) {
      console.error(
        `[nudge-abandoned-orders] abandoned email failed for order ${order.id}:`,
        err,
      );
    }
  }

  return jsonResponse({ nudged });
});
