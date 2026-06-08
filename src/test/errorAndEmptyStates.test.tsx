import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FullScreenMessage from "@/components/FullScreenMessage";
import EmptyState from "@/components/EmptyState";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/NotFound";

describe("FullScreenMessage", () => {
  it("renders the title, description, and action", () => {
    render(
      <FullScreenMessage
        emoji="🧭"
        title="Page not found"
        description="It's gone."
        action={<button>Go home</button>}
      />
    );
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("It's gone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders the title and optional action", () => {
    render(
      <EmptyState
        emoji="📚"
        title="No characters yet"
        action={<button>Add one</button>}
      />
    );
    expect(screen.getByRole("heading", { name: "No characters yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add one" })).toBeInTheDocument();
  });

  it("omits the description when not provided", () => {
    render(<EmptyState emoji="📚" title="Empty" />);
    expect(screen.getByRole("heading", { name: "Empty" })).toBeInTheDocument();
  });
});

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress React's expected error logging for the thrown-child test.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const Boom = () => {
    throw new Error("kaboom");
  };

  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>all good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows the fallback when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(
      screen.getByRole("heading", { name: "Something went wrong" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  });
});

describe("NotFound", () => {
  it("renders the branded 404 with a link home", () => {
    render(
      <MemoryRouter initialEntries={["/nope"]}>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to start" })).toHaveAttribute("href", "/");
  });
});
