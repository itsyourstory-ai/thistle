import type { Session, User } from "@supabase/supabase-js";

export const DEV_BYPASS_USER_ID = "00000000-0000-0000-0000-000000000000";
export const DEV_BYPASS_EMAIL = "dev@local.test";

export function isDevAuthBypass(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === "1";
}

export function makeMockSession(): Session {
  const user = {
    id: DEV_BYPASS_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: DEV_BYPASS_EMAIL,
    app_metadata: { provider: "dev-bypass", providers: ["dev-bypass"] },
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  } as User;

  return {
    access_token: "dev-bypass",
    refresh_token: "dev-bypass",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  } as Session;
}
