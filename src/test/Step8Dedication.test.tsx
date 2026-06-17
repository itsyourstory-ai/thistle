/**
 * Step8Dedication — unit tests
 *
 * Covers:
 * 1. Default dedication includes the child's name
 * 2. Textarea is pre-filled with the default when dedicationText is unset
 * 3. Editing the textarea updates the context
 * 4. canContinue is true when there is text (default seeds it)
 * 5. missingHint appears when the field is cleared
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { WizardProvider, useWizard } from "@/contexts/WizardContext";
import Step8Dedication from "@/pages/steps/Step8Dedication";

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
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

type WizardApi = ReturnType<typeof useWizard>;

function makeContextSpy() {
  let api: WizardApi | null = null;
  const Spy = () => {
    api = useWizard();
    return null;
  };
  return { Spy, get: () => api! };
}

function renderStep8(initialAnswers?: Partial<Parameters<typeof useWizard>[0]>) {
  const { Spy, get } = makeContextSpy();
  render(
    <MemoryRouter initialEntries={["/step/8-dedication"]}>
      <WizardProvider>
        <Spy />
        <Routes>
          <Route path="/step/:step" element={<Step8Dedication />} />
        </Routes>
      </WizardProvider>
    </MemoryRouter>,
  );
  // Seed initial answers if provided
  if (initialAnswers) {
    act(() => {
      get().seedAnswers(initialAnswers as Parameters<typeof get>[0]);
    });
  }
  return { getApi: get };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Step8Dedication — default dedication", () => {
  it("pre-fills the textarea with a default including 'you' when no child name is set", async () => {
    renderStep8();
    const textarea = await screen.findByRole("textbox");
    expect(textarea).toHaveValue("For you, with all our love.");
  });

  it("shows child's name in the placeholder when childName is updated in context", async () => {
    const { getApi } = renderStep8();
    await act(async () => {
      getApi().seedAnswers({ childName: "Amara" });
    });
    // The placeholder always reflects the current default computation even
    // after the textarea value has been seeded on mount.
    const textarea = await screen.findByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", "For Amara, with all our love.");
  });
});

describe("Step8Dedication — editing", () => {
  it("updates dedicationText in context when the user types", async () => {
    const { getApi } = renderStep8();
    const textarea = await screen.findByRole("textbox");

    await act(async () => {
      fireEvent.change(textarea, { target: { value: "For my little star." } });
    });

    expect(getApi().answers.dedicationText).toBe("For my little star.");
  });
});

describe("Step8Dedication — missingHint", () => {
  it("shows missingHint when the textarea is cleared", async () => {
    renderStep8();
    const textarea = await screen.findByRole("textbox");

    await act(async () => {
      fireEvent.change(textarea, { target: { value: "" } });
    });

    expect(screen.getByText(/write a dedication to continue/i)).toBeInTheDocument();
  });

  it("hides missingHint when the textarea has content", async () => {
    renderStep8();
    // Default text is seeded on mount — hint should not appear
    await waitFor(() => {
      expect(screen.queryByText(/write a dedication to continue/i)).not.toBeInTheDocument();
    });
  });
});
