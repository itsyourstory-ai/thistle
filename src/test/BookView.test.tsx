import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, screen, userEvent, waitFor, fireEvent, act } from "@/test/utils";

// --- Mocks ---

const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: (cols: string) => {
        mockSelect(cols);
        return { eq: () => ({ maybeSingle: mockMaybeSingle }) };
      },
    })),
  },
}));

const mockCallEdge = vi.fn();
vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: (...args: unknown[]) => mockCallEdge(...args),
}));

const mockFetchBookImage = vi.fn();
vi.mock("@/lib/bookImages", () => ({
  fetchBookImage: (...args: unknown[]) => mockFetchBookImage(...args),
}));

vi.mock("@/components/DashboardHeader", () => ({
  default: () => <div data-testid="dashboard-header" />,
}));

import BookView from "@/pages/BookView";

// --- Helpers ---

const PARSED = {
  meta: { title: "Leo and the Dragon" },
  cover: { title: "Leo and the Dragon", subtitle: "A brave tale", image_prompt: "cover prompt" },
  pages: [
    { page_number: 1, role: "title", text: "Leo and the Dragon", layout_id: "title", image_prompt: "p1" },
    { page_number: 2, role: "story", text: "Leo met a dragon.", layout_id: "text-bottom-third", image_prompt: "p2" },
    { page_number: 3, role: "story", text: "The dragon was shy.", layout_id: "text-top-third", image_prompt: "p3" },
    { page_number: 4, role: "story", text: "A story with no picture.", layout_id: "text-center-card", image_prompt: null },
  ],
};

function bookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "book-1",
    pipeline_status: "done",
    pipeline_progress: null,
    pipeline_error: null,
    parsed: PARSED,
    child: { name: "Leo" },
    ...overrides,
  };
}

function renderBookView(id = "book-1") {
  return renderWithProviders(
    <Routes>
      <Route path="/book/:id" element={<BookView />} />
    </Routes>,
    { route: `/book/${id}` },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchBookImage.mockImplementation(async (_id: string, slot: number) =>
    `data:image/png;base64,page-${slot}`,
  );
});

// --- Tests ---

async function clickNext(user: ReturnType<typeof userEvent.setup>, times: number) {
  for (let i = 0; i < times; i++) await user.click(screen.getByRole("button", { name: /next/i }));
}

describe("BookView — a finished book", () => {
  it("buyer sees the book's title and its first page", async () => {
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();

    expect(await screen.findByRole("heading", { name: "Leo and the Dragon" })).toBeInTheDocument();
    const image = await screen.findByRole("img", { name: /illustration for page 1/i });
    expect(image).toHaveAttribute("src", "data:image/png;base64,page-1");
    expect(screen.getByText("Page 1 of 4")).toBeInTheDocument();
  });

  it("buyer can page forward and back through the book", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    await clickNext(user, 1);
    expect(await screen.findByText("Leo met a dragon.")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 4")).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /illustration for page 2/i })).toHaveAttribute(
      "src",
      "data:image/png;base64,page-2",
    );

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(screen.getByText("Page 1 of 4")).toBeInTheDocument();
  });

  it("buyer can't go back from the first page or forward past the last page", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    await clickNext(user, 3);
    expect(screen.getByText("Page 4 of 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("buyer can use the arrow keys to turn pages", async () => {
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByText("Page 2 of 4")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(await screen.findByText("Page 1 of 4")).toBeInTheDocument();
  });

  it("leaves browser shortcuts alone: Alt+Left (Back) doesn't turn the page", async () => {
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByText("Page 2 of 4")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft", altKey: true });
    expect(screen.getByText("Page 2 of 4")).toBeInTheDocument();
  });

  it("loads the page on screen and the next one, not the whole book", async () => {
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    expect(mockFetchBookImage).toHaveBeenCalledWith("book-1", 1);
    await waitFor(() => expect(mockFetchBookImage).toHaveBeenCalledWith("book-1", 2)); // warmed up
    expect(mockFetchBookImage).not.toHaveBeenCalledWith("book-1", 3);
    expect(mockFetchBookImage).not.toHaveBeenCalledWith("book-1", 4);
  });

  it("puts the text above the picture when the layout puts text at the top", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    await clickNext(user, 2); // page 3 uses text-top-third
    const text = await screen.findByText("The dragon was shy.");
    const image = await screen.findByRole("img", { name: /illustration for page 3/i });
    expect(text.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("puts the text below the picture for other layouts", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    await clickNext(user, 1); // page 2 uses text-bottom-third
    const text = await screen.findByText("Leo met a dragon.");
    const image = await screen.findByRole("img", { name: /illustration for page 2/i });
    expect(text.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("shows a page that has no picture as text only, without asking for an image", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    await clickNext(user, 3);
    expect(await screen.findByText("A story with no picture.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /illustration for page 4/i })).not.toBeInTheDocument();
    expect(mockFetchBookImage).not.toHaveBeenCalledWith("book-1", 4);
  });

  it("offers to try again when one picture fails to load, and the text stays readable", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    mockFetchBookImage.mockImplementation(async (_id: string, slot: number) => {
      if (slot === 2) throw new Error("boom");
      return `data:image/png;base64,page-${slot}`;
    });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    await clickNext(user, 1);
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByText("Leo met a dragon.")).toBeInTheDocument();
  });

  it("never asks the database for the whole brief, which holds the buyer's email", async () => {
    mockMaybeSingle.mockResolvedValue({ data: bookRow(), error: null });
    renderBookView();
    await screen.findByRole("img", { name: /page 1/i });

    const cols = mockSelect.mock.calls[0][0] as string;
    const asksForWholeBrief = cols.split(",").some((c) => c.trim() === "brief");
    expect(asksForWholeBrief).toBe(false);
  });
});

describe("BookView — retrying a book that failed or got stuck (THI-10)", () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

  it("buyer can try again when the book failed, and the page goes back to showing progress", async () => {
    const user = userEvent.setup();
    mockMaybeSingle
      .mockResolvedValueOnce({ data: bookRow({ pipeline_status: "failed", parsed: null }), error: null })
      .mockResolvedValue({
        data: bookRow({
          pipeline_status: "portraits",
          pipeline_progress: { stage: "portraits", current: 0, total: 1 },
          parsed: null,
        }),
        error: null,
      });
    mockCallEdge.mockResolvedValue({ data: { id: "book-1", queued: true, restarted: true }, error: null });
    renderBookView();

    await user.click(await screen.findByRole("button", { name: /try again/i }));

    expect(mockCallEdge).toHaveBeenCalledWith("generate-book", { retry_book_id: "book-1" });
    expect(await screen.findByText(/still being made/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("buyer is told why when the retry doesn't work, and can try once more", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow({ pipeline_status: "failed", parsed: null }), error: null });
    mockCallEdge.mockResolvedValue({
      data: null,
      error: {
        context: { json: async () => ({ error: "This order was refunded, so it can't be used to make a book." }) },
      },
    });
    renderBookView();

    await user.click(await screen.findByRole("button", { name: /try again/i }));

    expect(await screen.findByText(/order was refunded/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
  });

  it("buyer can't send two retries at once by double-clicking", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow({ pipeline_status: "failed", parsed: null }), error: null });
    mockCallEdge.mockReturnValue(new Promise(() => {})); // never answers
    renderBookView();

    const button = await screen.findByRole("button", { name: /try again/i });
    await user.click(button);
    await user.click(button);

    expect(mockCallEdge).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });

  it("buyer can try again when the story has been stuck for more than 10 minutes", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: bookRow({
        pipeline_status: "story",
        pipeline_progress: { stage: "story", current: 0, total: 1, started_at: minutesAgo(11) },
        parsed: null,
      }),
      error: null,
    });
    renderBookView();

    expect(await screen.findByText(/taking longer than usual/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("a page left open notices when the story has been running too long, with no reload", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    try {
      mockMaybeSingle.mockResolvedValue({
        data: bookRow({
          pipeline_status: "story",
          pipeline_progress: { stage: "story", current: 0, total: 1, started_at: minutesAgo(9) },
          parsed: null,
        }),
        error: null,
      });
      renderBookView();
      expect(await screen.findByText(/still being made/i)).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2 * 60_000); // now 11 minutes in; the row hasn't changed
      });

      expect(await screen.findByText(/taking longer than usual/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("buyer is told the book is still being made when the server says it was already running", async () => {
    const user = userEvent.setup();
    mockMaybeSingle.mockResolvedValue({ data: bookRow({ pipeline_status: "failed", parsed: null }), error: null });
    mockCallEdge.mockResolvedValue({ data: { id: "book-1", queued: false, existing: true }, error: null });
    renderBookView();

    await user.click(await screen.findByRole("button", { name: /try again/i }));

    expect(await screen.findByText(/still being made\. please check back/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
  });

  it("a story that only just started is still shown as being made, with no retry button", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: bookRow({
        pipeline_status: "story",
        pipeline_progress: { stage: "story", current: 0, total: 1, started_at: minutesAgo(1) },
        parsed: null,
      }),
      error: null,
    });
    renderBookView();

    expect(await screen.findByText(/still being made/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe("BookView — books that can't be read yet", () => {
  it("shows a not-found page for a book the user doesn't own (no row comes back)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    renderBookView("someone-elses-book");

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("shows a not-found page for an id that isn't a real book id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: "22P02", message: 'invalid input syntax for type uuid: "abc"' },
    });
    renderBookView("abc");

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });

  it("offers to try again when the book can't be loaded", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { code: "500", message: "network" } });
    renderBookView();

    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
  });

  it("tells the buyer the book is still being made, with progress", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: bookRow({
        pipeline_status: "pages",
        pipeline_progress: { stage: "pages", current: 5, total: 30 },
        parsed: null,
      }),
      error: null,
    });
    renderBookView();

    expect(await screen.findByText(/still being made/i)).toBeInTheDocument();
    expect(screen.getByText(/painting page 6 of 30/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my books/i })).toHaveAttribute("href", "/dashboard");
  });

  it("tells the buyer when the book failed, and how to reach support", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: bookRow({ pipeline_status: "failed", pipeline_error: "internal detail", parsed: null }),
      error: null,
    });
    renderBookView();

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /support@thistlebook\.com/i })).toHaveAttribute(
      "href",
      "mailto:support@thistlebook.com",
    );
    // Internal error text is for the team, not the buyer.
    expect(screen.queryByText("internal detail")).not.toBeInTheDocument();
  });

  it("says an older book can't be shown here instead of breaking", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: bookRow({ parsed: { cover_text: "Old book", spreads: [] } }),
      error: null,
    });
    renderBookView();

    expect(await screen.findByText(/can't be shown here/i)).toBeInTheDocument();
  });
});
