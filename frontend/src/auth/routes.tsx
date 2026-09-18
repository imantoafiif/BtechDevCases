import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute() {
  const { session, logoutReason } = useAuth();
  if (session) return <Outlet />;
  const search =
    logoutReason && logoutReason !== "manual" ? `?reason=${logoutReason}` : "";
  return <Navigate to={`/login${search}`} replace />;
}

export function PublicOnlyRoute() {
  const { session } = useAuth();
  return session ? <Navigate to="/" replace /> : <Outlet />;
}
