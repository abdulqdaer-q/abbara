import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '@/store/slices/authSlice';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login - in production, call tRPC endpoint
    dispatch(loginSuccess({
      user: { id: '1', email, name: 'Admin User', role: 'ADMIN' },
      token: 'mock-token',
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">MoveNow Admin</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Sign in to access the admin panel</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <input
              type="email"
              required
              className="input"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              required
              className="input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};
