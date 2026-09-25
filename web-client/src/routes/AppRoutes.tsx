import { Link, Navigate, Route, Routes, useNavigate } from 'react-router';
import LoginPage from '../pages/auth/LoginPage';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import BackofficeLayout from '../components/layout/BackofficeLayout';
import BackofficeDashboardPage from '../pages/backoffice/BackofficeDashboardPage';
import UserListPage from '../pages/backoffice/UserListPage';
import CreateStaffUserPage from '../pages/backoffice/CreateStaffUserPage';
import PendingRegistrationsPage from '../pages/backoffice/PendingRegistrationsPage';
import DeactivationRequestsPage from '../pages/backoffice/DeactivationRequestsPage';
import UserDetailsPage from '../pages/backoffice/UserDetailsPage';

function Placeholder({ title }: { title: string }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        {isAuthenticated && (
          <button
            type="button"
            onClick={handleLogout}
            className="rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
          >
            Logout
          </button>
        )}
      </div>
      {user && (
        <p className="mt-2 text-sm text-slate-600">
          Signed in as <strong>{user.fullName}</strong> ({user.nic})
        </p>
      )}
      <p className="mt-3">Page setup complete. Features will be added next.</p>
      {!isAuthenticated && (
        <Link className="mt-4 inline-block underline" to="/login">
          Go to login
        </Link>
      )}
    </main>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/unauthorized"
        element={<Placeholder title="Unauthorized" />}
      />

      {/* Backoffice Protected Routes */}
      <Route element={<ProtectedRoute requiredRole={0} />}>
        <Route element={<BackofficeLayout />}>
          <Route path="/backoffice/dashboard" element={<BackofficeDashboardPage />} />
          <Route path="/backoffice/users" element={<UserListPage />} />
          <Route path="/backoffice/users/create" element={<CreateStaffUserPage />} />
          <Route path="/backoffice/users/pending" element={<PendingRegistrationsPage />} />
          <Route path="/backoffice/users/deactivation-requests" element={<DeactivationRequestsPage />} />
          <Route path="/backoffice/users/:nic" element={<UserDetailsPage />} />
        </Route>
      </Route>

      {/* Grid Operator Protected Routes */}
      <Route element={<ProtectedRoute requiredRole={1} />}>
        <Route
          path="/operator/dashboard"
          element={<Placeholder title="Grid Operator dashboard" />}
        />
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<Placeholder title="Page not found" />} />
    </Routes>
  );
}
