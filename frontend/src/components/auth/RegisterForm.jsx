import React, { useState } from 'react';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores/authStore';

const RegisterForm = () => {
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({
    email: '', password: '', full_name: '',
    role: 'user', business_name: '', business_description: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const isMerchant = form.role === 'merchant';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (isMerchant && !form.business_name.trim()) { setError('Business name is required for merchants'); return; }
    setLoading(true);
    try {
      await authApi.register({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim() || null,
        role: form.role,
        business_name: isMerchant ? form.business_name.trim() : null,
        business_description: isMerchant ? form.business_description.trim() || null : null,
      });
      const data = await authApi.login({ email: form.email.trim(), password: form.password });
      setSession({ token: data.access_token, user: data.user });
    } catch (err) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).join(', ') : 'Registration failed');
    } finally { setLoading(false); }
  };

  const ic = 'w-full pl-11 pr-4 py-3 rounded-[var(--r-md)] bg-white/[0.08] border border-white/[0.12] text-white text-[var(--text-base)] placeholder:text-gray-500 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-500/20 transition-all';
  const icShort = 'w-full px-4 py-3 rounded-[var(--r-md)] bg-white/[0.08] border border-white/[0.12] text-white text-[var(--text-base)] placeholder:text-gray-500 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-500/20 transition-all';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Role selector */}
      <div className="flex rounded-[var(--r-md)] overflow-hidden border border-white/[0.12]">
        {['user', 'merchant'].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setForm((p) => ({ ...p, role: r }))}
            className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-all ${
              form.role === r
                ? 'bg-white text-gray-900'
                : 'bg-white/[0.06] text-gray-400 hover:bg-white/10'
            }`}
          >
            {r === 'user' ? '🛒 Shopper' : '🏪 Merchant'}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">Full name</label>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <input name="full_name" type="text" value={form.full_name} onChange={handleChange}
                 autoComplete="name" placeholder="John Doe" className={ic} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <input name="email" type="email" value={form.email} onChange={handleChange}
                 required autoComplete="email" placeholder="Enter your email..." className={ic} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <input name="password" type="password" value={form.password} onChange={handleChange}
                 required minLength={8} autoComplete="new-password"
                 placeholder="Create a strong password" className={ic} />
        </div>
      </div>

      {/* Merchant fields */}
      {isMerchant && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Business name *</label>
            <input name="business_name" type="text" value={form.business_name} onChange={handleChange}
                   placeholder="e.g. Naivas Supermarket" className={icShort} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Business description</label>
            <input name="business_description" type="text" value={form.business_description} onChange={handleChange}
                   placeholder="What do you sell?" className={icShort} />
          </div>
        </>
      )}

      <label className="flex items-start gap-2 text-sm text-gray-400">
        <input type="checkbox" className="mt-0.5 rounded border-gray-600" />
        <span>I agree to the <a href="#" className="text-white underline">Terms & Privacy Policy</a></span>
      </label>

      {error && <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

      <button type="submit" disabled={loading}
              className="w-full py-3 rounded-[var(--r-md)] bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all disabled:opacity-50">
        {loading ? 'Creating account...' : isMerchant ? 'Create merchant account' : 'Create account'}
      </button>
    </form>
  );
};

export default RegisterForm;
