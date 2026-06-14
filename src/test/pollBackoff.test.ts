import { describe, it, expect } from "vitest";
import { nextPollDelay, POLL_INITIAL_DELAY } from "@/lib/pollBackoff";

describe("nextPollDelay", () => {
  it("starts at POLL_INITIAL_DELAY", () => {
    expect(POLL_INITIAL_DELAY).toBe(3000);
  });

  it("multiplies by 1.5 each step", () => {
    expect(nextPollDelay(3000)).toBe(4500);
    expect(nextPollDelay(4500)).toBe(6750);
  });

  it("caps at 10 000 ms", () => {
    expect(nextPollDelay(6750)).toBe(10000);
    expect(nextPollDelay(10000)).toBe(10000);
    expect(nextPollDelay(99999)).toBe(10000);
  });
});
