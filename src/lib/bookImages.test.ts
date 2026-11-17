import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCallEdge = vi.fn();
vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: (...args: unknown[]) => mockCallEdge(...args),
}));

import { fetchBookImage } from "@/lib/bookImages";

beforeEach(() => vi.clearAllMocks());

describe("fetchBookImage", () => {
  // Tests run with edge calls mocked, so this is what catches the app and the
  // get-book-image function disagreeing about the request body (THI-35).
  it("asks get-book-image for the book and page the reader wants", async () => {
    mockCallEdge.mockResolvedValue({ data: { image_data_url: "data:image/png;base64,AAA" }, error: null });

    await fetchBookImage("book-1", 7);

    expect(mockCallEdge).toHaveBeenCalledWith("get-book-image", {
      book_id: "book-1",
      slot: 7,
    });
  });

  it("returns the image data URL", async () => {
    mockCallEdge.mockResolvedValue({ data: { image_data_url: "data:image/png;base64,AAA" }, error: null });
    await expect(fetchBookImage("book-1", 1)).resolves.toBe("data:image/png;base64,AAA");
  });

  it("throws when the function returns an error", async () => {
    mockCallEdge.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(fetchBookImage("book-1", 2)).rejects.toThrow("boom");
  });

  it("throws when the response has no image", async () => {
    mockCallEdge.mockResolvedValue({ data: {}, error: null });
    await expect(fetchBookImage("book-1", 2)).rejects.toThrow(/image/i);
  });
});
