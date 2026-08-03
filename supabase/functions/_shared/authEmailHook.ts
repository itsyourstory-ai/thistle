import { Webhook } from "npm:standardwebhooks@1";
import { sendTransactional, LOOPS_TEMPLATES } from "./loops.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

export async function handleAuthEmailHook(req: Request): Promise<Response> {
  // 1. Non-POST → 400
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 400 });
  }

  // 2. Read raw body
  const rawBody = await req.text();

  // 3. Verify HMAC signature
  const rawSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
  // Strip the "v1," prefix (or any prefix before the first comma)
  const strippedSecret = rawSecret.includes(",")
    ? rawSecret.split(",").slice(1).join(",")
    : rawSecret;

  const wh = new Webhook(strippedSecret);
  try {
    wh.verify(rawBody, Object.fromEntries(req.headers));
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // 4. Parse body
  const { user, email_data } = JSON.parse(rawBody) as {
    user: { email: string };
    email_data: {
      email_action_type: string;
      token_hash: string;
      redirect_to?: string;
    };
  };

  // 5. Map action type to template
  let templateId: string;
  let varName: string;

  if (email_data.email_action_type === "signup") {
    templateId = LOOPS_TEMPLATES.confirmEmail;
    varName = "confirmationUrl";
  } else if (email_data.email_action_type === "recovery") {
    templateId = LOOPS_TEMPLATES.passwordReset;
    varName = "resetUrl";
  } else {
    console.warn("[auth-email-hook] unmapped action type:", email_data.email_action_type);
    return new Response("OK", { status: 200 });
  }

  // 6. Build the verification URL
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const url =
    `${supabaseUrl}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to ?? "")}`;

  // 7. Send transactional email
  const sendPromise = sendTransactional(templateId, user.email, { [varName]: url })
    .then((sent) => {
      if (!sent) console.error("[auth-email-hook] sendTransactional failed for", user.email);
    })
    .catch((err) => {
      console.error("[auth-email-hook] sendTransactional threw for", user.email, err);
    });

  // AIDEV-NOTE: Supabase caps auth hooks at 5s total and a blown budget fails the
  // signup itself, not just the email. Loops latency must never enter that budget.
  // EdgeRuntime is absent under plain `deno test`, so await there to keep tests
  // deterministic.
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(sendPromise);
  } else {
    await sendPromise;
  }

  return new Response("OK", { status: 200 });
}
