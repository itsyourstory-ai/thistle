import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardHeader() {
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-black/10 w-full bg-wizard-bg">
      <span className="text-xl font-semibold tracking-tight">Thistle</span>

      <div className="flex items-center gap-3">
        <Link
          to="/account"
          className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
        >
          Account
        </Link>
        <Button variant="wizardGhost" size="sm" className="rounded-xl font-medium" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
