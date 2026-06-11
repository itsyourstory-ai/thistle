import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";

/**
 * Landing route ("/"). Resolves the session, then sends signed-in users to
 * their dashboard and everyone else to login.
 */
export default function RootRedirect() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen messages={["Loading…"]} />;
  return <Navigate to={session ? "/dashboard" : "/login"} replace />;
}
