import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import DraftCard from "@/components/DraftCard";

function renderDraftCard(overrides: Partial<Parameters<typeof DraftCard>[0]> = {}) {
  const defaults = {
    id: "draft-1",
    childName: "Mia",
    currentStep: "/step/3-genre",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    onResume: vi.fn(),
    onDelete: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return {
    ...render(
      <MemoryRouter>
        <DraftCard {...props} />
      </MemoryRouter>,
    ),
    props,
  };
}

describe("DraftCard", () => {
  it("renders the child name", () => {
    renderDraftCard({ childName: "Oliver" });
    expect(screen.getByText("Oliver")).toBeInTheDocument();
  });

  it("renders the step label derived from currentStep", () => {
    renderDraftCard({ currentStep: "/step/3-genre" });
    expect(screen.getByText("Step 3 of 11")).toBeInTheDocument();
  });

  it("renders step label for a different step", () => {
    renderDraftCard({ currentStep: "/step/7-character" });
    expect(screen.getByText("Step 7 of 11")).toBeInTheDocument();
  });

  it("calls onResume when the Resume button is clicked", () => {
    const onResume = vi.fn();
    renderDraftCard({ onResume });
    fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("calls onDelete when the delete button is clicked", () => {
    const onDelete = vi.fn();
    renderDraftCard({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: /delete draft/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
