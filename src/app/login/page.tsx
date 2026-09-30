'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StrivoMark } from '@/components/Brand';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Lock,
  User as UserIcon,
  Mail,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { refreshProfile } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');

  // Sign In State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register State
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regGender, setRegGender] = useState<'boys' | 'girls'>('boys');
  const [regLevel, setRegLevel] = useState<'beginner' | 'amateur' | 'intermediate' | 'advanced' | 'professional'>('intermediate');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Handle Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    const cleanPassword = password.trim();

    if (!cleanId || !cleanPassword) {
      setErrorMsg('Please enter your username/email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      let resolvedEmail = cleanId.toLowerCase();

      // If user typed a username instead of email, resolve it
      if (!resolvedEmail.includes('@')) {
        try {
          const res = await fetch('/api/auth/resolve-identifier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: cleanId }),
          });
          const json = await res.json();
          if (json.email) {
            resolvedEmail = json.email;
          } else {
            resolvedEmail = `${cleanId}@badminton.app`;
          }
        } catch {
          resolvedEmail = `${cleanId}@badminton.app`;
        }
      }

      // Authenticate directly with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: cleanPassword,
      });

      if (error) {
        throw new Error(error.message || 'Invalid username or password.');
      }

      if (data.user) {
        await refreshProfile();
        router.push('/');
      }
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Failed to sign in. Please verify your credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Account Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPassword = regPassword.trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Username must be 3-20 characters (letters, numbers, underscores).');
      return;
    }

    if (!cleanName) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
          gender: regGender,
          level: regLevel,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create account.');
      }

      // Immediately establish session via Supabase Auth
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (loginError) {
        throw new Error(loginError.message);
      }

      if (loginData.user) {
        await refreshProfile();
        router.push('/');
      }
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Registration failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center max-w-sm mx-auto px-2 py-8">
      <Link
        href="/"
        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] mb-6 w-fit tap-target"
      >
        ← Back to the arena
      </Link>

      {/* Brand Hero */}
      <div className="text-center space-y-2 mb-6">
        <div className="w-14 h-14 rounded-3xl bg-[var(--accent-lime)] text-[#0B1020] flex items-center justify-center mx-auto shadow-lg shadow-[rgba(198,255,61,0.25)]">
          <StrivoMark className="w-14 h-14" />
        </div>
        <h1 className="font-sport font-black text-4xl tracking-tight text-[var(--text-main)] uppercase">
          Strivo<span className="text-[var(--accent-ink)]">.</span>
        </h1>
        <p className="text-xs text-[var(--text-muted)] tracking-wide">
          Play. Compete. Rise.
        </p>
      </div>

      {/* Mode Switcher: Sign In vs Create Account */}
      <div className="flex rounded-2xl bg-[var(--surface)] p-1 border border-[var(--hairline)] mb-5">
        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setErrorMsg('');
          }}
          className={`tap-target flex-1 rounded-xl text-xs font-bold transition-all ${
            mode === 'signin'
              ? 'btn-lime shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setErrorMsg('');
          }}
          className={`tap-target flex-1 rounded-xl text-xs font-bold transition-all ${
            mode === 'register'
              ? 'btn-lime shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-[var(--color-loss-bg)] border border-[var(--color-loss)] text-[var(--color-loss)] text-xs flex items-center gap-2 mb-4 animate-shake"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Sign In Form */}
      {mode === 'signin' && (
        <form onSubmit={handleSignIn} className="court-card p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                aria-label="Username or email"
                autoComplete="username"
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter username or email"
                className="w-full tap-target pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                aria-label="Password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full tap-target pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full tap-target py-3.5 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.2)] mt-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#0B1020]" />
            ) : (
              <>
                <span className="text-sm font-black uppercase tracking-wider">
                  Sign In
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* 2. Create Account Form */}
      {mode === 'register' && (
        <form onSubmit={handleRegister} className="court-card p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-[var(--text-muted)]">
                @
              </span>
              <input
                type="text"
                required
                aria-label="Username"
                autoComplete="username"
                value={regUsername}
                onChange={(e) =>
                  setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))
                }
                placeholder="username"
                className="w-full tap-target pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              aria-label="Full name"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Your full name"
              className="w-full tap-target px-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                aria-label="Email address"
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full tap-target pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Password
              </label>
              <button
                type="button"
                onClick={() => setRegShowPassword(!regShowPassword)}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1"
              >
                {regShowPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{regShowPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={regShowPassword ? 'text' : 'password'}
                required
                aria-label="Password"
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Create a password (min. 6 characters)"
                className="w-full tap-target pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Division
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRegGender('boys')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  regGender === 'boys'
                    ? 'border-[var(--accent-lime)] bg-[var(--accent-lime-muted)] text-[var(--text-main)]'
                    : 'border-[var(--hairline)] bg-[var(--surface-raised)] text-[var(--text-muted)]'
                }`}
              >
                Boys / Men
              </button>
              <button
                type="button"
                onClick={() => setRegGender('girls')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  regGender === 'girls'
                    ? 'border-[var(--accent-lime)] bg-[var(--accent-lime-muted)] text-[var(--text-main)]'
                    : 'border-[var(--hairline)] bg-[var(--surface-raised)] text-[var(--text-muted)]'
                }`}
              >
                Girls / Women
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Skill Level
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {(
                [
                  { key: 'beginner', label: 'Beginner' },
                  { key: 'amateur', label: 'Amateur' },
                  { key: 'intermediate', label: 'Intermediate' },
                  { key: 'advanced', label: 'Advanced' },
                  { key: 'professional', label: 'Professional' },
                ] as const
              ).map((lvl) => (
                <button
                  key={lvl.key}
                  type="button"
                  onClick={() => setRegLevel(lvl.key)}
                  className={`py-2 px-1.5 rounded-xl text-[11px] font-bold border transition-all text-center truncate ${
                    regLevel === lvl.key
                      ? 'border-[var(--accent-lime)] bg-[var(--accent-lime-muted)] text-[var(--text-main)]'
                      : 'border-[var(--hairline)] bg-[var(--surface-raised)] text-[var(--text-muted)]'
                  }`}
                  title={lvl.label}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full tap-target py-3.5 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.2)] mt-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#0B1020]" />
            ) : (
              <>
                <span className="text-sm font-black uppercase tracking-wider">
                  Create Account
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
