'use client';

import { errorMessage } from '@/lib/errors';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, ArrowLeft, Sliders, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { MatchRules } from '@/lib/match/rules';

interface CategoryFormDef {
  name: string;
  type: 'singles' | 'doubles';
  gender: 'boys' | 'girls' | 'mixed';
  format: 'knockout' | 'groups_knockout' | 'swiss';
  enabled: boolean;
}

const DEFAULT_CATEGORIES: CategoryFormDef[] = [
  { name: 'Boys Singles', type: 'singles', gender: 'boys', format: 'knockout', enabled: true },
  { name: 'Girls Singles', type: 'singles', gender: 'girls', format: 'knockout', enabled: true },
  { name: 'Boys Doubles', type: 'doubles', gender: 'boys', format: 'knockout', enabled: true },
  { name: 'Girls Doubles', type: 'doubles', gender: 'girls', format: 'knockout', enabled: true },
  { name: 'Mixed Doubles', type: 'doubles', gender: 'mixed', format: 'knockout', enabled: true },
];

export default function CreateTournamentWizardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categories, setCategories] = useState<CategoryFormDef[]>(DEFAULT_CATEGORIES);

  // Match rules with standard defaults prefilled
  const [rules, setRules] = useState<MatchRules>({
    sets: 3,
    points_per_set: 21,
    win_by_2: true,
    point_cap: 30,
    deciding_set_points: null,
  });

  const [customPoints, setCustomPoints] = useState('');
  const [decidingPointsInput, setDecidingPointsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleCategory = (idx: number) => {
    const updated = categories.map(category => ({ ...category }));
    updated[idx].enabled = !updated[idx].enabled;
    setCategories(updated);
  };

  const updateFormat = (idx: number, format: 'knockout' | 'groups_knockout' | 'swiss') => {
    const updated = [...categories];
    updated[idx].format = format;
    setCategories(updated);
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a tournament name.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const enabled = categories.filter((c) => c.enabled);
    if (enabled.length === 0) {
      setErrorMsg('Please enable at least one category.');
      return;
    }
    setErrorMsg('');
    setStep(3);
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.is_admin) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const resolvedRules: MatchRules = {
        ...rules,
        points_per_set: customPoints ? parseInt(customPoints, 10) : rules.points_per_set,
        deciding_set_points: decidingPointsInput ? parseInt(decidingPointsInput, 10) : null,
      };

      if (!Number.isInteger(resolvedRules.points_per_set) || resolvedRules.points_per_set < 1) throw new Error('Points per set must be a positive whole number.');
      if (resolvedRules.point_cap !== null && resolvedRules.point_cap < Math.max(resolvedRules.points_per_set, resolvedRules.deciding_set_points ?? 0)) throw new Error('The point cap must be at least the highest set target.');
      if (resolvedRules.deciding_set_points !== null && (!Number.isInteger(resolvedRules.deciding_set_points) || resolvedRules.deciding_set_points < 1)) throw new Error('Deciding set points must be a positive whole number.');
      // 1. Create Tournament record
      const { data: tourney, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name: name.trim(),
          date,
          status: 'draft',
          rules: resolvedRules,
          created_by: user.id,
        })
        .select()
        .single();

      if (tErr) throw tErr;

      // 2. Create Categories
      const enabledCats = categories.filter((c) => c.enabled);
      const { error: categoryError } = await supabase.from('categories').insert(enabledCats.map(cat => ({ tournament_id: tourney.id, name: cat.name, type: cat.type, gender: cat.gender, format: cat.format, status: 'draft' })));
      if (categoryError) throw categoryError;

      // 3. Record Audit Log
      await supabase.from('audit_log').insert({
        tournament_id: tourney.id,
        action: 'tournament_created',
        actor_id: user.id,
        details: {
          name: tourney.name,
          rules: resolvedRules,
          categoriesCount: enabledCats.length,
        },
      });

      router.push(`/manage/tournaments/${tourney.id}`);
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Failed to create tournament.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Live sentence preview
  const effectivePoints = customPoints ? parseInt(customPoints, 10) || 21 : rules.points_per_set;
  const sentencePreview = `First to ${effectivePoints}${rules.win_by_2 ? ', win by 2' : ' (sudden death)'}${
    rules.point_cap ? `, cap ${rules.point_cap}` : ''
  }${decidingPointsInput ? ` (deciding set ${decidingPointsInput} pts)` : ''}`;

  return (
    <div className="max-w-md mx-auto space-y-5 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="tap-target p-2 rounded-xl btn-secondary text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-ink)]">
            Step {step} of 3
          </span>
          <h1 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight">
            {step === 1 && 'Details & Match Rules'}
            {step === 2 && 'Categories & Formats'}
            {step === 3 && 'Review & Publish'}
          </h1>
        </div>

        <div className="w-9" />
      </div>

      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-2">
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

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-[var(--color-loss-bg)] border border-[var(--color-loss)] text-[var(--color-loss)] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Name, Date & Match Rules Stepper */}
      {step === 1 && (
        <form onSubmit={handleNextStep1} className="court-card p-6 shadow-xl space-y-5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Tournament Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Club Championship 2026"
              className="w-full tap-target px-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Tournament Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full tap-target px-3.5 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
          </div>

          {/* Big Segmented Controls for Match Rules */}
          <div className="pt-2 border-t border-[var(--hairline)] space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--accent-ink)]" />
              <span className="font-sport font-black text-sm uppercase tracking-wider text-[var(--text-main)]">
                Match Scoring Rules
              </span>
            </div>

            {/* Live Sentence Preview Badge */}
            <div className="p-3 rounded-xl bg-[var(--accent-lime-muted)] border border-[var(--accent-lime)] text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--accent-ink)] block mb-0.5">
                Rule Preview
              </span>
              <p className="font-sport font-black text-sm text-[var(--text-main)] tracking-tight">
                {sentencePreview}
              </p>
            </div>

            {/* Sets Segmented Control */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Number of Sets
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([1, 3, 5] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRules({ ...rules, sets: s })}
                    className={`tap-target py-2.5 rounded-xl font-sport text-sm font-black transition-all border ${
                      rules.sets === s
                        ? 'btn-lime border-[var(--accent-lime)] shadow-sm'
                        : 'btn-secondary text-[var(--text-muted)]'
                    }`}
                  >
                    {s === 1 ? '1 Set' : `Best of ${s}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Points Segmented Control (11, 15, 21, Custom) */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Points per Set
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[11, 15, 21].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setCustomPoints('');
                      setRules({ ...rules, points_per_set: p });
                    }}
                    className={`tap-target py-2.5 rounded-xl font-sport text-sm font-black transition-all border ${
                      rules.points_per_set === p && !customPoints
                        ? 'btn-lime border-[var(--accent-lime)] shadow-sm'
                        : 'btn-secondary text-[var(--text-muted)]'
                    }`}
                  >
                    {p} pts
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomPoints('30')}
                  className={`tap-target py-2.5 rounded-xl font-sport text-sm font-black transition-all border ${
                    customPoints ? 'btn-lime border-[var(--accent-lime)] shadow-sm' : 'btn-secondary text-[var(--text-muted)]'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Win-by-2 Switch */}
            {customPoints && <label className="block text-xs font-bold text-[var(--text-muted)]">Custom points per set<input aria-label="Custom points per set" type="number" min="1" step="1" value={customPoints} onChange={e => setCustomPoints(e.target.value)} className="tap-target block w-full px-3 mt-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--text-main)]" /></label>}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-[var(--text-muted)]">Point cap<input aria-label="Point cap" type="number" min="1" step="1" value={rules.point_cap ?? ''} onChange={e => setRules({ ...rules, point_cap: e.target.value ? Number(e.target.value) : null })} placeholder="No cap" className="tap-target block w-full px-3 mt-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--text-main)]" /></label>
              {rules.sets !== 1 && <label className="text-xs font-bold text-[var(--text-muted)]">Deciding set points<input aria-label="Deciding set points" type="number" min="1" step="1" value={decidingPointsInput} onChange={e => setDecidingPointsInput(e.target.value)} placeholder="Same as other sets" className="tap-target block w-full px-3 mt-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--text-main)]" /></label>}
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">
                  Deuce / Win by 2
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  Requires 2-point lead at target
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Win by two points"
                aria-checked={rules.win_by_2}
                onClick={() => setRules({ ...rules, win_by_2: !rules.win_by_2 })}
                className={`w-11 h-6 rounded-full transition-colors relative tap-target ${
                  rules.win_by_2 ? 'bg-[var(--accent-lime)]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-[#0B1020] absolute top-1 transition-transform ${
                    rules.win_by_2 ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full tap-target py-4 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.2)] mt-2"
          >
            <span className="text-sm font-black uppercase tracking-wider">Next: Categories</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STEP 2: Category Toggle & Formats */}
      {step === 2 && (
        <form onSubmit={handleNextStep2} className="court-card p-6 shadow-xl space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Toggle which divisions to host and choose their draw format.
          </p>

          <div className="space-y-3">
            {categories.map((cat, idx) => (
              <div
                key={cat.name}
                className={`p-3.5 rounded-2xl border transition-all ${
                  cat.enabled
                    ? 'border-[var(--accent-lime)] bg-[var(--surface-raised)]'
                    : 'border-[var(--hairline)] bg-[var(--surface-raised)]/40 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={cat.enabled}
                      onChange={() => toggleCategory(idx)}
                      className="w-5 h-5 accent-[var(--accent-lime)] rounded cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-black text-[var(--text-main)] block">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                        {cat.type} • {cat.gender}
                      </span>
                    </div>
                  </div>

                  {/* Format Selector */}
                  {cat.enabled && (
                    <select
                      value={cat.format}
                      onChange={(e) => updateFormat(idx, e.target.value as 'knockout' | 'groups_knockout' | 'swiss')}
                      className="tap-target px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--hairline)] text-xs text-[var(--text-main)] font-bold focus:outline-none focus:border-[var(--accent-lime)]"
                    >
                      <option value="knockout">Single Knockout</option>
                      <option value="groups_knockout">Groups + Knockout</option>
                      <option value="swiss">Swiss Rounds</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
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
              type="submit"
              className="flex-1 tap-target py-4 btn-lime flex items-center justify-center gap-2 shadow-lg shadow-[rgba(198,255,61,0.2)]"
            >
              <span className="text-sm font-black uppercase tracking-wider">Next: Review & Create</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: Review & Create */}
      {step === 3 && (
        <form onSubmit={handleCreateTournament} className="court-card p-6 shadow-xl space-y-5">
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                Tournament Name
              </span>
              <h3 className="font-sport font-black text-2xl text-[var(--text-main)] mt-0.5">
                {name}
              </h3>
              <p className="text-xs font-mono text-[var(--text-muted)] mt-1">
                Date: {date}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                Match Rules
              </span>
              <p className="font-sport font-black text-sm text-[var(--accent-ink)]">
                {sentencePreview}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                Active Categories ({categories.filter((c) => c.enabled).length})
              </span>
              <div className="space-y-1.5">
                {categories.filter((c) => c.enabled).map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-main)]">{c.name}</span>
                    <span className="text-[10px] uppercase font-mono text-[var(--accent-ink)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--hairline)]">
                      {c.format.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
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
                    Create Tournament
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
