// Auth screen — Sign Up (dark bg) and Sign In (pink bg) matching Figma.
// Split: brand left, glass form right. All logic preserved from original.
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthScreen = () => {
  const [mode, setMode] = useState('login');
  const isDark = mode === 'register';

  return (
    <div className="min-h-screen flex relative overflow-hidden"
         style={{
           background: isDark
             ? 'linear-gradient(145deg, #0a0a0a 0%, #1a1510 40%, #0d0d0d 100%)'
             : 'linear-gradient(145deg, #f8d7e0 0%, #f0c4d4 50%, #ead0dc 100%)',
         }}>
      {/* Left — brand */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative">
        <div className="text-center z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg className="w-8 h-8" fill="none" stroke={isDark ? '#c8a96e' : '#666'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4-8M7 13l-2 6h14m-9 4a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </div>
          <h1 className={`text-4xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-800'}`}
              style={{ fontFamily: 'Georgia, serif' }}>Octopus</h1>
          <p className={`text-xl tracking-wide ${isDark ? 'text-[#c8a96e]' : 'text-gray-600'}`}
             style={{ fontFamily: 'Georgia, serif' }}>Smartbuy</p>
        </div>
        <div className="absolute bottom-8 left-8">
          {mode === 'login' ? (
            <p className="text-sm text-gray-600">New to Smartbuy?{' '}
              <button onClick={() => setMode('register')} className="font-semibold text-gray-800 hover:underline">Sign Up</button>
            </p>
          ) : (
            <p className="text-sm text-gray-400">Already a member?{' '}
              <button onClick={() => setMode('login')} className="font-semibold text-white hover:underline">Sign In</button>
            </p>
          )}
        </div>
      </div>

      {/* Right — form */}
      <div className="w-full lg:w-[480px] flex items-center justify-center p-6 lg:p-10">
        <div className={`w-full max-w-sm rounded-[var(--r-2xl)] p-8 backdrop-blur-xl ${
          isDark
            ? 'bg-white/[0.06] border border-white/[0.10]'
            : 'bg-white/40 border border-white/50'
        }`} style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
          <h2 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {isDark ? 'Sign Up' : 'Sign In'}
          </h2>
          {mode === 'login'
            ? <LoginForm onSwitchToRegister={() => setMode('register')} />
            : <RegisterForm onSwitchToLogin={() => setMode('login')} />}
          <div className="mt-6">
            <p className={`text-center text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              or sign {isDark ? 'up' : 'in'} with
            </p>
            <div className="flex items-center justify-center gap-6">
              {['', '⊞', 'G'].map((icon, i) => (
                <button key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition ${
                  isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-black/5 text-gray-700 hover:bg-black/10'
                }`}>{icon}</button>
              ))}
            </div>
          </div>
          <div className="mt-6 text-center lg:hidden">
            {mode === 'login' ? (
              <p className="text-sm text-gray-600">New?{' '}
                <button onClick={() => setMode('register')} className="font-semibold underline">Create account</button>
              </p>
            ) : (
              <p className="text-sm text-gray-400">Have an account?{' '}
                <button onClick={() => setMode('login')} className="font-semibold text-white underline">Sign in</button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
