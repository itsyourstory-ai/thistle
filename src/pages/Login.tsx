import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Mode = "signin" | "signup" | "forgot";

export default function Login() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || (mode !== "forgot" && !password.trim())) return;
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await resetPassword(email.trim());
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        setResetSent(true);
      }
      return;
    }

    const { error } =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

    setLoading(false);
    if (error) toast.error(error.message);
    else navigate("/step/1-name");
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    // OAuth redirects the tab — only surface an error if the redirect itself fails.
    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8"
      style={{ backgroundColor: "hsl(var(--wizard-bg))" }}
    >
      <div className="w-full max-w-[420px] space-y-8">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="text-4xl">📖✨</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-wizard">
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? "Create your account"
                : "Reset your password"}
          </h1>
          <p className="text-muted-foreground">
            {mode === "signin"
              ? "Sign in to start crafting your story."
              : mode === "signup"
                ? "Sign up to begin your child's adventure."
                : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        <Card className="rounded-3xl shadow-sm p-6 sm:p-8 space-y-5">
          {/* Google — only on sign-in / sign-up */}
          {mode !== "forgot" && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-border bg-white hover:bg-black/[0.02] transition-all font-medium disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          {/* Email form */}
          {resetSent ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Check your inbox — we sent a reset link to <strong>{email}</strong>.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 rounded-2xl border-border bg-white"
                />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-muted-foreground">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 rounded-2xl border-border bg-white"
                  />
                </div>
              )}

              <Button
                type="submit"
                variant="wizard"
                size="pill"
                disabled={loading}
                className="w-full mt-2 disabled:opacity-60"
              >
                {loading
                  ? "Just a moment…"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send reset email"}
              </Button>

              {mode === "signin" && (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="wizardGhost"
                    size="sm"
                    onClick={() => setMode("forgot")}
                    className="font-medium text-xs p-0 h-auto text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </Button>
                </div>
              )}
            </form>
          )}

          {/* Mode toggle */}
          {mode !== "forgot" && (
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <Button
                type="button"
                variant="wizardGhost"
                size="sm"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="font-semibold underline-offset-2 hover:underline p-0 h-auto"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </Button>
            </p>
          )}

          {mode === "forgot" && !resetSent && (
            <p className="text-center text-sm text-muted-foreground">
              <Button
                type="button"
                variant="wizardGhost"
                size="sm"
                onClick={() => setMode("signin")}
                className="font-medium p-0 h-auto"
              >
                ← Back to sign in
              </Button>
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
