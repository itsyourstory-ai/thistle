/**
 * Step10Preview — WizardShell migration + copy tests
 *
 * Key assertions:
 * 1. A Back button is rendered (this was the bug — step had no Back button)
 * 2. The old misleading heading ("book is ready") is gone
 * 3. The "after checkout" promise is present in the page
 * 4. The pay/checkout CTA is still rendered
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Stub WizardHeader — has supabase dependencies.
vi.mock("@/components/WizardHeader", () => ({
  default: () => <div data-testid="wizard-header" />,
}));

// Stub supabase to prevent import-time errors.
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

// Stub react-router-dom navigate so handlePay doesn't blow up.
vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// WizardContext mock — controllable per-test.
let mockAnswers: Record<string, unknown> = {};

vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({
    canContinue: true,
    setCanContinue: vi.fn(),
    answers: mockAnswers,
    setAnswer: vi.fn(),
    seedAnswers: vi.fn(),
    isGenerating: false,
    setIsGenerating: vi.fn(),
    draftId: null,
    setDraftId: vi.fn(),
    resetWizard: vi.fn(),
  }),
}));

// ── Import component after mocks ───────────────────────────────────────────────
import Step10Preview from "@/pages/steps/Step10Preview";

// ── Helper ─────────────────────────────────────────────────────────────────────

function renderStep(answers: Record<string, unknown> = {}) {
  mockAnswers = answers;
  return render(
    <MemoryRouter initialEntries={["/step/11-preview"]}>
      <Routes>
        <Route path="/step/:step" element={<Step10Preview />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAnswers = {};
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Step10Preview — Back button (bug fix)", () => {
  it("renders a Back button", () => {
    renderStep({ childName: "Ellie" });
    // The back button added by WizardShell or a custom footer
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });
});

describe("Step10Preview — honest copy", () => {
  it("does NOT say 'book is ready' in the heading", () => {
    renderStep({ childName: "Ellie" });
    // The old misleading heading must not appear
    const heading = screen.queryByRole("heading", { name: /book is ready/i });
    expect(heading).not.toBeInTheDocument();
  });

  it("includes an 'after checkout' promise somewhere on the page", () => {
    renderStep({ childName: "Ellie" });
    // The promise about reviewing/editing after checkout must be visible
    expect(screen.getByText(/after checkout/i)).toBeInTheDocument();
  });

  it("renders a heading for the child's name", () => {
    renderStep({ childName: "Ellie" });
    // Heading should mention the child or something about the story
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
  });
});

describe("Step10Preview — checkout CTA", () => {
  it("renders the Pay button", () => {
    renderStep({ childName: "Ellie" });
    // The checkout button must still exist
    expect(screen.getByRole("button", { name: /pay/i })).toBeInTheDocument();
  });

  it("renders name and email inputs", () => {
    renderStep({ childName: "Ellie" });
    expect(screen.getByPlaceholderText(/sarah johnson/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
  });
});
