'use client';

import Image from 'next/image';

import { errorMessage } from '@/lib/errors';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Check, AlertCircle, Loader2, Lock, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { STARTING_LEVEL_RATINGS } from '@/lib/rating/elo';

const CAT_AVATARS = [
  'cat-01', 'cat-02', 'cat-03', 'cat-04',
  'cat-05', 'cat-06', 'cat-07', 'cat-08',
  'cat-09', 'cat-10', 'cat-11', 'cat-12',
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, refreshProfile, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'boys' | 'girls'>('boys');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [avatarId, setAvatarId] = useState('cat-01');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [showPhone, setShowPhone] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid' | 'checking'>('idle');

  const usernameRequest = useRef(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Live availability check
  const handleUsernameChange = async (val: string) => {
    const request = ++usernameRequest.current;
    const formatted = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    setUsername(formatted);

    if (formatted.length < 3) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', formatted)
        .maybeSingle();

      if (request !== usernameRequest.current) return;
      if (error) throw error;
      if (data) {
        setUsernameStatus('invalid');
        setErrorMsg('Username is already taken');
      } else {
        setUsernameStatus('valid');
        setErrorMsg('');
      }
    } catch {
      if (request !== usernameRequest.current) return;
      setUsernameStatus('idle');
      setErrorMsg('Could not check this username. Please try again.');
    }
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3 || username.length > 20) {
      setErrorMsg('Username must be 3-20 characters (letters, numbers, _).');
      return;
    }
    if (usernameStatus !== 'valid') { setErrorMsg('Please wait for an available username.'); return; }
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleNextStep2 = () => {
    setErrorMsg('');
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const startingRating = STARTING_LEVEL_RATINGS[level];

      // 1. Upsert profile
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email!,
        username: username.trim(),
        name: name.trim(),
        gender,
        level,
        rating: startingRating,
        peak_rating: startingRating,
        avatar_id: avatarId,
        bio: bio.trim(),
        matches_played: 0,
        is_admin: false,
      });

      if (profileErr) {
        if (profileErr.code === '23505') {
          throw new Error('This username is already taken. Please pick another.');
        }
        throw profileErr;
      }

      // 2. Upsert phone contact in separate protected table
      if (phone.trim() || showPhone) {
        await supabase.from('player_contacts').upsert({
          player_id: user.id,
          phone: phone.trim() || null,
          show_phone: showPhone,
        });
      }

      await refreshProfile();
      router.push('/');
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Failed to complete profile.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center max-w-sm mx-auto px-2 py-6">
      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step === s
                ? 'w-8 bg-[var(--accent-lime)] glow-lime'
                : step > s
                ? 'w-3 bg-[var(--accent-lime)] opacity-60'
                : 'w-3 bg-[var(--hairline-strong)]'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-6">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-ink)]">
          Step {step} of 3
        </span>
        <h1 className="font-sport font-black text-3xl tracking-tight text-[var(--text-main)] uppercase mt-0.5">
          {step === 1 && 'Create Player Card'}
          {step === 2 && 'Pick Mascot Cat'}
          {step === 3 && 'Skill Level & Privacy'}
        </h1>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-[var(--color-loss-bg)] border border-[var(--color-loss)] text-[var(--color-loss)] text-xs flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Username, Name & Gender */}
      {step === 1 && (
        <form onSubmit={handleNextStep1} className="court-card p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-[var(--text-muted)]">
                @
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="arjun_smash"
                className="w-full tap-target pl-8 pr-10 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] font-mono text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
              {usernameStatus === 'valid' && (
                <Check className="w-4 h-4 text-[var(--accent-ink)] absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              3-20 chars (e.g. arjun_smash, meera_k).
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Arjun Verma"
              className="w-full tap-target px-3.5 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Gender Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['boys', 'girls'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`tap-target py-2.5 rounded-xl text-xs font-bold capitalize transition-all border ${
                    gender === g
                      ? 'border-[var(--accent-lime)] bg-[var(--accent-lime-muted)] text-[var(--text-main)] shadow-sm'
                      : 'border-[var(--hairline)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {g === 'boys' ? 'Boys / Men' : 'Girls / Women'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full tap-target py-4 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.2)] mt-2"
          >
            <span className="text-sm font-black uppercase tracking-wider">Next: Pick Avatar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STEP 2: Cat Avatar Picker Grid of 12 */}
      {step === 2 && (
        <div className="court-card p-6 shadow-xl space-y-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 text-center">
              Tap a mascot cat to select
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {CAT_AVATARS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAvatarId(cat)}
                  className={`relative aspect-square rounded-2xl p-1 bg-[var(--surface-raised)] border-2 transition-all active:scale-95 ${
                    avatarId === cat
                      ? 'border-[var(--accent-lime)] glow-lime scale-105'
                      : 'border-[var(--hairline)] hover:border-[var(--hairline-strong)]'
                  }`}
                >
                  <Image width={96} height={96}
                    src={`/avatars/${cat}.svg`}
                    alt="Cat Avatar"
                    className="w-full h-full object-cover rounded-xl"
                  />
                  {avatarId === cat && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent-lime)] text-[#0B1020] flex items-center justify-center text-[10px] font-black shadow-md">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="tap-target px-4 py-3 rounded-xl btn-secondary text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextStep2}
              className="flex-1 tap-target py-3 btn-lime flex items-center justify-center gap-2"
            >
              <span className="text-sm font-black uppercase tracking-wider">Next: Skill & Privacy</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Skill Level, Bio & Phone Privacy */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="court-card p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Starting Level (Initial Elo)
            </label>
            <div className="space-y-2">
              {[
                { key: 'beginner', label: 'Beginner', rating: 500, desc: 'Casual games & learning rules' },
                { key: 'intermediate', label: 'Intermediate', rating: 600, desc: 'Regular club player with good rallies' },
                { key: 'advanced', label: 'Advanced', rating: 700, desc: 'Competitive tournament contender' },
              ].map((lvl) => (
                <button
                  key={lvl.key}
                  type="button"
                  onClick={() => setLevel(lvl.key as 'beginner' | 'intermediate' | 'advanced')}
                  className={`w-full p-3 rounded-2xl text-left border flex items-center justify-between transition-all ${
                    level === lvl.key
                      ? 'border-[var(--accent-lime)] bg-[var(--accent-lime-muted)]'
                      : 'border-[var(--hairline)] bg-[var(--surface-raised)] text-[var(--text-muted)]'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-[var(--text-main)] block">
                      {lvl.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {lvl.desc}
                    </span>
                  </div>
                  <span className="font-sport font-black text-lg text-[var(--accent-ink)] tabular-nums">
                    {lvl.rating}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Short Bio (Optional)
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Right-handed smasher, Yonex Astrox fan"
              className="w-full tap-target px-3.5 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
          </div>

          {/* Phone Privacy Box */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] space-y-2.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Phone Number (For partner coordination)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0199"
                className="w-full tap-target px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--hairline)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
              />
            </div>

            {/* Privacy Switch */}
            <div className="flex items-center justify-between pt-1 border-t border-[var(--hairline)]">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[var(--accent-ink)] shrink-0" />
                <div>
                  <span className="text-xs font-bold text-[var(--text-main)] block">
                    Show phone on profile
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    Off by default. Only visible if you enable it.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPhone(!showPhone)}
                className={`w-11 h-6 rounded-full transition-colors relative tap-target ${
                  showPhone ? 'bg-[var(--accent-lime)]' : 'bg-slate-700'
                }`}
                aria-label="Toggle phone visibility"
              >
                <span
                  className={`w-4 h-4 rounded-full bg-[#0B1020] absolute top-1 transition-transform ${
                    showPhone ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="tap-target px-4 py-3 rounded-xl btn-secondary text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 tap-target py-4 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.25)]"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#0B1020]" />
              ) : (
                <>
                  <span className="text-sm font-black uppercase tracking-wider">
                    Step Into Court
                  </span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
