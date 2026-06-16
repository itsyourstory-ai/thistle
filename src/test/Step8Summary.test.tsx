import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, fireEvent } from "@testing-library/react";
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
// WizardShell: render children and a data-testid so tests can verify it's used
vi.mock("@/components/WizardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wizard-shell">{children}</div>
  ),
}));

// --- Imports (after mocks) ---
import * as edgeFns from "@/lib/edgeFunctions";
import { useWizard } from "@/contexts/WizardContext";
import Step8Summary, { computeSummaryBriefHash } from "@/pages/steps/Step8Summary";

const mockSetAnswer = vi.fn();
const mockSetCanContinue = vi.fn();

function setupWizard(answers: Record<string, unknown>) {
  (useWizard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    answers,
    setAnswer: mockSetAnswer,
    setCanContinue: mockSetCanContinue,
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

describe("Step8Summary WizardShell integration", () => {
  it("renders WizardShell (no hand-rolled back/continue buttons)", async () => {
    const base = { childName: "Luna", genre: "adventure" };
    const answers = {
      ...base,
      selectedConcept: { title: "Luna's Quest", summary: "A great adventure." },
      summaryBriefHash: computeSummaryBriefHash(base),
    };

    renderStep(answers);

    // WizardShell wrapper must be present
    expect(screen.getByTestId("wizard-shell")).toBeInTheDocument();

    // Hand-rolled Back / Continue buttons must NOT be in the DOM
    const backBtn = screen.queryByRole("button", { name: /← back/i });
    const continueBtn = screen.queryByRole("button", { name: /continue →/i });
    expect(backBtn).toBeNull();
    expect(continueBtn).toBeNull();
  });
});

describe("Step8Summary canContinue (F3)", () => {
  it("calls setCanContinue(true) when a summary is present and not loading/editing", async () => {
    const base = { childName: "Luna", genre: "adventure" };
    const answers = {
      ...base,
      selectedConcept: { title: "Luna's Quest", summary: "A great adventure." },
      summaryBriefHash: computeSummaryBriefHash(base),
    };

    renderStep(answers);

    await waitFor(() => {
      expect(mockSetCanContinue).toHaveBeenCalledWith(true);
    });
  });

  it("calls setCanContinue(false) when no summary present", async () => {
    // Mock callEdge to hang so loading stays true and we can see the false state
    vi.mocked(edgeFns.callEdge).mockReturnValue(new Promise(() => {}));

    renderStep({ childName: "Leo" });

    await waitFor(() => {
      expect(mockSetCanContinue).toHaveBeenCalledWith(false);
    });
  });
});

describe("Step8Summary error handling (F6)", () => {
  it("shows friendly error copy (not raw error string) when first generation fails", async () => {
    vi.mocked(edgeFns.callEdge).mockResolvedValue({
      data: null,
      error: { message: "Internal server error: timeout at model layer" },
    });

    renderStep({ childName: "Leo", genre: "fantasy" });

    await waitFor(() => {
      expect(
        screen.getByText(/we couldn't craft the story just yet/i),
      ).toBeInTheDocument();
    });

    // Raw error string must NOT be shown
    expect(
      screen.queryByText(/internal server error/i),
    ).toBeNull();
  });

  it("shows 'Write it yourself' affordance when first generation fails (no prior summary)", async () => {
    vi.mocked(edgeFns.callEdge).mockResolvedValue({
      data: null,
      error: { message: "Something went wrong" },
    });

    renderStep({ childName: "Leo", genre: "fantasy" });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /write it yourself/i }),
      ).toBeInTheDocument();
    });
  });

  it("does NOT show 'Write it yourself' when there is already a summary (re-gen failure)", async () => {
    vi.mocked(edgeFns.callEdge).mockResolvedValue({
      data: null,
      error: { message: "Something went wrong" },
    });

    const base = { childName: "Luna", genre: "adventure" };
    const answers = {
      ...base,
      selectedConcept: { title: "Luna's Quest", summary: "A great adventure." },
      // No hash, so a re-gen is triggered
    };

    renderStep(answers);

    await waitFor(() => {
      // Error message shown
      expect(
        screen.getByText(/we couldn't craft the story just yet/i),
      ).toBeInTheDocument();
    });

    // "Write it yourself" should NOT appear because we already have a summary
    expect(screen.queryByRole("button", { name: /write it yourself/i })).toBeNull();
  });

  it("enables canContinue after entering a manual summary and saving", async () => {
    vi.mocked(edgeFns.callEdge).mockResolvedValue({
      data: null,
      error: { message: "Something went wrong" },
    });

    renderStep({ childName: "Leo", genre: "fantasy" });

    // Wait for error + affordance
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /write it yourself/i })).toBeInTheDocument();
    });

    // Click "Write it yourself" to enter edit mode
    fireEvent.click(screen.getByRole("button", { name: /write it yourself/i }));

    // Fill in the title and summary
    const titleInput = screen.getByPlaceholderText(/working title/i);
    fireEvent.change(titleInput, { target: { value: "Leo's Custom Story" } });
    // Use querySelector to target the textarea specifically (avoids ambiguity with input)
    const textarea = document.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "Once upon a time in a magical land." } });

    // Click Save
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    // After save, setCanContinue(true) should have been called
    await waitFor(() => {
      expect(mockSetCanContinue).toHaveBeenCalledWith(true);
    });
  });
});
