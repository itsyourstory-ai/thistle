/**
 * AuthContext unit tests.
 *
 * Verifies the provider resolves the initial session, subscribes to auth
 * state changes (and cleans up), and that each auth action delegates to the
 * matching supabase.auth method. The supabase client is mocked so no network
 * calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import React from "react";

// ── Mock supabase client ───────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockSignOut = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => mockGetSession(...a),
      onAuthStateChange: (...a: unknown[]) => mockOnAuthStateChange(...a),
      signInWithPassword: (...a: unknown[]) => mockSignInWithPassword(...a),
      signUp: (...a: unknown[]) => mockSignUp(...a),
      signInWithOAuth: (...a: unknown[]) => mockSignInWithOAuth(...a),
      resetPasswordForEmail: (...a: unknown[]) => mockResetPasswordForEmail(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// ── Helpers ─────────────────────────────────────────────────────────────────────

type AuthApi = ReturnType<typeof useAuth>;

function makeAuthSpy() {
  let api: AuthApi | null = null;
  const Spy = () => {
    api = useAuth();
    return null;
  };
  const get = () => api!;
  return { Spy, get };
}

const FAKE_SESSION = { user: { id: "u1", email: "a@b.com" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
  mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
  mockSignUp.mockResolvedValue({ data: {}, error: null });
  mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  mockSignOut.mockResolvedValue({ error: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AuthContext — initialisation", () => {
  it("resolves the initial session on mount and clears loading", async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } });
    const { Spy, get } = makeAuthSpy();
    render(
      <AuthProvider>
        <Spy />
      </AuthProvider>,
    );

    expect(mockGetSession).toHaveBeenCalledOnce();
    await waitFor(() => expect(get().loading).toBe(false));
    expect(get().session).toEqual(FAKE_SESSION);
    expect(get().user).toEqual(FAKE_SESSION.user);
  });

  it("subscribes to auth state changes and unsubscribes on unmount", async () => {
    const { Spy } = makeAuthSpy();
    const { unmount } = render(
      <AuthProvider>
        <Spy />
      </AuthProvider>,
    );

    expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("updates session when onAuthStateChange fires", async () => {
    const { Spy, get } = makeAuthSpy();
    render(
      <AuthProvider>
        <Spy />
      </AuthProvider>,
    );
    await waitFor(() => expect(get().loading).toBe(false));

    const callback = mockOnAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: unknown,
    ) => void;
    act(() => callback("SIGNED_IN", FAKE_SESSION));

    expect(get().session).toEqual(FAKE_SESSION);
    expect(get().user).toEqual(FAKE_SESSION.user);
  });
});

describe("AuthContext — actions", () => {
  async function renderReady() {
    const { Spy, get } = makeAuthSpy();
    render(
      <AuthProvider>
        <Spy />
      </AuthProvider>,
    );
    await waitFor(() => expect(get().loading).toBe(false));
    return get;
  }

  it("signIn delegates to signInWithPassword", async () => {
    const get = await renderReady();
    await act(async () => {
      await get().signIn("a@b.com", "pw");
    });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pw",
    });
  });

  it("signUp delegates to signUp with an email redirect", async () => {
    const get = await renderReady();
    await act(async () => {
      await get().signUp("a@b.com", "pw");
    });
    expect(mockSignUp).toHaveBeenCalledOnce();
    const arg = mockSignUp.mock.calls[0][0];
    expect(arg.email).toBe("a@b.com");
    expect(arg.password).toBe("pw");
    expect(arg.options.emailRedirectTo).toContain("/dashboard");
  });

  it("signInWithGoogle delegates to signInWithOAuth with the google provider", async () => {
    const get = await renderReady();
    await act(async () => {
      await get().signInWithGoogle();
    });
    expect(mockSignInWithOAuth).toHaveBeenCalledOnce();
    expect(mockSignInWithOAuth.mock.calls[0][0].provider).toBe("google");
  });

  it("signInWithProvider forwards an arbitrary provider (Apple-ready)", async () => {
    const get = await renderReady();
    await act(async () => {
      await get().signInWithProvider("apple");
    });
    expect(mockSignInWithOAuth.mock.calls[0][0].provider).toBe("apple");
  });

  it("resetPassword delegates to resetPasswordForEmail", async () => {
    const get = await renderReady();
    await act(async () => {
      await get().resetPassword("a@b.com");
    });
    expect(mockResetPasswordForEmail).toHaveBeenCalledOnce();
    expect(mockResetPasswordForEmail.mock.calls[0][0]).toBe("a@b.com");
  });

  it("signOut delegates to supabase signOut", async () => {
    const get = await renderReady();
    await act(async () => {
      await get().signOut();
    });
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});

describe("useAuth — guard", () => {
  it("throws when used outside an AuthProvider", () => {
    const Boom = () => {
      useAuth();
      return null;
    };
    // Silence the expected React error log for the throwing render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Boom />)).toThrow(/useAuth must be used within/);
    spy.mockRestore();
  });
});
