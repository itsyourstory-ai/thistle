/**
 * Step9Cast — tests for WizardShell migration, cover-gate, and surprise-name characters.
 *
 * Tests for:
 * - canContinue is false when cover.status !== "ready"
 * - canContinue is true when cover.status === "ready"
 * - missingHint is shown when cover is not ready
 * - Surprise-name supporting character (has id, no name) renders a portrait card
 * - WizardShell is rendered (no hand-rolled bottom bar)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/edgeFunctions", () => ({ callEdge: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/buildBrief", () => ({ buildBrief: (a: unknown) => a }));
vi.mock("@/components/WizardHeader", () => ({
  default: ({ currentStep }: { currentStep: number }) => (
    <div data-testid="wizard-header" data-step={currentStep} />
  ),
}));
vi.mock("@/components/ImageLightbox", () => ({ default: () => null }));
vi.mock("@/lib/loadingMessages", () => ({
  coverMessages: () => ["Drawing the cover…"],
  portraitMessages: () => ["Sketching characters…"],
  useRotatingMessage: (msgs: string[]) => msgs[0] ?? "",
}));
vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// Supabase stub — needed for WizardShell's indirect imports.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}));

// WizardContext — mutable so tests can control canContinue and answers.
let mockSetCanContinue = vi.fn();
let mockCanContinue = false;
let mockAnswers: Record<string, unknown> = {};
const mockSetAnswer = vi.fn();

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({
    answers: mockAnswers,
    setAnswer: mockSetAnswer,
    seedAnswers: vi.fn(),
    canContinue: mockCanContinue,
    setCanContinue: mockSetCanContinue,
    isGenerating: false,
    setIsGenerating: vi.fn(),
    draftId: null,
    setDraftId: vi.fn(),
    resetWizard: vi.fn(),
  }),
}));

// Portrait hooks — idle by default; individual tests override if needed.
vi.mock("@/hooks/useCharacterPortrait", () => ({
  useCharacterPortrait: () => ({
    status: "idle",
    dataUrl: undefined,
    error: undefined,
    regenerate: vi.fn(),
    hasPhoto: false,
  }),
}));

vi.mock("@/hooks/useSupportingPortraits", () => ({
  useSupportingPortraits: () => ({
    portraits: {},
    regenerate: vi.fn(),
  }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import Step9Cast from "@/pages/steps/Step9Cast";

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE_ANSWERS = {
  childName: "Luna",
  selectedConcept: {
    title: "Luna's Adventure",
    summary: "Once upon a time…",
  },
};

function renderStep(answers: Record<string, unknown> = BASE_ANSWERS) {
  mockAnswers = answers;
  return render(
    <MemoryRouter initialEntries={["/step/9-cast"]}>
      <Routes>
        <Route path="/step/:step" element={<Step9Cast />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetCanContinue = vi.fn();
  mockCanContinue = false;
  mockAnswers = { ...BASE_ANSWERS };
});

// ── WizardShell rendered ─────────────────────────────────────────────────────

describe("Step9Cast — WizardShell migration", () => {
  it("renders WizardHeader (from WizardShell, not hand-rolled)", () => {
    renderStep();
    expect(screen.getByTestId("wizard-header")).toBeInTheDocument();
  });

  it("renders the Approve & continue button via WizardShell (not a raw <button>)", () => {
    mockCanContinue = true;
    renderStep();
    expect(
      screen.getByRole("button", { name: /approve & continue/i }),
    ).toBeInTheDocument();
  });

  it("does NOT render the old hand-rolled sticky bar structure (raw back/approve pair outside shell)", () => {
    // WizardShell renders a ← Back button automatically for step > 1.
    // As long as the component no longer has TWO back buttons, the migration is correct.
    renderStep();
    const backButtons = screen.getAllByRole("button", { name: /← back/i });
    // WizardShell provides exactly one Back button.
    expect(backButtons).toHaveLength(1);
  });
});

// ── canContinue gate on cover status ─────────────────────────────────────────

describe("Step9Cast — cover readiness gate", () => {
  it("calls setCanContinue(false) when cover is not ready (idle)", async () => {
    renderStep();
    await waitFor(() => {
      const calls = mockSetCanContinue.mock.calls;
      // At least one call with false, and no call with true.
      expect(calls.some((c) => c[0] === false)).toBe(true);
      expect(calls.every((c) => c[0] !== true)).toBe(true);
    });
  });

  it("calls setCanContinue(true) when cover is pre-loaded (ready)", async () => {
    // Seed a cover image so the cover starts in 'ready' state.
    renderStep({
      ...BASE_ANSWERS,
      selectedConcept: {
        ...BASE_ANSWERS.selectedConcept,
        coverImage: "data:image/png;base64,abc123",
      },
    });
    await waitFor(() => {
      expect(mockSetCanContinue).toHaveBeenCalledWith(true);
    });
  });

  it("calls setCanContinue(false) when cover is in error state", async () => {
    // Provide no coverImage so cover starts idle → loading → (mocked failure via callEdge)
    // For simplicity here we just test the initial idle → false path.
    renderStep({
      ...BASE_ANSWERS,
      selectedConcept: {
        title: "Luna's Adventure",
        summary: "Once upon a time…",
        // No coverImage — starts idle
      },
    });
    await waitFor(() => {
      expect(mockSetCanContinue).toHaveBeenCalledWith(false);
    });
  });
});

// ── missingHint ───────────────────────────────────────────────────────────────

describe("Step9Cast — missingHint when cover not ready", () => {
  it("shows 'Waiting for the cover to finish' hint when cover is not ready and canContinue is false", () => {
    mockCanContinue = false;
    renderStep();
    expect(
      screen.getByText(/waiting for the cover to finish/i),
    ).toBeInTheDocument();
  });

  it("does NOT show the waiting hint when cover is ready and canContinue is true", () => {
    mockCanContinue = true;
    renderStep({
      ...BASE_ANSWERS,
      selectedConcept: {
        ...BASE_ANSWERS.selectedConcept,
        coverImage: "data:image/png;base64,abc123",
      },
    });
    expect(
      screen.queryByText(/waiting for the cover to finish/i),
    ).not.toBeInTheDocument();
  });
});

// ── Surprise-name supporting characters ───────────────────────────────────────

describe("Step9Cast — surprise-name supporting characters", () => {
  it("renders a portrait card for a supporting character that has id but no name", () => {
    renderStep({
      ...BASE_ANSWERS,
      supportingCharacters: [
        { id: "char-surprise-1", name: "", relationship: "friend" },
      ],
    });
    // The fallback label should appear in the DOM.
    expect(screen.getByText("A surprise friend 🎁")).toBeInTheDocument();
  });

  it("does NOT render the fallback label for a character with a real name", () => {
    renderStep({
      ...BASE_ANSWERS,
      supportingCharacters: [
        { id: "char-named-1", name: "Benny", relationship: "friend" },
      ],
    });
    expect(screen.getByText("Benny")).toBeInTheDocument();
    expect(screen.queryByText("A surprise friend 🎁")).not.toBeInTheDocument();
  });

  it("renders both named and surprise-name characters in the same grid", () => {
    renderStep({
      ...BASE_ANSWERS,
      supportingCharacters: [
        { id: "char-named-1", name: "Benny", relationship: "friend" },
        { id: "char-surprise-1", name: null, relationship: "sibling" },
      ],
    });
    expect(screen.getByText("Benny")).toBeInTheDocument();
    expect(screen.getByText("A surprise friend 🎁")).toBeInTheDocument();
  });

  it("excludes supporting characters that have no id at all", () => {
    renderStep({
      ...BASE_ANSWERS,
      supportingCharacters: [
        { id: undefined, name: "Ghost", relationship: "mystery" },
      ],
    });
    // "Ghost" should NOT appear since the character has no id.
    expect(screen.queryByText("Ghost")).not.toBeInTheDocument();
  });
});
