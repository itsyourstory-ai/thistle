/**
 * WizardShell — new optional props tests
 *
 * Tests for: continueLabel, missingHint, footer
 *
 * Strategy: mock WizardContext to control canContinue, mock react-router-dom
 * to provide a stable step param, and mock WizardHeader to avoid supabase deps.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import WizardShell from "@/components/WizardShell";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stub WizardHeader — it tries to connect to supabase for the dev panel.
vi.mock("@/components/WizardHeader", () => ({
  default: () => <div data-testid="wizard-header" />,
}));

// Stub supabase so any indirect imports don't fail.
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

// WizardContext mock — canContinue is configurable per-test.
let mockCanContinue = false;

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({
    canContinue: mockCanContinue,
    setCanContinue: vi.fn(),
    answers: {},
    setAnswer: vi.fn(),
    seedAnswers: vi.fn(),
    isGenerating: false,
    setIsGenerating: vi.fn(),
    draftId: null,
    setDraftId: vi.fn(),
    resetWizard: vi.fn(),
  }),
}));

// ── Helper ─────────────────────────────────────────────────────────────────────

function renderShell(props: Partial<React.ComponentProps<typeof WizardShell>> = {}) {
  return render(
    <MemoryRouter initialEntries={["/step/3-genre"]}>
      <Routes>
        <Route
          path="/step/:step"
          element={
            <WizardShell {...props}>
              <div>Step content</div>
            </WizardShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

// ── continueLabel ──────────────────────────────────────────────────────────────

describe("WizardShell — continueLabel prop", () => {
  it("renders default 'Continue →' when continueLabel is not provided", () => {
    mockCanContinue = true;
    renderShell();
    expect(screen.getByRole("button", { name: /continue →/i })).toBeInTheDocument();
  });

  it("renders custom label when continueLabel is provided", () => {
    mockCanContinue = true;
    renderShell({ continueLabel: "Approve & continue →" });
    expect(screen.getByRole("button", { name: /approve & continue →/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^continue →$/i })).not.toBeInTheDocument();
  });
});

// ── missingHint ────────────────────────────────────────────────────────────────

describe("WizardShell — missingHint prop", () => {
  it("does NOT show the hint when canContinue is true", () => {
    mockCanContinue = true;
    renderShell({ missingHint: "Please fill in all required fields" });
    expect(screen.queryByText("Please fill in all required fields")).not.toBeInTheDocument();
  });

  it("shows the hint when canContinue is false and missingHint is provided", () => {
    mockCanContinue = false;
    renderShell({ missingHint: "Please fill in all required fields" });
    expect(screen.getByText("Please fill in all required fields")).toBeInTheDocument();
  });

  it("does NOT show the hint when canContinue is false but missingHint is not provided", () => {
    mockCanContinue = false;
    renderShell();
    // No hint text at all — no paragraph with hint content
    expect(screen.queryByText(/please fill/i)).not.toBeInTheDocument();
  });
});

// ── footer ─────────────────────────────────────────────────────────────────────

describe("WizardShell — footer prop", () => {
  it("renders the default bottom bar when footer is not provided", () => {
    mockCanContinue = true;
    renderShell();
    // Continue button is part of the default bar
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("renders the footer content when footer prop is provided", () => {
    mockCanContinue = true;
    renderShell({ footer: <div data-testid="custom-footer">My custom footer</div> });
    expect(screen.getByTestId("custom-footer")).toBeInTheDocument();
    expect(screen.getByText("My custom footer")).toBeInTheDocument();
  });

  it("does NOT render the default bottom bar when footer is provided", () => {
    mockCanContinue = true;
    renderShell({ footer: <div data-testid="custom-footer">My custom footer</div> });
    // The default Continue button should not be present
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });
});
