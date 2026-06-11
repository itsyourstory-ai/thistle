import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoadingScreen from "@/components/LoadingScreen";

/**
 * Gates a route behind a signed-in session. While the initial session is
 * resolving we render the branded loader so a cold load doesn't flash the
 * login page at an already-authenticated user.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen messages={["Loading…"]} />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
