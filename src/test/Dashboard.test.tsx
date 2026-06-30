import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

// --- Mocks ---

vi.mock("@tanstack/react-query", async (importActual) => {
  const actual = await importActual<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: vi.fn(), useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })) };
});

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "book_drafts") {
        return {
          delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
          select: mockSelect,
        };
      }
      return {
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      };
    }),
  },
}));

vi.mock("@/lib/draftPhotos", () => ({
  deserializeAnswers: vi.fn(async (answers: Record<string, unknown>) => answers),
}));

const mockResumeDraftById = vi.hoisted(() => vi.fn());

vi.mock("@/lib/resumeDraft", () => ({
  resumeDraftById: mockResumeDraftById,
}));

const mockSeedAnswers = vi.fn();
const mockSetDraftId = vi.fn();
const mockResetWizard = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({
    seedAnswers: mockSeedAnswers,
    setDraftId: mockSetDraftId,
    resetWizard: mockResetWizard,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@test.com" } }),
}));

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/components/DraftCard", () => ({
  default: ({ childName, onResume, onDelete }: any) => (
    <div data-testid="draft-card">
      <span>{childName}</span>
      <button onClick={onResume}>Resume</button>
      <button onClick={onDelete}>Delete</button>
    </div>
  ),
}));

vi.mock("@/components/BookCard", () => ({
  default: ({ title }: any) => <div data-testid="book-card">{title}</div>,
}));

vi.mock("@/components/DashboardHeader", () => ({
  default: () => <div data-testid="dashboard-header" />,
}));

// --- Helpers ---

import Dashboard from "@/pages/Dashboard";
import { resumeDraftById } from "@/lib/resumeDraft";

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

function mockQueries({
  drafts = [],
  books = [],
  draftsLoading = false,
  booksLoading = false,
}: {
  drafts?: any[];
  books?: any[];
  draftsLoading?: boolean;
  booksLoading?: boolean;
} = {}) {
  (useQuery as any)
    .mockImplementationOnce(() => ({ data: drafts, isLoading: draftsLoading }))
    .mockImplementationOnce(() => ({ data: books, isLoading: booksLoading }));
}

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks();
  mockResumeDraftById.mockResolvedValue(true);
});

describe("Dashboard", () => {
  it("shows empty state for drafts section when no drafts", () => {
    mockQueries({ drafts: [], books: [] });
    renderDashboard();
    expect(
      screen.getByText("No drafts yet. Start creating your first book!"),
    ).toBeInTheDocument();
  });

  it("shows empty state for books section when no books", () => {
    mockQueries({ drafts: [], books: [] });
    renderDashboard();
    expect(
      screen.getByText("No books yet. Create your first one above!"),
    ).toBeInTheDocument();
  });

  it("shows DraftCard when drafts exist", () => {
    const drafts = [
      {
        id: "draft-1",
        child_name: "Mia",
        current_step: "/step/3-genre",
        updated_at: new Date().toISOString(),
        answers: { childName: "Mia" },
      },
    ];
    mockQueries({ drafts, books: [] });
    renderDashboard();
    expect(screen.getByTestId("draft-card")).toBeInTheDocument();
    expect(screen.getByText("Mia")).toBeInTheDocument();
  });

  it("shows BookCard when books exist", () => {
    // PostgREST returns JSON sub-path selects as top-level fields
    const books = [
      {
        id: "book-1",
        created_at: new Date().toISOString(),
        childName: "Leo",
        selectedConcept: { title: "The Great Adventure" },
        parsed: null,
        status: "ok",
      },
    ];
    mockQueries({ drafts: [], books });
    renderDashboard();
    expect(screen.getByTestId("book-card")).toBeInTheDocument();
    expect(screen.getByText("The Great Adventure")).toBeInTheDocument();
  });

  it('"Create a new book" button calls resetWizard and navigates to /step/1-name', () => {
    mockQueries();
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /create a new book/i }));
    expect(mockResetWizard).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith("/step/1-name");
  });

  it("clicking Resume delegates to the shared resume helper", async () => {
    const drafts = [
      {
        id: "draft-42",
        child_name: "Aria",
        current_step: "/step/5-interests",
        updated_at: new Date().toISOString(),
      },
    ];

    mockQueries({ drafts, books: [] });
    renderDashboard();

    fireEvent.click(screen.getByRole("button", { name: /resume/i }));

    await waitFor(() => {
      expect(resumeDraftById).toHaveBeenCalledWith("draft-42", {
        seedAnswers: mockSeedAnswers,
        setDraftId: mockSetDraftId,
        navigate: mockNavigate,
      });
    });
  });
});
