export const POLL_INITIAL_DELAY = 3_000;
const POLL_BACKOFF_FACTOR = 1.5;
const POLL_MAX_DELAY = 10_000;

/** Return the next polling delay given the current one. */
export function nextPollDelay(current: number): number {
  return Math.min(current * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY);
}
