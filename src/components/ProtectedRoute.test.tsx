/**
 * ProtectedRoute + RootRedirect tests.
 *
 * useAuth is mocked so we can drive the three states (loading / signed-in /
 * signed-out) directly. Routing is exercised with MemoryRouter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import ProtectedRoute from "@/components/ProtectedRoute";
import RootRedirect from "@/components/RootRedirect";

beforeEach(() => vi.clearAllMocks());

vi.mock("@/pages/Landing", () => ({
  default: () => <div>LANDING PAGE</div>,
}));

function renderAt(path: string, ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route path="/dashboard" element={<div>DASHBOARD PAGE</div>} />
        <Route path="/protected" element={ui} />
        <Route path="/" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("shows a loading state while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true });
    renderAt(
      "/protected",
      <ProtectedRoute>
        <div>SECRET</div>
      </ProtectedRoute>,
    );
    expect(screen.queryByText("SECRET")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders children when a session exists", () => {
    mockUseAuth.mockReturnValue({ session: { user: {} }, loading: false });
    renderAt(
      "/protected",
      <ProtectedRoute>
        <div>SECRET</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText("SECRET")).toBeInTheDocument();
  });

  it("redirects to /login when signed out", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false });
    renderAt(
      "/protected",
      <ProtectedRoute>
        <div>SECRET</div>
      </ProtectedRoute>,
    );
    expect(screen.queryByText("SECRET")).not.toBeInTheDocument();
    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
  });

  it("redirects /dev/story-preview/:id to /login when signed out", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/dev/story-preview/abc-123"]}>
        <Routes>
          <Route path="/login" element={<div>LOGIN PAGE</div>} />
          <Route
            path="/dev/story-preview/:id"
            element={
              <ProtectedRoute>
                <div>DEV PREVIEW</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText("DEV PREVIEW")).not.toBeInTheDocument();
    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
  });
});

describe("RootRedirect", () => {
  it("shows a loading state while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true });
    renderAt("/", <RootRedirect />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("sends signed-in users to /dashboard", () => {
    mockUseAuth.mockReturnValue({ session: { user: {} }, loading: false });
    renderAt("/", <RootRedirect />);
    expect(screen.getByText("DASHBOARD PAGE")).toBeInTheDocument();
  });

  it("renders the landing page for signed-out users", () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false });
    renderAt("/", <RootRedirect />);
    expect(screen.getByText("LANDING PAGE")).toBeInTheDocument();
  });
});
