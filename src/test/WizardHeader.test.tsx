/**
 * WizardHeader tests.
 *
 * Verifies the 3-column grid layout (no absolute positioning on the progress
 * wrapper) and the presence of key interactive elements.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import WizardHeader from "@/components/WizardHeader";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/contexts/DraftContext", () => ({
  useDraft: () => ({ saveNow: vi.fn().mockResolvedValue(undefined), dirty: false }),
}));

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({
    isGenerating: false,
    answers: {},
    canContinue: false,
    setAnswer: vi.fn(),
    setCanContinue: vi.fn(),
    seedAnswers: vi.fn(),
    resetWizard: vi.fn(),
    setIsGenerating: vi.fn(),
    draftId: null,
    setDraftId: vi.fn(),
  }),
}));

// ProgressBar renders Tooltip + navigation dots — mock it to keep tests simple.
vi.mock("@/components/ProgressBar", () => ({
  default: ({ currentStep }: { currentStep: number }) => (
    <div data-testid="progress-bar">Step {currentStep}</div>
  ),
}));

// DevTestPanel is DEV-only — mock it so it doesn't pull in supabase.
vi.mock("@/components/DevTestPanel", () => ({
  default: () => <div data-testid="dev-test-panel" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderHeader(props: { currentStep?: number; onDevSkip?: () => void } = {}) {
  const { currentStep = 1, ...rest } = props;
  return render(
    <MemoryRouter>
      <WizardHeader currentStep={currentStep} {...rest} />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WizardHeader — layout", () => {
  it("renders a header element", () => {
    const { container } = renderHeader();
    expect(container.querySelector("header")).toBeTruthy();
  });

  it("does not use absolute positioning on the ProgressBar wrapper", () => {
    const { container } = renderHeader({ currentStep: 3 });
    // The center column must NOT have `absolute` in its className
    const progressWrapper = screen.getByTestId("progress-bar").parentElement;
    expect(progressWrapper?.className).not.toMatch(/\babsolute\b/);
  });

  it("uses a relative-positioned header with a centered progress row", () => {
    const { container } = renderHeader();
    const header = container.querySelector("header");
    expect(header?.className).toMatch(/\brelative\b/);
    // Progress bar wrapper uses flex justify-center (not absolute)
    const progressWrapper = container.querySelector(".flex.justify-center");
    expect(progressWrapper).not.toBeNull();
  });

  it("renders ProgressBar inside a non-absolute container", () => {
    renderHeader({ currentStep: 5 });
    const bar = screen.getByTestId("progress-bar");
    // Walk up — none of the ancestors (up to the header) should be absolute
    let el: HTMLElement | null = bar.parentElement;
    while (el && el.tagName !== "HEADER") {
      expect(el.className).not.toMatch(/\babsolute\b/);
      el = el.parentElement;
    }
  });

  it("passes currentStep through to ProgressBar", () => {
    renderHeader({ currentStep: 7 });
    expect(screen.getByTestId("progress-bar").textContent).toBe("Step 7");
  });
});

describe("WizardHeader — buttons", () => {
  it("renders the Save & exit button", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: /save.*exit/i })).toBeTruthy();
  });

  it("does not render the Skip step button when onDevSkip is not provided", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: /skip step/i })).toBeNull();
  });

  it("renders the Skip step button when onDevSkip is provided", () => {
    renderHeader({ onDevSkip: vi.fn() });
    expect(screen.getByRole("button", { name: /skip step/i })).toBeTruthy();
  });
});
