// Loops email platform transport — mock and live modes.
//
// Transport selection via LOOPS_TRANSPORT env var:
//   "live"         → real Loops API calls (LOOPS_API_KEY required; throws if missing)
//   unset / other  → push a record to mockSentEmails, send nothing
//
// All send functions are best-effort: non-2xx responses are logged and
// resolved without throwing. Network errors are similarly swallowed.
// The only exception: live mode with a missing LOOPS_API_KEY throws
// immediately — that is an unrecoverable configuration error.

const LOOPS_API_BASE = "https://app.loops.so";

export interface LoopsRecordedCall {
  kind: "transactional" | "contact" | "event";
  payload: Record<string, unknown>;
}

// Single source of truth for Loops template IDs.
export const LOOPS_TEMPLATES: Record<string, string> = {
  confirmEmail: "cmqxafmpp02ti0jyqdn2x2uqs",
  passwordReset: "cmqxax8oe03760jy233f2si9i",
  accountDeletion: "cmqxbaohm03ky0j015zoo3yh6",
  welcome: "cmqxbdgvz03550jzq4d4g0hcj",
  orderReceipt: "cmqzoonw402de0jzbgmmcfcqn",
  paymentFailed: "cmqzpm8mt039d0jz6t4gfx0fc",
  refund: "cmqzpppnu03c70j0qk4f8i5z8",
  abandonedCheckout: "cmqzpsdx203gw0jxhtdcbsvzc",
  bookCreating: "cmrb2qmp201n40j33xtmisfzu",
  bookReady: "cmrb2wnuv01r60j2jq6d4vie5",
  bookFailed: "cmrb32ry401qq0j2sq2aigd8f",
};

export const mockSentEmails: LoopsRecordedCall[] = [];

export function __resetLoopsMock(): void {
  mockSentEmails.length = 0;
}

function isMockMode(): boolean {
  return Deno.env.get("LOOPS_TRANSPORT") !== "live";
}

function getApiKey(): string {
  const key = Deno.env.get("LOOPS_API_KEY");
  if (!key) throw new Error("LOOPS_API_KEY is not configured");
  return key;
}

async function loopsFetch(path: string, payload: Record<string, unknown>): Promise<boolean> {
  const apiKey = getApiKey();
  let resp: Response;
  try {
    resp = await fetch(`${LOOPS_API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn(`[loops] fetch failed for ${path}:`, err);
    return false;
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.warn(`[loops] ${path} → ${resp.status}: ${text.slice(0, 200)}`);
    return false;
  }
  return true;
}

export async function sendTransactional(
  templateId: string,
  email: string,
  dataVariables: Record<string, unknown>,
): Promise<boolean> {
  const payload: Record<string, unknown> = { transactionalId: templateId, email, dataVariables };
  if (isMockMode()) {
    mockSentEmails.push({ kind: "transactional", payload });
    return true;
  }
  return loopsFetch("/api/v1/transactional", payload);
}

export async function upsertContact(
  email: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const payload: Record<string, unknown> = { email, ...properties };
  if (isMockMode()) {
    mockSentEmails.push({ kind: "contact", payload });
    return;
  }
  await loopsFetch("/api/v1/contacts/update", payload);
}

export async function sendEvent(
  email: string,
  eventName: string,
  properties: Record<string, unknown>,
): Promise<void> {
  const payload: Record<string, unknown> = { email, eventName, ...properties };
  if (isMockMode()) {
    mockSentEmails.push({ kind: "event", payload });
    return;
  }
  await loopsFetch("/api/v1/events/send", payload);
}
