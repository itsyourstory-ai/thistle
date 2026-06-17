/**
 * Step9Generating — unit tests
 *
 * Covers:
 * 1. WizardShell wrapping (no standalone WizardHeader)
 * 2. Indeterminate progress bar during story stage (no progress / progress.total === 0)
 * 3. Deterministic progress bar renders when progress.total > 0
 * 4. Success state — celebratory copy, email confirmation, secondary CTA
 * 5. Success state does NOT show old "Back to start" primary button
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/WizardHeader", () => ({
  default: ({ currentStep }: { currentStep?: number }) => (
    <div data-testid="wizard-header" data-step={currentStep} />
  ),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}));

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

// callEdge — controllable per-test
const mockCallEdge = vi.fn();
vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: (...args: unknown[]) => mockCallEdge(...args),
}));

// getBookStatus — controllable per-test
const mockGetBookStatus = vi.fn();
vi.mock("@/lib/bookStatus", () => ({
  getBookStatus: (...args: unknown[]) => mockGetBookStatus(...args),
}));

// WizardContext — controllable per-test
let mockAnswers: Record<string, unknown> = {};
const mockSetIsGenerating = vi.fn();

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({
    canContinue: true,
    setCanContinue: vi.fn(),
    answers: mockAnswers,
    setAnswer: vi.fn(),
    seedAnswers: vi.fn(),
    isGenerating: false,
    setIsGenerating: mockSetIsGenerating,
    draftId: null,
    setDraftId: vi.fn(),
    resetWizard: vi.fn(),
  }),
}));

// ── Import component after mocks ───────────────────────────────────────────────
import Step9Generating from "@/pages/steps/Step9Generating";

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderStep(answers: Record<string, unknown> = {}) {
  mockAnswers = answers;
  return render(
    <MemoryRouter initialEntries={["/step/12-generating"]}>
      <Routes>
        <Route path="/step/:step" element={<Step9Generating />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAnswers = {};
  // Default: callEdge never resolves (keeps component in generating state)
  mockCallEdge.mockReturnValue(new Promise(() => {}));
  // Default: getBookStatus never resolves
  mockGetBookStatus.mockReturnValue(new Promise(() => {}));
});

// ── Tests: WizardShell wrapping ────────────────────────────────────────────────

describe("Step9Generating — WizardShell", () => {
  it("renders a WizardHeader (via WizardShell)", () => {
    renderStep({ childName: "Mia" });
    expect(screen.getByTestId("wizard-header")).toBeInTheDocument();
  });

  it("does NOT render duplicate WizardHeaders", () => {
    renderStep({ childName: "Mia" });
    // Only one wizard-header should exist (WizardShell's, not a standalone one too)
    expect(screen.getAllByTestId("wizard-header")).toHaveLength(1);
  });
});

// ── Tests: Indeterminate progress bar (story stage) ───────────────────────────

describe("Step9Generating — indeterminate progress bar (story stage)", () => {
  it("shows a 'Writing <name>'s story…' label while generating with no progress", () => {
    renderStep({ childName: "Leo" });
    // The label appears in the indeterminate bar (and also in the rotating message area).
    // Use getAllByText since it may appear in multiple places.
    const labels = screen.getAllByText(/writing leo's story/i);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("includes child's name in the story-stage label", () => {
    renderStep({ childName: "Zara" });
    const labels = screen.getAllByText(/writing zara's story/i);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("shows story-stage label (progress null = indeterminate state)", () => {
    renderStep({ childName: "Ali" });
    // callEdge is hanging — progress is null — indeterminate bar is visible.
    // The label may appear more than once (bar + rotating message), so use getAllByText.
    const storyLabels = screen.getAllByText(/writing ali's story/i);
    expect(storyLabels.length).toBeGreaterThan(0);
  });
});

// ── Tests: Success state ───────────────────────────────────────────────────────

describe("Step9Generating — success state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // callEdge resolves immediately with a book id
    mockCallEdge.mockResolvedValue({ data: { id: "book-abc" }, error: null });
    // getBookStatus returns "done" on first call
    mockGetBookStatus.mockResolvedValue({
      pipeline_status: "done",
      pipeline_progress: null,
      pipeline_error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderAndAdvanceToDone(answers: Record<string, unknown> = {}) {
    renderStep(answers);
    // Flush the callEdge promise and the polling tick promise
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Advance past MIN_DURATION (6000ms)
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    // Flush any resulting state updates
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("shows celebratory message with child's name when done", async () => {
    await renderAndAdvanceToDone({ childName: "Noah", buyer_email: "parent@example.com" });
    expect(screen.getByText(/noah's book is on its way/i)).toBeInTheDocument();
  });

  it("shows email confirmation text when done", async () => {
    await renderAndAdvanceToDone({ childName: "Noah", buyer_email: "parent@example.com" });
    expect(screen.getByText(/parent@example\.com/i)).toBeInTheDocument();
  });

  it("shows 'Create another book' secondary action when done", async () => {
    await renderAndAdvanceToDone({ childName: "Noah", buyer_email: "parent@example.com" });
    expect(screen.getByRole("button", { name: /create another book/i })).toBeInTheDocument();
  });

  it("does NOT show 'Back to start' button when done", async () => {
    await renderAndAdvanceToDone({ childName: "Noah", buyer_email: "parent@example.com" });
    expect(screen.queryByRole("button", { name: /back to start/i })).not.toBeInTheDocument();
  });

  it("shows 'email' copy in success state", async () => {
    await renderAndAdvanceToDone({ childName: "Noah", buyer_email: "parent@example.com" });
    expect(screen.getByText(/you'll get an email/i)).toBeInTheDocument();
  });
});

// ── Tests: Deterministic progress bar ─────────────────────────────────────────

describe("Step9Generating — deterministic progress bar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCallEdge.mockResolvedValue({ data: { id: "book-xyz" }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows page progress label when progress.total > 0", async () => {
    let callCount = 0;
    mockGetBookStatus.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          pipeline_status: "images",
          pipeline_progress: { stage: "pages", current: 3, total: 10 },
          pipeline_error: null,
        });
      }
      return new Promise(() => {}); // hang after first tick
    });

    renderStep({ childName: "Isla" });
    // Flush async operations
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The deterministic bar label "Page 3 of 10" should appear
    expect(screen.getByText(/page 3 of 10/i)).toBeInTheDocument();
  });
});
