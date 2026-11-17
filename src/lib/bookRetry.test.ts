import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const mockCallEdge = vi.fn();
vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: (...args: unknown[]) => mockCallEdge(...args),
}));

import { STALE_STORY_MS, isStuckAtStory, retryBook } from "@/lib/bookRetry";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

describe("isStuckAtStory — is a book's story run dead?", () => {
  it("a story that started a minute ago is not stuck", () => {
    expect(isStuckAtStory("story", { started_at: minutesAgo(1) }, NOW)).toBe(false);
  });

  it("a story still going after more than 10 minutes is stuck", () => {
    expect(isStuckAtStory("story", { started_at: minutesAgo(11) }, NOW)).toBe(true);
  });

  it("the cutoff is exactly 10 minutes", () => {
    expect(isStuckAtStory("story", { started_at: minutesAgo(10) }, NOW)).toBe(false);
    expect(isStuckAtStory("story", { started_at: minutesAgo(10.1) }, NOW)).toBe(true);
  });

  it("the cutoff matches the server's STALE_STORY_MS, so the page and the server agree", () => {
    const server = readFileSync("supabase/functions/_shared/orderBook.ts", "utf8");
    const match = server.match(/export const STALE_STORY_MS = (\d+) \* (\d+) \* (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match![1]) * Number(match![2]) * Number(match![3])).toBe(STALE_STORY_MS);
  });

  it("only the story stage can be stuck this way", () => {
    for (const status of ["portraits", "pages", "done", "failed", "idle", null]) {
      expect(isStuckAtStory(status, { started_at: minutesAgo(60) }, NOW)).toBe(false);
    }
  });

  it("a story with no start time is not called stuck (the page can't tell)", () => {
    expect(isStuckAtStory("story", null, NOW)).toBe(false);
    expect(isStuckAtStory("story", {}, NOW)).toBe(false);
  });
});

describe("retryBook — ask the server to restart the buyer's book", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends exactly what generate-book reads: retry_book_id and nothing else", async () => {
    mockCallEdge.mockResolvedValue({ data: { id: "book-1", queued: true, restarted: true }, error: null });
    const result = await retryBook("book-1");

    expect(mockCallEdge).toHaveBeenCalledWith("generate-book", { retry_book_id: "book-1" });
    expect(result).toEqual({ ok: true, restarted: true });
  });

  it("says nothing was restarted when the server found the book already running", async () => {
    mockCallEdge.mockResolvedValue({ data: { id: "book-1", queued: false, existing: true }, error: null });
    expect(await retryBook("book-1")).toEqual({ ok: true, restarted: false });
  });

  it("gives a friendly message if the call itself throws", async () => {
    mockCallEdge.mockRejectedValue(new Error("offline"));
    const result = await retryBook("book-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/couldn't restart/i);
  });

  it("reports the server's own message when it sends one (e.g. a refunded order)", async () => {
    mockCallEdge.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: { json: async () => ({ error: "This order was refunded, so it can't be used to make a book." }) },
      },
    });
    expect(await retryBook("book-1")).toEqual({
      ok: false,
      message: "This order was refunded, so it can't be used to make a book.",
    });
  });

  it("falls back to a friendly message when the server's reply can't be read", async () => {
    mockCallEdge.mockResolvedValue({ data: null, error: new Error("network down") });
    const result = await retryBook("book-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/couldn't restart/i);
  });

  it("treats an error inside a 200 reply as a failure", async () => {
    mockCallEdge.mockResolvedValue({ data: { error: "Payment not completed." }, error: null });
    expect(await retryBook("book-1")).toEqual({ ok: false, message: "Payment not completed." });
  });
});
