// Sends a deliberately fabricated signup event. The resulting email's verification link
// will be dead because its token_hash is fake; this script tests delivery, not verification.
import { Webhook } from "npm:standardwebhooks@1";

const [targetUrl, rawSecret, recipientEmail] = Deno.args;

if (!targetUrl || !rawSecret || !recipientEmail) {
  throw new Error(
    "Usage: deno run --allow-net scripts/preflight-auth-email-hook.ts <function-url> <v1,whsec_...> <recipient-email>",
  );
}

// Match authEmailHook.ts: accept the dashboard's `v1,`-prefixed value.
const secret = rawSecret.includes(",")
  ? rawSecret.split(",").slice(1).join(",")
  : rawSecret;
const webhook = new Webhook(secret);
const body = JSON.stringify({
  user: { email: recipientEmail },
  email_data: {
    email_action_type: "signup",
    token_hash: "preflight-fabricated-token-hash",
    redirect_to: "https://thistlebook.com/",
  },
});
const messageId = crypto.randomUUID();
const timestamp = new Date();

const response = await fetch(targetUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "webhook-id": messageId,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": webhook.sign(messageId, timestamp, body),
  },
  body,
});

console.log(`Response status: ${response.status}`);
console.log(`Response body: ${await response.text()}`);
