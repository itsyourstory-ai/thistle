import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-6">
      <h2 className="font-heading text-xl font-semibold text-wizard mb-5">{title}</h2>
      {children}
    </div>
  );
}

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const isEmailUser = user?.app_metadata?.provider === "email";

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Error", description: error.message });
    } else {
      toast({ title: "Profile saved" });
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters." });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: "Error", description: error.message });
    } else {
      toast({ title: "Password updated" });
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleDeleteAccount() {
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) {
      toast({ title: "Error", description: "Failed to delete account. Please try again." });
      return;
    }
    await signOut();
    navigate("/login");
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-wizard-bg">
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-black/10 bg-wizard-bg">
        <Link to="/dashboard" className="text-sm font-medium text-wizard/70 hover:text-wizard transition-colors">
          ← Back
        </Link>
        <span className="font-heading font-semibold text-wizard">Account</span>
        <div className="w-16" />
      </header>

      <main className="max-w-xl mx-auto px-4 py-10 space-y-4">

        <Section title="Profile">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email ?? ""}
                readOnly
                disabled
                className="rounded-xl bg-muted/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display-name" className="text-sm font-medium text-muted-foreground">Display name</Label>
              <Input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="rounded-xl bg-white"
              />
            </div>
            <Button type="submit" variant="wizard" size="sm" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save"}
            </Button>
          </form>
        </Section>

        {isEmailUser && (
          <Section title="Password">
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm font-medium text-muted-foreground">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="rounded-xl bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-muted-foreground">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="rounded-xl bg-white"
                />
              </div>
              <Button type="submit" variant="wizard" size="sm" disabled={savingPassword}>
                {savingPassword ? "Saving…" : "Update password"}
              </Button>
            </form>
          </Section>
        )}

        <Section title="Sign out">
          <Button variant="wizardOutline" size="pill" onClick={handleSignOut} className="w-full">
            Sign out
          </Button>
        </Section>

        <div className="bg-white rounded-2xl border border-destructive/30 shadow-sm p-6">
          <h2 className="font-heading text-xl font-semibold text-destructive mb-2">Danger zone</h2>
          <p className="text-sm text-muted-foreground mb-5">Permanently delete your account and all your books and drafts.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">Delete account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and all your books and drafts. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>Delete account</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

      </main>
    </div>
  );
}
