import { describe, it, expect, vi, afterEach } from "vitest";
import { isDevAuthBypass, makeMockSession, DEV_BYPASS_USER_ID, DEV_BYPASS_EMAIL } from "@/lib/devAuthBypass";

describe("isDevAuthBypass", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when flag is unset", () => {
    vi.stubEnv("VITE_DEV_AUTH_BYPASS", "");
    expect(isDevAuthBypass()).toBe(false);
  });

  it("returns false when flag is not the string 1", () => {
    vi.stubEnv("VITE_DEV_AUTH_BYPASS", "true");
    expect(isDevAuthBypass()).toBe(false);
  });

  it("returns true in dev env when flag is 1", () => {
    vi.stubEnv("VITE_DEV_AUTH_BYPASS", "1");
    expect(isDevAuthBypass()).toBe(true);
  });
});

describe("makeMockSession", () => {
  it("returns session with fixed dev user ID and email", () => {
    const session = makeMockSession();
    expect(session.user.id).toBe(DEV_BYPASS_USER_ID);
    expect(session.user.email).toBe(DEV_BYPASS_EMAIL);
  });

  it("has a truthy access_token satisfying ProtectedRoute", () => {
    const session = makeMockSession();
    expect(session.access_token).toBeTruthy();
  });

  it("has string user.id readable by useDraftPersistence", () => {
    const session = makeMockSession();
    expect(typeof session.user.id).toBe("string");
    expect(session.user.id).toBe("00000000-0000-0000-0000-000000000000");
  });
});
