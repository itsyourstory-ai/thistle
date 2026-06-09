/**
 * Per-step canContinue gating tests.
 *
 * Verifies that the Continue button is disabled until the step's required
 * inputs are filled, and enabled once they are. Uses steps that have no
 * asset imports or AI calls so they run reliably in jsdom.
 *
 * callEdge is mocked to prevent any accidental Supabase calls.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { WizardProvider } from "@/contexts/WizardContext";
import Step3Genre from "@/pages/steps/Step3Genre";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

// Mock supabase client so DevTestPanel (rendered via WizardHeader) doesn't
// attempt a real connection.
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

// ── Wrapper ───────────────────────────────────────────────────────────────────

function renderStep3() {
  return render(
    <MemoryRouter initialEntries={["/step/3-genre"]}>
      <WizardProvider>
        <Routes>
          <Route path="/step/:step" element={<Step3Genre />} />
        </Routes>
      </WizardProvider>
    </MemoryRouter>,
  );
}

// ── Step 3: Genre + Mood ──────────────────────────────────────────────────────

describe("Step3Genre — canContinue gating", () => {
  it("disables Continue when neither genre nor mood is selected", () => {
    renderStep3();
    const btn = screen.getByRole("button", { name: /continue/i });
    expect(btn).toBeDisabled();
  });

  it("keeps Continue disabled when only genre is selected", async () => {
    renderStep3();
    // "Bedtime" is unambiguous — no other tile description contains "bedtime"
    const bedtimeBtn = screen.getByRole("button", { name: /bedtime/i });
    await act(async () => { fireEvent.click(bedtimeBtn); });

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it("keeps Continue disabled when only mood is selected", async () => {
    renderStep3();
    const calmBtn = screen.getByRole("button", { name: /calm/i });
    await act(async () => { fireEvent.click(calmBtn); });

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it("enables Continue once both genre and mood are selected", async () => {
    renderStep3();

    const mysteryBtn = screen.getByRole("button", { name: /mystery/i });
    const calmBtn = screen.getByRole("button", { name: /calm/i });

    await act(async () => { fireEvent.click(mysteryBtn); });
    await act(async () => { fireEvent.click(calmBtn); });

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).not.toBeDisabled();
  });

  it("Continue stays disabled when genre is changed but mood not yet set", async () => {
    renderStep3();

    const bedtimeBtn = screen.getByRole("button", { name: /bedtime/i });
    await act(async () => { fireEvent.click(bedtimeBtn); });

    // Switch to a different genre — still no mood, still disabled
    const mysteryBtn = screen.getByRole("button", { name: /mystery/i });
    await act(async () => { fireEvent.click(mysteryBtn); });

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();

    // Now add a mood — should enable
    const heartBtn = screen.getByRole("button", { name: /heartwarming/i });
    await act(async () => { fireEvent.click(heartBtn); });
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });
});
