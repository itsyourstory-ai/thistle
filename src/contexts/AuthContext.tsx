import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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

interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** True until the initial getSession() resolves — guards against bouncing
   *  an authenticated user to /login on a cold load. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<ActionResult>;
  signUp: (email: string, password: string) => Promise<ActionResult>;
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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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
    (email: string, password: string) =>
      supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo() },
      }),
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
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      }),
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signInWithProvider,
        signInWithGoogle,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
