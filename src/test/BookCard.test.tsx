import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import BookCard from "@/components/BookCard";

function renderBookCard(overrides: Partial<Parameters<typeof BookCard>[0]> = {}) {
  const defaults = {
    id: "book-abc-123",
    title: "The Brave Little Bunny",
    childName: "Mia",
    createdAt: "2026-06-11T12:00:00.000Z",
  };
  const props = { ...defaults, ...overrides };
  return render(
    <MemoryRouter>
      <BookCard {...props} />
    </MemoryRouter>,
  );
}

describe("BookCard", () => {
  it("renders the book title", () => {
    renderBookCard({ title: "The Dragon Who Lost Her Roar" });
    expect(screen.getByText("The Dragon Who Lost Her Roar")).toBeInTheDocument();
  });

  it("renders the child name", () => {
    renderBookCard({ childName: "Lena" });
    expect(screen.getByText("Lena")).toBeInTheDocument();
  });

  it("View link points to the correct story-preview URL", () => {
    renderBookCard({ id: "book-abc-123" });
    const link = screen.getByRole("link", { name: /view/i });
    expect(link).toHaveAttribute("href", "/dev/story-preview/book-abc-123");
  });
});
