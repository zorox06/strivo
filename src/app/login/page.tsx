'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StrivoMark } from '@/components/Brand';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_USER_PASSWORD } from '@/lib/supabase/config';
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
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { refreshProfile } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');

  // Sign In State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState(DEFAULT_USER_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);

  // Register State
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState(DEFAULT_USER_PASSWORD);
  const [regGender, setRegGender] = useState<'boys' | 'girls'>('boys');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Quick fill demo credentials
  const fillDemo = (demoUser: string) => {
    setIdentifier(demoUser);
    setPassword(DEFAULT_USER_PASSWORD);
    setErrorMsg('');
    setInfoMsg(`Filled ${demoUser} credentials (password: ${DEFAULT_USER_PASSWORD})`);
  };

  // 1. Handle Sign In with Password
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    const authPassword = password.trim() || DEFAULT_USER_PASSWORD;

    if (!cleanId) {
      setErrorMsg('Please enter your username or email.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      // Resolve identifier (username -> email)
      let resolvedEmail = cleanId.toLowerCase();

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

      // Sign in directly with Supabase password auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: authPassword,
      });

      if (error) {
        throw new Error(error.message || 'Invalid username/email or password.');
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

  // 2. Handle Account Registration (No OTP needed)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();
    const authPassword = regPassword.trim() || DEFAULT_USER_PASSWORD;

    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
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

    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          name: cleanName,
          email: cleanEmail,
          password: authPassword,
          gender: regGender,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create account.');
      }

      // Auto-login immediately upon registration (No OTP needed!)
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: authPassword,
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

      {/* Status Notifications */}
      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-[var(--color-loss-bg)] border border-[var(--color-loss)] text-[var(--color-loss)] text-xs flex items-center gap-2 mb-4 animate-shake"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-[var(--accent-lime-muted)] border border-[var(--accent-lime)] text-[var(--text-main)] text-xs flex items-center gap-2 mb-4"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--accent-ink)]" />
          <span>{infoMsg}</span>
        </div>
      )}

      {/* 1. Sign In Form */}
      {mode === 'signin' && (
        <div className="space-y-4">
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
                  placeholder="e.g. akshayx06 or arjun_v"
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
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5 flex items-center gap-1">
                <span>Default password for all players:</span>
                <code className="font-mono text-[var(--accent-ink)] font-bold bg-[var(--surface-raised)] px-1 py-0.5 rounded">
                  {DEFAULT_USER_PASSWORD}
                </code>
              </p>
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

          {/* Quick Demo Fill Buttons */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--hairline)] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[var(--accent-ink)]" />
              Quick Fill Demo Accounts:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => fillDemo('akshayx06')}
                className="text-[11px] font-bold py-1.5 px-2 rounded-lg bg-[var(--surface-raised)] hover:bg-[var(--surface-sunken)] border border-[var(--hairline)] text-[var(--text-main)] truncate"
              >
                👑 Akshay
              </button>
              <button
                type="button"
                onClick={() => fillDemo('arjun_v')}
                className="text-[11px] font-bold py-1.5 px-2 rounded-lg bg-[var(--surface-raised)] hover:bg-[var(--surface-sunken)] border border-[var(--hairline)] text-[var(--text-main)] truncate"
              >
                🏸 Arjun
              </button>
              <button
                type="button"
                onClick={() => fillDemo('ananya_s')}
                className="text-[11px] font-bold py-1.5 px-2 rounded-lg bg-[var(--surface-raised)] hover:bg-[var(--surface-sunken)] border border-[var(--hairline)] text-[var(--text-main)] truncate"
              >
                🏸 Ananya
              </button>
            </div>
          </div>
        </div>
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
                placeholder="player_handle"
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
              placeholder="e.g. John Doe"
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
                placeholder="player@example.com"
                className="w-full tap-target pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                aria-label="Password"
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full tap-target pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Defaulted to <code className="font-mono text-[var(--accent-ink)] font-bold">{DEFAULT_USER_PASSWORD}</code> for instant setup.
            </p>
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
                  Create Account & Enter
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-[var(--text-muted)]">
            No OTP required. Account activates immediately.
          </p>
        </form>
      )}
    </div>
  );
}
