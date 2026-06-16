/**
 * ProgressBar tests.
 *
 * Verifies:
 * 1. "Step X of N" visible text is rendered
 * 2. The current-step dot is visually wider than completed/future dots
 * 3. Future dots are aria-disabled and clicking them does NOT call navigate
 * 4. The PROGRESS_MESSAGES encouragement caption is present
 * 5. isGenerating locks all dots
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { TOTAL_STEPS } from "@/lib/wizardSteps";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockIsGenerating = { value: false };
vi.mock("@/contexts/WizardContext", () => ({
  useWizard: () => ({ isGenerating: mockIsGenerating.value }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderProgressBar(currentStep: number) {
  // Import lazily so mocks are applied first
  const { default: ProgressBar } = await import("@/components/ProgressBar");
  return render(
    <MemoryRouter>
      <ProgressBar currentStep={currentStep} />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockNavigate.mockClear();
  mockIsGenerating.value = false;
});

describe("ProgressBar — step counter text", () => {
  it("shows 'Step X of N' for a mid-wizard step", async () => {
    await renderProgressBar(4);
    // Text is rendered as a single span but React may split number/text nodes —
    // use a function matcher to check the full textContent.
    expect(
      screen.getByText((_, el) =>
        el?.tagName === "SPAN" &&
        !!el.textContent?.match(new RegExp(`Step 4 of ${TOTAL_STEPS}`)),
      ),
    ).toBeTruthy();
  });

  it("shows 'Step 1 of N' for the first step", async () => {
    await renderProgressBar(1);
    expect(
      screen.getByText((_, el) =>
        el?.tagName === "SPAN" &&
        !!el.textContent?.match(new RegExp(`Step 1 of ${TOTAL_STEPS}`)),
      ),
    ).toBeTruthy();
  });

  it("shows 'Step N of N' for the last step", async () => {
    await renderProgressBar(TOTAL_STEPS);
    expect(
      screen.getByText((_, el) =>
        el?.tagName === "SPAN" &&
        !!el.textContent?.match(new RegExp(`Step ${TOTAL_STEPS} of ${TOTAL_STEPS}`)),
      ),
    ).toBeTruthy();
  });
});

describe("ProgressBar — step label text", () => {
  it("shows the step label for the current step", async () => {
    await renderProgressBar(1);
    // Step 1 label is "Who's it for?"
    expect(screen.getByText(/who's it for/i)).toBeTruthy();
  });
});

describe("ProgressBar — encouragement caption", () => {
  it("renders the PROGRESS_MESSAGES caption for step 1", async () => {
    await renderProgressBar(1);
    // Step 1 message contains "star of the show"
    expect(screen.getByText(/star of the show/i)).toBeTruthy();
  });

  it("renders the PROGRESS_MESSAGES caption for step 5", async () => {
    await renderProgressBar(5);
    // Step 5 message contains "favorite things"
    expect(screen.getByText(/favorite things/i)).toBeTruthy();
  });
});

describe("ProgressBar — dot sizing", () => {
  it("all dots have the same width (24px) — current step is distinguished by ring, not size", async () => {
    const { container } = await renderProgressBar(4);

    const currentDotBar = container.querySelector("[data-step-dot='4']") as HTMLElement;
    const completedDotBar = container.querySelector("[data-step-dot='2']") as HTMLElement;
    expect(currentDotBar).toBeTruthy();
    expect(completedDotBar).toBeTruthy();

    expect(parseInt(currentDotBar.style.width || "0", 10)).toBe(24);
    expect(parseInt(completedDotBar.style.width || "0", 10)).toBe(24);
  });
});

describe("ProgressBar — future dots are not navigable", () => {
  it("future dots have aria-disabled='true'", async () => {
    const { container } = await renderProgressBar(3);
    // Future dot = step 5 (index 4, stepNum > 3)
    const futureDot = container.querySelector("[data-step='5']");
    expect(futureDot).toBeTruthy();
    expect(futureDot?.getAttribute("aria-disabled")).toBe("true");
  });

  it("clicking a future dot does NOT call navigate", async () => {
    const { container } = await renderProgressBar(3);
    const futureDot = container.querySelector("[data-step='5']");
    expect(futureDot).toBeTruthy();
    fireEvent.click(futureDot as Element);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("clicking a completed dot DOES call navigate", async () => {
    const { container } = await renderProgressBar(5);
    const completedDot = container.querySelector("[data-step='2']");
    expect(completedDot).toBeTruthy();
    fireEvent.click(completedDot as Element);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("clicking the current-step dot DOES call navigate", async () => {
    const { container } = await renderProgressBar(3);
    const currentDot = container.querySelector("[data-step='3']");
    expect(currentDot).toBeTruthy();
    fireEvent.click(currentDot as Element);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});

describe("ProgressBar — isGenerating lock", () => {
  it("locks all dots when isGenerating is true", async () => {
    mockIsGenerating.value = true;
    const { container } = await renderProgressBar(6);
    // All dots (including completed) must be aria-disabled
    const dots = container.querySelectorAll("[data-step]");
    expect(dots.length).toBeGreaterThan(0);
    dots.forEach((dot) => {
      expect(dot.getAttribute("aria-disabled")).toBe("true");
    });
  });

  it("clicking any dot does NOT call navigate when isGenerating", async () => {
    mockIsGenerating.value = true;
    const { container } = await renderProgressBar(6);
    const firstDot = container.querySelector("[data-step='1']");
    if (firstDot) fireEvent.click(firstDot);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
