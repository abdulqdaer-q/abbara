import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '@/store/slices/authSlice';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useDispatch();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For demo purposes, accept any admin@movenow.com credentials
      // In production, this would call the auth service API
      if (email.includes('admin') || email === 'admin@movenow.com') {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate a mock JWT-like token for demo
        const mockToken = btoa(JSON.stringify({
          userId: '1',
          email,
          role: 'SUPER_ADMIN',
          exp: Date.now() + 24 * 60 * 60 * 1000
        }));

        // Store token
        localStorage.setItem('adminToken', mockToken);

        dispatch(loginSuccess({
          user: { id: '1', email, name: 'Admin User', role: 'SUPER_ADMIN' },
          token: mockToken,
        }));
      } else {
        setError('Invalid credentials. Use an admin email.');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">MoveNow Admin</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Sign in to access the admin panel</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <input
              type="email"
              required
              className="input"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <input
              type="password"
              required
              className="input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-xs text-gray-500 text-center mt-4">
            Demo: Use any email containing &quot;admin&quot; (e.g., admin@movenow.com)
          </p>
        </form>
      </div>
    </div>
  );
};
