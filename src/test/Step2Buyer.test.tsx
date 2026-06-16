/**
 * Step2Buyer — polish fixes
 *
 * 1. Relationship and occasion tiles must use distinct emojis (no duplicate ✨).
 * 2. Relationship tiles must carry a min-height class so "Someone else" doesn't
 *    stretch its row on narrow viewports.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { WizardProvider } from "@/contexts/WizardContext";
import Step2Buyer from "@/pages/steps/Step2Buyer";

// ── Mocks ────────────────────────────────────────────────────────────────────

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

// ── Render helper ─────────────────────────────────────────────────────────────

function renderStep2() {
  return render(
    <MemoryRouter initialEntries={["/step/2-buyer"]}>
      <WizardProvider>
        <Routes>
          <Route path="/step/:step" element={<Step2Buyer />} />
        </Routes>
      </WizardProvider>
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Step2Buyer — emoji de-duplication", () => {
  it("does not use the same emoji for both relationship and occasion tiles", () => {
    renderStep2();

    // Collect all tile buttons (role=button, not the Continue button).
    // We look for all emoji characters rendered in the tile emoji divs.
    // Strategy: get the full text of all tile buttons and check for repeated
    // emoji by comparing relationship-section emojis vs occasion-section emojis.

    // The headings distinguish the two sections.
    const relationshipSection = screen.getByText(/what is your relationship/i)
      .closest("section")!;
    const occasionSection = screen.getByText(/what's the occasion/i)
      .closest("section")!;

    // Extract the text content of all tiles in each section.
    const relButtons = Array.from(
      relationshipSection.querySelectorAll("button"),
    ).map((b) => b.textContent ?? "");

    const occButtons = Array.from(
      occasionSection.querySelectorAll("button"),
    ).map((b) => b.textContent ?? "");

    // Build sets of emojis found in each group.
    // We isolate the emoji by stripping ASCII/Latin chars and whitespace.
    const extractEmojis = (texts: string[]) =>
      texts.map((t) => t.replace(/[ -~\s]/g, "").trim()).filter(Boolean);

    const relEmojis = extractEmojis(relButtons);
    const occEmojis = extractEmojis(occButtons);

    // Check that no emoji appears in BOTH sets.
    const relSet = new Set(relEmojis);
    const overlap = occEmojis.filter((e) => relSet.has(e));

    expect(overlap).toHaveLength(0);
  });
});

describe("Step2Buyer — relationship tile min-height", () => {
  it("relationship tiles include a min-h Tailwind class for consistent row height", () => {
    renderStep2();

    const relationshipSection = screen.getByText(/what is your relationship/i)
      .closest("section")!;

    const relButtons = Array.from(
      relationshipSection.querySelectorAll("button"),
    );

    expect(relButtons.length).toBeGreaterThan(0);

    // Every relationship tile should carry a min-h-* class.
    relButtons.forEach((btn) => {
      expect(btn.className).toMatch(/min-h-/);
    });
  });

  it("renders the 'Someone else' relationship tile", () => {
    renderStep2();
    expect(screen.getByRole("button", { name: /someone else/i })).toBeInTheDocument();
  });
});
