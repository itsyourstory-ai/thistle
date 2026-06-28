import {
  requireAuthedUser,
  createServiceRoleClient,
  unauthorized,
} from "../_shared/auth.ts";
import { upsertContact } from "../_shared/loops.ts";
import { maybeSendWelcome } from "../_shared/accountEmails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const user = await requireAuthedUser(req);
  if (!user) {
    return unauthorized(corsHeaders, 401, "Unauthorized");
  }

  const db = createServiceRoleClient();

  // Build contact properties — start with fields always available from auth.
  const properties: Record<string, unknown> = {
    userId: user.id,
    signupSource: user.app_metadata?.provider === "google" ? "google" : "password",
    createdAt: user.created_at,
  };

  // subscribed — from profiles table.
  const { data: profile } = await db
    .from("profiles")
    .select("subscribed, welcomed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile != null) {
    properties.subscribed = profile.subscribed;
  }

  // childName, occasion, artStyle — from the most recent generated book brief.
  const { data: book } = await db
    .from("generated_books")
    .select("brief")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (book?.brief) {
    const brief = book.brief as Record<string, unknown>;
    if (brief.childName != null) properties.childName = brief.childName;
    if (brief.occasion != null) properties.occasion = brief.occasion;
    if (brief.artStyle != null) properties.artStyle = brief.artStyle;
  }

  // lastPurchaseProduct — from the most recent paid order.
  const { data: order } = await db
    .from("orders")
    .select("product")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (order?.product != null) {
    properties.lastPurchaseProduct = order.product;
  }

  // Sync to Loops — best-effort, never fail the response.
  try {
    await upsertContact(user.email!, properties);
  } catch (err) {
    console.error("[sync-contact] upsertContact failed:", err);
  }

  // Welcome email on first sync — best-effort, never fail the response.
  try {
    await maybeSendWelcome(db, { id: user.id, email: user.email! }, profile);
  } catch (err) {
    console.error("[sync-contact] maybeSendWelcome failed:", err);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
