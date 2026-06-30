import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mockNavigate = vi.fn();
const mockSeedAnswers = vi.fn();
const mockSetDraftId = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

vi.mock("@/lib/draftPhotos", () => ({
  deserializeAnswers: vi.fn(async (answers: Record<string, unknown>) => answers),
}));

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({
    seedAnswers: mockSeedAnswers,
    setDraftId: mockSetDraftId,
  }),
}));

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/components/LoadingScreen", () => ({
  default: () => <div>Loading draft</div>,
}));

import ResumeDraft from "@/pages/ResumeDraft";
import { deserializeAnswers } from "@/lib/draftPhotos";

function renderResumeRoute(path = "/resume/draft-42", route = "/resume/:draftId") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={<ResumeDraft />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResumeDraft", () => {
  it("loads the draft from the route param, seeds the wizard, and navigates to the saved step", async () => {
    const answers = { childName: "Aria" };
    mockSingle.mockResolvedValueOnce({
      data: { answers, current_step: "/step/11-preview" },
      error: null,
    });

    renderResumeRoute();

    expect(screen.getByText("Loading draft")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalledWith("answers, current_step");
      expect(mockEq).toHaveBeenCalledWith("id", "draft-42");
      expect(deserializeAnswers).toHaveBeenCalledWith(answers);
      expect(mockSeedAnswers).toHaveBeenCalledWith(answers);
      expect(mockSetDraftId).toHaveBeenCalledWith("draft-42");
      expect(mockNavigate).toHaveBeenCalledWith("/step/11-preview");
    });
  });

  it("redirects to dashboard when the draft fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });

    renderResumeRoute();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("redirects to dashboard when the draft id param is missing", async () => {
    renderResumeRoute("/resume", "/resume");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });
});
