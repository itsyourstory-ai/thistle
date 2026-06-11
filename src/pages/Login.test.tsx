/**
 * Login page tests.
 *
 * useAuth is mocked so we can verify the page delegates to the right actions
 * without touching Supabase. Navigation is exercised with MemoryRouter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithGoogle = vi.fn();
const mockResetPassword = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    signInWithGoogle: mockSignInWithGoogle,
    resetPassword: mockResetPassword,
    session: null,
    loading: false,
  }),
}));

// Capture toast calls without rendering the Sonner component.
const mockToastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => mockToastError(...a) } }));

import Login from "@/pages/Login";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Login />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSignIn.mockResolvedValue({ error: null });
  mockSignUp.mockResolvedValue({ error: null });
  mockSignInWithGoogle.mockResolvedValue({ error: null });
  mockResetPassword.mockResolvedValue({ error: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Login — sign-in mode", () => {
  it("calls signIn with email and password on submit", async () => {
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith("a@b.com", "secret"));
  });

  it("does not submit with empty fields", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(mockSignIn).not.toHaveBeenCalled());
  });

  it("surfaces an error toast when signIn returns an error", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Invalid credentials"));
  });
});

describe("Login — sign-up mode", () => {
  it("calls signUp after switching to signup mode", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "new@b.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "newpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalledWith("new@b.com", "newpass"));
  });
});

describe("Login — Google OAuth", () => {
  it("calls signInWithGoogle when the Google button is clicked", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledOnce());
  });
});

describe("Login — forgot password", () => {
  it("calls resetPassword with the entered email", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "reset@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset email/i }));
    await waitFor(() =>
      expect(mockResetPassword).toHaveBeenCalledWith("reset@b.com"),
    );
  });
});

describe("Login — no dev bypass", () => {
  it("does not render a skip/dev-bypass button", () => {
    renderLogin();
    expect(screen.queryByText(/skip login/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dev preview/i)).not.toBeInTheDocument();
  });
});
