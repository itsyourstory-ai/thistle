/**
 * Step5Interests tests.
 *
 * Covers:
 * - Custom-typed interest gets a default ✨ emoji when no emoji is provided
 * - Non-binary gender produces boosted suggestions (more than just the base list)
 * - Copyright warning note is rendered
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { WizardProvider, useWizard } from "@/contexts/WizardContext";
import Step5Interests from "@/pages/steps/Step5Interests";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/edgeFunctions", () => ({
  callEdge: vi.fn().mockResolvedValue({ data: {}, error: null }),
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

function renderStep5() {
  const { Spy, get } = makeContextSpy();
  render(
    <MemoryRouter initialEntries={["/step/5-interests"]}>
      <WizardProvider>
        <Spy />
        <Routes>
          <Route path="/step/:step" element={<Step5Interests />} />
        </Routes>
      </WizardProvider>
    </MemoryRouter>,
  );
  return { getApi: get };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Step5Interests — copyright warning", () => {
  it("renders the copyright warning note", () => {
    renderStep5();
    expect(
      screen.getByText(/Please don't reference copyrighted material/i),
    ).toBeInTheDocument();
  });
});

describe("Step5Interests — custom-typed pill emoji", () => {
  it("stores ✨ emoji for an empty-slot entry when no emoji is provided", async () => {
    const { getApi } = renderStep5();

    // Click the "Add interest" button to create an empty slot
    const addBtn = screen.getByRole("button", { name: /add interest/i });
    await act(async () => { fireEvent.click(addBtn); });

    // Type a custom word into the newly created input (placeholder "type here")
    const input = screen.getByPlaceholderText(/type here/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "karate" } });
    });

    // The entry should be stored with the ✨ default emoji
    const list = getApi().answers.interestsList as Array<{ word: string; emoji?: string }>;
    const entry = list.find((e) => e.word === "karate");
    expect(entry).toBeDefined();
    expect(entry?.emoji).toBe("✨");
  });
});

describe("Step5Interests — suggestion chips from pool", () => {
  it("clicking a suggestion chip adds it with the pool emoji", async () => {
    const { getApi } = renderStep5();

    // The "Click to add:" section contains suggestion chip buttons.
    // Find the "Click to add:" heading, then find the first chip button after it.
    const heading = screen.getByText(/click to add/i);
    // The suggestion chips are siblings in the next div. Grab the first chip.
    const chipsContainer = heading.parentElement!;
    const chipButtons = chipsContainer.querySelectorAll("button");
    expect(chipButtons.length).toBeGreaterThan(0);

    const firstChip = chipButtons[0];
    await act(async () => { fireEvent.click(firstChip); });

    const list = getApi().answers.interestsList as Array<{ word: string; emoji?: string }>;
    expect(list).toBeDefined();
    expect(list.length).toBe(1);
    // Pool chips carry their own emoji, which should not be the default ✨
    expect(list[0].emoji).not.toBe("✨");
  });
});

describe("Step5Interests — non-binary suggestion boosts", () => {
  it("shows suggestion chips when gender is non-binary", async () => {
    const { getApi } = renderStep5();

    await act(async () => {
      getApi().seedAnswers({ ageRange: "3-5", gender: "non-binary" });
    });

    // Non-binary boosts exist so the pool is non-empty; "Click to add:" heading appears
    expect(screen.getByText(/click to add/i)).toBeInTheDocument();
  });

  it("non-binary pool shows the maximum 10 visible chips (boosted pool > 10 items)", async () => {
    const { getApi } = renderStep5();

    await act(async () => {
      getApi().seedAnswers({ ageRange: "3-5", gender: "non-binary" });
    });

    // Find chip buttons inside the "Click to add" section
    const heading = screen.getByText(/click to add/i);
    const chipsContainer = heading.parentElement!;
    const chipButtons = chipsContainer.querySelectorAll("button");

    // With non-binary boosts added to the base list, pool should exceed 10 items,
    // so all 10 visible slots are filled.
    expect(chipButtons.length).toBe(10);
  });
});
