import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Session, User, AuthError, Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the signed-in user. Mirrors the WizardContext
 * pattern. Resolves the initial session on mount, then stays in sync with
 * supabase.auth via onAuthStateChange.
 */

type ActionResult = { error: AuthError | null };
type SignUpResult = { error: AuthError | null; session: Session | null };

interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** True until the initial getSession() resolves — guards against bouncing
   *  an authenticated user to /login on a cold load. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<ActionResult>;
  /** Returns session when email confirmation is disabled (user is logged in
   *  immediately); returns null session when confirmation is required. */
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  /** Generic OAuth entry point. Google today; Apple is a drop-in later. */
  signInWithProvider: (provider: Provider) => Promise<ActionResult>;
  signInWithGoogle: () => Promise<ActionResult>;
  resetPassword: (email: string) => Promise<ActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Where Supabase should send the browser back to after email confirmation or
// an OAuth round-trip. Must be in the Supabase redirect allow-list.
const redirectTo = () => `${window.location.origin}/dashboard`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      // After clicking a password-reset email link, Supabase fires
      // PASSWORD_RECOVERY and sets a short-lived session. Redirect to /account
      // where the password change form lives. Guard against loops if already there.
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/account") {
        window.location.replace("/account");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo() },
      });
      return { error, session: data.session };
    },
    [],
  );

  const signInWithProvider = useCallback(
    (provider: Provider) =>
      supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo() },
      }),
    [],
  );

  const signInWithGoogle = useCallback(
    () => signInWithProvider("google"),
    [signInWithProvider],
  );

  const resetPassword = useCallback(
    (email: string) =>
      // Redirects to /account where the password-change form lives.
      // /account must be in the Supabase URL allow-list for redirects.
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/account`,
      }),
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signInWithProvider,
      signInWithGoogle,
      resetPassword,
      signOut,
    }),
    [session, loading, signIn, signUp, signInWithProvider, signInWithGoogle, resetPassword, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
