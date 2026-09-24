import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Enter your email or NIC and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await login(identifier.trim(), password);

      if (user.role === 0) {
        navigate('/backoffice/dashboard', { replace: true });
      } else if (user.role === 1) {
        navigate('/operator/dashboard', { replace: true });
      } else {
        setError('Prosumer accounts use the mobile application.');
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Login failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-xl bg-white p-8 shadow"
      >
        <div>
          <h1 className="text-2xl font-bold">Smart Solar Microgrid</h1>
          <p className="mt-1 text-slate-600">Sign in to your account</p>
        </div>

        <div>
          <label htmlFor="identifier" className="block font-medium">
            Email or NIC
          </label>
          <input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            className="mt-1 w-full rounded border p-3"
          />
        </div>

        <div>
          <label htmlFor="password" className="block font-medium">
            Password
          </label>
          <div className="mt-1 flex rounded border">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="min-w-0 flex-1 p-3"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="px-3 underline"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && <p role="alert" className="text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-blue-700 p-3 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
