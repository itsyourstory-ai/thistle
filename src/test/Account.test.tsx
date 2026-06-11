import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import Account from "@/pages/Account";

// ---- mocks ----

const mockSignOut = vi.fn().mockResolvedValue(undefined);
let mockUseAuth: () => Record<string, unknown>;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { display_name: "Test User" }, error: null }),
});

const mockUpdateUser = vi.fn().mockResolvedValue({ error: null });
const mockInvoke = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => mockFrom(),
    auth: { updateUser: (...args: unknown[]) => mockUpdateUser(...args) },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---- helpers ----

function makeEmailUser() {
  return {
    id: "user-123",
    email: "test@example.com",
    app_metadata: { provider: "email" },
  };
}

function makeGoogleUser() {
  return {
    id: "user-456",
    email: "google@example.com",
    app_metadata: { provider: "google" },
  };
}

function renderAccount() {
  return render(
    <MemoryRouter>
      <Account />
    </MemoryRouter>,
  );
}

// ---- tests ----

describe("Account page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { display_name: "Test User" }, error: null }),
    });
  });

  it("displays the user email", async () => {
    mockUseAuth = () => ({ user: makeEmailUser(), signOut: mockSignOut });
    renderAccount();
    expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
  });

  it("does NOT render password section for OAuth users", async () => {
    mockUseAuth = () => ({ user: makeGoogleUser(), signOut: mockSignOut });
    renderAccount();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm new password/i)).not.toBeInTheDocument();
  });

  it("renders password section for email users", async () => {
    mockUseAuth = () => ({ user: makeEmailUser(), signOut: mockSignOut });
    renderAccount();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("delete account button opens the AlertDialog", async () => {
    mockUseAuth = () => ({ user: makeEmailUser(), signOut: mockSignOut });
    renderAccount();

    const deleteBtn = screen.getByRole("button", { name: /delete account/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByText("This will permanently delete your account and all your books and drafts. This cannot be undone.")).toBeInTheDocument();
    });
  });

  it("sign-out button calls signOut and navigates to /login", async () => {
    mockUseAuth = () => ({ user: makeEmailUser(), signOut: mockSignOut });
    renderAccount();

    const signOutBtn = screen.getByRole("button", { name: /sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
