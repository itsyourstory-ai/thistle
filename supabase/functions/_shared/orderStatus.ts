// Which order status changes a Stripe notification may make (THI-68).
//
// Stripe re-sends notifications it thinks failed and can deliver them late, so a
// "payment succeeded" can arrive after the buyer was refunded. These rules stop
// a late notification from turning a refunded order back into a paid one, which
// would defeat generate-book's refund check (it reads `orders.status`).
// They are pure so they can be unit-tested; stripe-webhook does the DB work.

/** Statuses an order may move to "paid" from. Never "refunded", and "paid" is already there. */
export const CAN_BECOME_PAID_FROM = ["pending", "failed"] as const;

/** Statuses an order may move to "failed" from. Never "paid" or "refunded". */
export const CAN_BECOME_FAILED_FROM = ["pending"] as const;

type Status = string | null | undefined;

// AIDEV-NOTE: stripe-webhook sends the CAN_BECOME_* lists to the database as the
// `.in("status", ...)` filter, so the check happens in the UPDATE itself. That
// stays safe if a refund lands at the same moment; reading the status first and
// updating after would not.

export function canMarkPaid(status: Status): boolean {
  return (CAN_BECOME_PAID_FROM as readonly string[]).includes(status ?? "");
}

export function canMarkFailed(status: Status): boolean {
  return (CAN_BECOME_FAILED_FROM as readonly string[]).includes(status ?? "");
}

/**
 * After a "payment succeeded" notification, whether to send the receipt and
 * start the book. A refunded order gets neither: the buyer has their money back.
 * Anything else carries on as before; generate-book still runs its own paid check.
 */
export function shouldFinishPaidNotification(status: Status): boolean {
  return status !== "refunded";
}
