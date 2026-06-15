import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";
import Landing from "@/pages/Landing";

/**
 * Landing route ("/"). Resolves the session, then sends signed-in users to
 * their dashboard and shows the landing page to everyone else.
 */
export default function RootRedirect() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen messages={["Loading…"]} />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}
