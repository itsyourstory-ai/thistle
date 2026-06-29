import { LOOPS_TEMPLATES, sendTransactional } from "./loops.ts";
import type { ShippingAddress } from "./stripe.ts";

export interface OrderRow {
  id: string;
  status?: string;
  product: string;
  amount_cents: number;
  buyer_name: string | null;
  buyer_email: string | null;
  shipping: ShippingAddress | null;
  draft_id: string | null;
  receipt_email_sent_at: string | null;
  payment_failed_email_sent_at: string | null;
  refund_email_sent_at: string | null;
  abandoned_email_sent_at: string | null;
  [key: string]: unknown;
}

export interface DbClient {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<unknown>;
    };
  };
}

type StampColumn =
  | "receipt_email_sent_at"
  | "payment_failed_email_sent_at"
  | "refund_email_sent_at"
  | "abandoned_email_sent_at";

function appBaseUrl(): string {
  return (Deno.env.get("APP_BASE_URL") ?? "http://localhost:8080").replace(
    /\/+$/,
    "",
  );
}

export function resumeLink(order: Pick<OrderRow, "draft_id">): string {
  const base = appBaseUrl();
  return order.draft_id
    ? `${base}/resume/${order.draft_id}`
    : `${base}/dashboard`;
}

async function stampOrder(
  db: DbClient,
  order: OrderRow,
  column: StampColumn,
): Promise<void> {
  await db.from("orders").update({ [column]: new Date().toISOString() }).eq(
    "id",
    order.id,
  );
}

async function maybeSendOrderEmail(
  db: DbClient,
  order: OrderRow,
  stampColumn: StampColumn,
  templateId: string,
  dataVariables: Record<string, unknown>,
): Promise<boolean> {
  if (order[stampColumn] !== null) return false;
  if (!order.buyer_email) {
    console.warn(
      `[orderEmails] skipping ${stampColumn} for order ${order.id}: missing buyer_email`,
    );
    return false;
  }

  const sent = await sendTransactional(
    templateId,
    order.buyer_email,
    dataVariables,
  );
  if (!sent) return false;

  await stampOrder(db, order, stampColumn);
  return true;
}

export async function maybeSendReceipt(
  db: DbClient,
  order: OrderRow,
): Promise<boolean> {
  const dataVariables: Record<string, unknown> = {
    orderId: order.id,
    product: order.product,
    amountCents: order.amount_cents,
    buyerName: order.buyer_name ?? "",
  };

  if (order.product === "hardcover" && order.shipping) {
    dataVariables.shipping = order.shipping;
  }

  return maybeSendOrderEmail(
    db,
    order,
    "receipt_email_sent_at",
    LOOPS_TEMPLATES.orderReceipt,
    dataVariables,
  );
}

export async function maybeSendPaymentFailed(
  db: DbClient,
  order: OrderRow,
): Promise<boolean> {
  return maybeSendOrderEmail(
    db,
    order,
    "payment_failed_email_sent_at",
    LOOPS_TEMPLATES.paymentFailed,
    { retryUrl: resumeLink(order) },
  );
}

export async function maybeSendRefund(
  db: DbClient,
  order: OrderRow,
  refundedAmountCents: number,
): Promise<boolean> {
  return maybeSendOrderEmail(
    db,
    order,
    "refund_email_sent_at",
    LOOPS_TEMPLATES.refund,
    { orderId: order.id, amount: refundedAmountCents },
  );
}

export async function maybeSendAbandoned(
  db: DbClient,
  order: OrderRow,
): Promise<boolean> {
  return maybeSendOrderEmail(
    db,
    order,
    "abandoned_email_sent_at",
    LOOPS_TEMPLATES.abandonedCheckout,
    { resumeUrl: resumeLink(order) },
  );
}
