import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  requiredRole?: 0 | 1;
  requiredRoles?: Array<0 | 1 | 2>;
};

export default function ProtectedRoute({ requiredRole, requiredRoles }: Props) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <p>Checking your session...</p>;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const allowedRoles =
    requiredRoles ?? (requiredRole !== undefined ? [requiredRole] : undefined);

  if (user.status !== 1 || (allowedRoles && !allowedRoles.includes(user.role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
