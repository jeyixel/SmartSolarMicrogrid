import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import LoginPage from '../pages/auth/LoginPage';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

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

function UserDetailsPlaceholder() {
  const { nic } = useParams<{ nic: string }>();

  return <Placeholder title={`User details: ${nic ?? 'Unknown NIC'}`} />;
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

      <Route element={<ProtectedRoute requiredRole={0} />}>
        <Route
          path="/backoffice/dashboard"
          element={<Placeholder title="Backoffice dashboard" />}
        />
        <Route
          path="/backoffice/users"
          element={<Placeholder title="Users" />}
        />
        <Route
          path="/backoffice/users/create"
          element={<Placeholder title="Create user" />}
        />
        <Route
          path="/backoffice/users/pending"
          element={<Placeholder title="Pending users" />}
        />
        <Route
          path="/backoffice/users/deactivation-requests"
          element={<Placeholder title="Deactivation requests" />}
        />
        <Route
          path="/backoffice/users/:nic"
          element={<UserDetailsPlaceholder />}
        />
      </Route>

      <Route element={<ProtectedRoute requiredRole={1} />}>
        <Route
          path="/operator/dashboard"
          element={<Placeholder title="Grid Operator dashboard" />}
        />
      </Route>

      <Route path="*" element={<Placeholder title="Page not found" />} />
    </Routes>
  );
}
