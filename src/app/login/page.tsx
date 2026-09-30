'use client';

import { errorMessage } from '@/lib/errors';

import Link from 'next/link';
import { StrivoMark } from '@/components/Brand';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { refreshProfile } = useAuth();

  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');

  // OTP state
  const [email, setEmail] = useState('');
  const [otpStep, setOtpStep] = useState<'email' | 'otp'>('email');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Password state (for owner/organizers)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (otpStep === 'otp' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpStep, resendTimer]);

  // Handle 6-box OTP input
  const handleDigitChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    // Auto-advance
    if (digit && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || '';
    }
    setOtpDigits(updated);
    const nextIndex = Math.min(pasted.length, 5);
    otpInputs.current[nextIndex]?.focus();
  };

  // 1. Send OTP Email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setOtpStep('otp');
      setResendTimer(30);
      setCanResend(false);
      setInfoMsg(`A 6-digit code has been sent to ${email}`);
      setTimeout(() => otpInputs.current[0]?.focus(), 150);
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Failed to send OTP code.'));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Verify OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpDigits.join('');
    if (token.length !== 6) {
      setErrorMsg('Please enter all 6 digits.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'email',
      });

      if (error) throw error;

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', data.user.id)
          .maybeSingle();

        await refreshProfile();

        if (!profile || !profile.username) {
          router.push('/onboarding');
        } else {
          router.push('/');
        }
      }
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Invalid or expired code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Password login for owner
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter your username/email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      let resolvedEmail = identifier.trim().toLowerCase();
      if (!resolvedEmail.includes('@')) {
        try {
          const { data: p } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', resolvedEmail)
            .maybeSingle();

          if (p?.email) {
            resolvedEmail = p.email;
          } else {
            resolvedEmail = `${resolvedEmail}@badminton.app`;
          }
        } catch {
          resolvedEmail = `${resolvedEmail}@badminton.app`;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await refreshProfile();
        router.push('/');
      }
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Invalid credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center max-w-sm mx-auto px-2 py-8">
      <Link href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] mb-8 w-fit tap-target">← Back to the arena</Link>
      {/* Brand Hero */}
      <div className="text-center space-y-2 mb-8">
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

      {/* Mode Switcher: Email OTP vs Owner Sign-in */}
      <div className="flex rounded-2xl bg-[var(--surface)] p-1 border border-[var(--hairline)] mb-6">
        <button
          type="button"
          onClick={() => {
            setAuthMode('otp');
            setErrorMsg('');
          }}
          className={`tap-target flex-1 rounded-xl text-xs font-bold transition-all ${
            authMode === 'otp'
              ? 'btn-lime shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Email OTP
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode('password');
            setErrorMsg('');
          }}
          className={`tap-target flex-1 rounded-xl text-xs font-bold transition-all ${
            authMode === 'password'
              ? 'btn-lime shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Owner / Password
        </button>
      </div>

      {/* Status Notifications */}
      {errorMsg && (
        <div role="alert" className="p-3.5 rounded-2xl bg-[var(--color-loss-bg)] border border-[var(--color-loss)] text-[var(--color-loss)] text-xs flex items-center gap-2 mb-4 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div role="status" className="p-3.5 rounded-2xl bg-[var(--accent-lime-muted)] border border-[var(--accent-lime)] text-[var(--text-main)] text-xs flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--accent-ink)]" />
          <span>{infoMsg}</span>
        </div>
      )}

      {/* 1. Email OTP Flow */}
      {authMode === 'otp' && (
        <div className="court-card p-6 shadow-xl space-y-5">
          {otpStep === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Player Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    aria-label="Player email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="player@example.com"
                    autoFocus
                    className="w-full tap-target pl-10 pr-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-lime)]"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                  No password needed. We send a 6-digit code to log in.
                </p>
              </div>

              {/* Big Shuttle Lime Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full tap-target py-4 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.2)]"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#0B1020]" />
                ) : (
                  <>
                    <span className="text-sm font-black uppercase tracking-wider">
                      Send 6-Digit Code
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Enter 6-Digit Code
                  </label>
                  <button
                    type="button"
                    onClick={() => { setOtpStep('email'); setOtpDigits(['', '', '', '', '', '']); setErrorMsg(''); setInfoMsg(''); }}
                    className="text-[11px] text-[var(--accent-ink)] font-bold hover:underline"
                  >
                    Change Email
                  </button>
                </div>

                {/* 6 Separate Code Boxes with Auto-Advance & Paste */}
                <div className="flex justify-between gap-2" onPaste={handlePaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      aria-label={`Code digit ${idx + 1}`}
                      autoComplete={idx === 0 ? "one-time-code" : "off"}
                      className={`min-w-0 flex-1 w-0 h-14 rounded-xl bg-[var(--surface-raised)] border-2 text-center font-sport font-black text-2xl text-[var(--text-main)] focus:outline-none transition-all ${
                        digit
                          ? 'border-[var(--accent-lime)] text-[var(--accent-ink)]'
                          : 'border-[var(--hairline)] focus:border-[var(--accent-lime)]'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between mt-3 text-[11px] text-[var(--text-muted)]">
                  <span>
                    {resendTimer > 0 ? (
                      `Resend in ${resendTimer}s`
                    ) : (
                      <button
                        type="button"
                        disabled={isLoading || !canResend}
                        onClick={handleSendOtp}
                        className="text-[var(--accent-ink)] font-bold hover:underline"
                      >
                        Resend Code
                      </button>
                    )}
                  </span>
                  <span>Auto-advancing</span>
                </div>
              </div>

              {/* Big Shuttle Lime Button */}
              <button
                type="submit"
                disabled={isLoading || otpDigits.join('').length !== 6}
                className="w-full tap-target py-4 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.2)]"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#0B1020]" />
                ) : (
                  <>
                    <span className="text-sm font-black uppercase tracking-wider">
                      Verify & Enter Court
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* 2. Password Login Flow (Owner Credentials) */}
      {authMode === 'password' && (
        <form onSubmit={handlePasswordLogin} className="court-card p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Username or Email
            </label>
            <input
              type="text"
              required
              aria-label="Username or email"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Your username or email"
              className="w-full tap-target px-3.5 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              aria-label="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full tap-target px-3.5 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full tap-target py-4 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.2)] mt-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#0B1020]" />
            ) : (
              <>
                <span className="text-sm font-black uppercase tracking-wider">
                  Sign In with Password
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
