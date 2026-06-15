import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Landing from "@/pages/Landing";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: null, loading: false }),
}));

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );
}

describe("Landing", () => {
  it("renders the Thistle Books wordmark", () => {
    renderLanding();
    expect(screen.getByText(/Thistle Books/i)).toBeInTheDocument();
  });

  it("renders the hero headline", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { name: /where your child is the hero/i })
    ).toBeInTheDocument();
  });

  it("has login links pointing to /login", () => {
    renderLanding();
    const links = screen.getAllByRole("link");
    const loginLinks = links.filter(
      (l) => l.getAttribute("href") === "/login"
    );
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the three feature card titles", () => {
    renderLanding();
    expect(screen.getByText("Tell us about them")).toBeInTheDocument();
    expect(screen.getByText("Pick the art style")).toBeInTheDocument();
    expect(screen.getByText("Get their book")).toBeInTheDocument();
  });
});
