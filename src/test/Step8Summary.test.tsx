import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ---
// vi.mock is hoisted — do NOT reference top-level variables inside factories.

vi.mock("@/lib/edgeFunctions", () => ({ callEdge: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/hooks/useCharacterPortrait", () => ({
  useCharacterPortrait: () => ({ status: "idle", regenerate: vi.fn(), hasPhoto: false }),
}));
vi.mock("@/hooks/useSupportingPortraits", () => ({
  useSupportingPortraits: () => ({}),
}));
vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock("@/lib/loadingMessages", () => ({
  summaryMessages: () => ["Crafting…"],
  useRotatingMessage: (msgs: string[]) => msgs[0] ?? "",
}));
vi.mock("@/lib/buildBrief", () => ({ buildBrief: (a: unknown) => a }));
vi.mock("@/components/WizardHeader", () => ({ default: () => null }));
vi.mock("@/components/StoryDetailsRecap", () => ({ default: () => null }));
vi.mock("@/contexts/WizardContext", () => ({ useWizard: vi.fn() }));

// --- Imports (after mocks) ---
import * as edgeFns from "@/lib/edgeFunctions";
import { useWizard } from "@/contexts/WizardContext";
import Step8Summary, { computeSummaryBriefHash } from "@/pages/steps/Step8Summary";

const mockSetAnswer = vi.fn();

function setupWizard(answers: Record<string, unknown>) {
  (useWizard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    answers,
    setAnswer: mockSetAnswer,
  });
}

function renderStep(answers: Record<string, unknown> = {}) {
  setupWizard(answers);
  return render(
    <MemoryRouter>
      <Step8Summary />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Step8Summary auto-fetch guard (F4)", () => {
  it("does NOT call generate-summary when brief hash matches cached concept", async () => {
    const base = { childName: "Luna", genre: "adventure" };
    const answers = {
      ...base,
      selectedConcept: { title: "Luna's Quest", summary: "A great adventure." },
      summaryBriefHash: computeSummaryBriefHash(base),
    };

    renderStep(answers);

    await waitFor(() => {
      expect(edgeFns.callEdge).not.toHaveBeenCalledWith(
        "generate-summary",
        expect.anything(),
      );
    });
  });

  it("DOES call generate-summary when brief hash is missing (first visit)", async () => {
    vi.mocked(edgeFns.callEdge).mockResolvedValue({
      data: { title: "New Story", summary: "Once upon a time." },
      error: null,
    });

    renderStep({ childName: "Leo", genre: "fantasy" });

    await waitFor(() => {
      expect(edgeFns.callEdge).toHaveBeenCalledWith(
        "generate-summary",
        expect.anything(),
      );
    });
  });

  it("does NOT call generate-summary when concept is user-edited", async () => {
    const answers = {
      childName: "Max",
      selectedConcept: {
        title: "Max's Custom Story",
        summary: "I wrote this myself.",
        user_edited: true,
      },
      // No summaryBriefHash — would normally trigger a fetch, but user_edited blocks it
    };

    renderStep(answers);

    await waitFor(() => {
      expect(edgeFns.callEdge).not.toHaveBeenCalledWith(
        "generate-summary",
        expect.anything(),
      );
    });
  });
});
