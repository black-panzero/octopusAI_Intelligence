import React, { useState } from 'react';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';

const LoginForm = () => {
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.login({ email: form.email.trim(), password: form.password });
      setSession({ token: data.access_token, user: data.user });
    } catch (err) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Login failed');
    } finally { setLoading(false); }
  };

  const ic = 'w-full pl-11 pr-4 py-3 rounded-[var(--r-md)] bg-white/30 border border-white/40 text-gray-900 text-[var(--text-base)] placeholder:text-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-500/15 transition-all';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1.5">Email</label>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <input name="email" type="email" value={form.email} onChange={handleChange} required autoComplete="email"
                 placeholder="Enter your email..." className={ic} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1.5">Password</label>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <input name="password" type="password" value={form.password} onChange={handleChange} required autoComplete="current-password"
                 className={ic} />
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          <input type="checkbox" className="rounded border-gray-300" /> Remember me
        </label>
        <button type="button" className="text-gray-500 hover:text-gray-800">Forgot password?</button>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
      <button type="submit" disabled={loading}
              className="w-full py-3 rounded-[var(--r-md)] bg-gray-900/80 text-white font-semibold hover:bg-gray-900 transition-all disabled:opacity-50 backdrop-blur-sm">
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
};

export default LoginForm;
