'use client';

import Image from 'next/image';

import React, { useState } from 'react';

import { Palette, Layers, Sparkles, Trophy, Swords, Sun, Moon, Smartphone, Monitor, RotateCcw, Check } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import CatEmptyState from '@/components/CatEmptyState';

export default function DesignSystemPage() {
  const { theme, toggleTheme } = useTheme();
  const [deviceFrame, setDeviceFrame] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'tokens' | 'components' | 'avatars' | 'bracket' | 'scoreboard'>('tokens');

  // Interactive Scoreboard Simulation State
  const [scoreA, setScoreA] = useState(14);
  const [scoreB, setScoreB] = useState(12);
  const setNumber = 1;
  const [history, setHistory] = useState<Array<{ a: number; b: number }>>([]);

  const addPointA = () => {
    setHistory((prev) => [...prev, { a: scoreA, b: scoreB }]);
    setScoreA((prev) => prev + 1);
  };

  const addPointB = () => {
    setHistory((prev) => [...prev, { a: scoreA, b: scoreB }]);
    setScoreB((prev) => prev + 1);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setScoreA(last.a);
    setScoreB(last.b);
    setHistory((prev) => prev.slice(0, -1));
  };

  // Interactive Bracket Reveal Simulation State
  const [revealKey, setRevealKey] = useState(1);
  const triggerReveal = () => setRevealKey((k) => k + 1);

  // 12 Cat Avatars Array
  const catAvatars = Array.from({ length: 12 }, (_, i) => ({
    id: `cat-${String(i + 1).padStart(2, '0')}`,
    name: [
      'Smash Tiger',
      'Dropshot Kitty',
      'Net-Kill Puma',
      'Clear Calico',
      'Serve Siamese',
      'Backhand Bobcat',
      'Jump-Smash Cheetah',
      'Spinning Lynx',
      'Drive Persian',
      'Lob Leopard',
      'Rally Maine Coon',
      'Match-Point Tabby',
    ][i],
    role: [
      'Aggressive Smasher',
      'Deceptive Dropshots',
      'Speed Net Controller',
      'Endurance Runner',
      'Low Serve Specialist',
      'Backhand Wizard',
      'High Flying Attacker',
      'Spin Master',
      'Flat Drive Dominator',
      'Defensive Wall',
      'Tactical Strategist',
      'Clutch Finisher',
    ][i],
  }));

  return (
    <div className="space-y-8">
      {/* Top Banner & Control Bar */}
      <div className="court-card p-6 rounded-3xl relative overflow-hidden space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Night-Court Scoreboard Design System
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                Tokens & Component Library
              </span>
            </div>
            <h1 className="font-sport font-black text-3xl md:text-4xl text-[var(--text-main)] uppercase tracking-tight">
              Design Tokens & Component Library
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xl">
              Precision design specifications for Strivo. Inspired by chess.com ratings clarity, live arena scoreboard energy, and Linear/Strava Polish.
            </p>
          </div>

          {/* Quick View Controls */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              className="tap-target px-3.5 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] text-xs font-bold text-[var(--text-main)] flex items-center gap-2 transition-all"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            {/* Mobile 390x844 Frame Simulator */}
            <div className="flex items-center rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] p-1">
              <button
                onClick={() => setDeviceFrame('desktop')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  deviceFrame === 'desktop'
                    ? 'bg-[var(--accent-lime)] text-[#0B1020]'
                    : 'text-[var(--text-muted)]'
                }`}
                title="Full Desktop Canvas"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeviceFrame('mobile')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                  deviceFrame === 'mobile'
                    ? 'bg-[var(--accent-lime)] text-[#0B1020]'
                    : 'text-[var(--text-muted)]'
                }`}
                title="Simulate 390x844 Phone Screen"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-[var(--hairline)]">
          {[
            { id: 'tokens', label: 'Color Tokens & Typography', icon: Palette },
            { id: 'components', label: 'Component Library', icon: Layers },
            { id: 'avatars', label: '12 Cat Mascot Avatars', icon: Sparkles },
            { id: 'bracket', label: 'Draw Reveal Bracket', icon: Trophy },
            { id: 'scoreboard', label: 'Scoreboard Mode Tap Area', icon: Swords },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`tap-target px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 border transition-all ${
                  isActive
                    ? 'btn-lime font-black shadow-md shadow-[rgba(198,255,61,0.2)]'
                    : 'bg-[var(--surface-raised)] border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Frame Container (Wraps content in simulated phone or desktop canvas) */}
      <div
        className={
          deviceFrame === 'mobile'
            ? 'max-w-[390px] mx-auto p-4 border-4 border-slate-700 rounded-[44px] shadow-2xl bg-[var(--bg-ink)] overflow-hidden transition-all'
            : 'w-full transition-all'
        }
      >
        {/* ==================== 1. TOKENS TAB ==================== */}
        {activeTab === 'tokens' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Color Tokens Matrix */}
            <div className="court-card p-6 rounded-3xl space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-ink)]">
                  Palettes & Contrast
                </span>
                <h3 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight">
                  Night-Court Color Tokens
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Dark mode is the hero. One electric accent: shuttle lime. Win/loss get W/L and +/- indicators.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#0B1020] border border-white/10 text-white space-y-1">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">Background Ink</span>
                  <p className="font-mono font-bold text-xs">#0B1020</p>
                  <span className="text-[10px] text-slate-400 block">Arena dark base</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#121A30] border border-white/10 text-white space-y-1">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">Surface</span>
                  <p className="font-mono font-bold text-xs">#121A30</p>
                  <span className="text-[10px] text-slate-400 block">Default cards</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#1A2440] border border-white/10 text-white space-y-1">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">Surface Raised</span>
                  <p className="font-mono font-bold text-xs">#1A2440</p>
                  <span className="text-[10px] text-slate-400 block">Hover / elevated</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#C6FF3D] text-[#0B1020] space-y-1 shadow-md shadow-[rgba(198,255,61,0.2)]">
                  <span className="text-[9px] font-mono font-bold block uppercase opacity-80">Shuttle Lime Accent</span>
                  <p className="font-mono font-black text-xs">#C6FF3D</p>
                  <span className="text-[10px] font-bold block opacity-90">Text is always ink #0B1020</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#3DDC97] text-[#0B1020] space-y-1">
                  <span className="text-[9px] font-mono font-bold block uppercase opacity-80">Win Accent</span>
                  <p className="font-mono font-black text-xs">#3DDC97</p>
                  <span className="text-[10px] font-bold block opacity-90">W letter & + sign</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FF5C7A] text-white space-y-1">
                  <span className="text-[9px] font-mono font-bold block uppercase opacity-80">Loss Accent</span>
                  <p className="font-mono font-black text-xs">#FF5C7A</p>
                  <span className="text-[10px] font-bold block opacity-90">L letter & - sign</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F3F6FF] text-[#0B1020] space-y-1">
                  <span className="text-[9px] font-mono font-bold block uppercase text-slate-600">Text Main</span>
                  <p className="font-mono font-black text-xs">#F3F6FF</p>
                  <span className="text-[10px] text-slate-600 block">High contrast AA+</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#8F9BB8] text-[#0B1020] space-y-1">
                  <span className="text-[9px] font-mono font-bold block uppercase text-slate-700">Muted Text</span>
                  <p className="font-mono font-black text-xs">#8F9BB8</p>
                  <span className="text-[10px] text-slate-700 block">Subtitles & labels</span>
                </div>
              </div>
            </div>

            {/* Typography Scale */}
            <div className="court-card p-6 rounded-3xl space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-ink)]">
                  Typography Scale
                </span>
                <h3 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight">
                  Barlow Condensed & Plus Jakarta Sans
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Ratings and scores are big and confident with tabular figures. Labels are uppercase with letter spacing.
                </p>
              </div>

              <div className="space-y-4 divide-y divide-[var(--hairline)]">
                <div className="pt-2 flex items-baseline justify-between">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Profile Rating (64px - 72px)</span>
                  <span className="font-sport font-black text-6xl text-[var(--accent-ink)] tracking-tight tabular-nums">
                    1248
                  </span>
                </div>

                <div className="pt-3 flex items-baseline justify-between">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Scoreboard Numeral (48px)</span>
                  <span className="font-sport font-black text-5xl text-[var(--text-main)] tracking-tight tabular-nums">
                    21 : 19
                  </span>
                </div>

                <div className="pt-3 flex items-baseline justify-between">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Screen Header (32px)</span>
                  <span className="font-sport font-black text-2xl text-[var(--text-main)] uppercase tracking-tight">
                    All-England Knockout Arena
                  </span>
                </div>

                <div className="pt-3 flex items-baseline justify-between">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Scoreboard Metric (18px)</span>
                  <span className="font-sport font-bold text-lg text-[var(--text-main)] tabular-nums">
                    78% Win Rate • +9 Streak
                  </span>
                </div>

                <div className="pt-3 flex items-baseline justify-between">
                  <span className="text-xs text-[var(--text-muted)] font-mono">Micro Label (10px uppercase tracking)</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-ink)]">
                    LIVE MATCH • COURT 2
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. COMPONENTS TAB ==================== */}
        {activeTab === 'components' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Buttons Showcase */}
            <div className="court-card p-6 rounded-3xl space-y-4">
              <h3 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight">
                Buttons & States (≥ 44px tap targets)
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                {/* Primary Lime */}
                <button className="tap-target px-5 py-2.5 rounded-xl btn-lime text-xs font-black shadow-md shadow-[rgba(198,255,61,0.2)]">
                  Primary Lime
                </button>

                {/* Secondary Surface */}
                <button className="tap-target px-5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] text-xs font-bold text-[var(--text-main)]">
                  Secondary Surface
                </button>

                {/* Outline */}
                <button className="tap-target px-5 py-2.5 rounded-xl border border-[var(--accent-lime)] text-[var(--accent-ink)] text-xs font-bold hover:bg-[var(--accent-lime)] hover:text-[#0B1020] transition-colors">
                  Outline Lime
                </button>

                {/* Disabled */}
                <button disabled className="tap-target px-5 py-2.5 rounded-xl btn-lime text-xs font-black opacity-40 cursor-not-allowed">
                  Disabled Button
                </button>

                {/* Win Action */}
                <button className="tap-target px-4 py-2 rounded-xl bg-[var(--accent-win)] text-[#0B1020] text-xs font-black flex items-center gap-1.5">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirm +1 Point</span>
                </button>
              </div>
            </div>

            {/* Chips & Badges */}
            <div className="court-card p-6 rounded-3xl space-y-4">
              <h3 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight">
                Chips, Status & Trends
              </h3>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Win chip */}
                <span className="chip-win px-3 py-1 rounded-xl text-xs font-sport font-black tabular-nums">
                  +9 W
                </span>

                {/* Loss chip */}
                <span className="chip-loss px-3 py-1 rounded-xl text-xs font-sport font-black tabular-nums">
                  -9 L
                </span>

                {/* Live pulsing badge */}
                <span className="bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)] px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5">
                  <span className="live-dot" />
                  Live Match
                </span>

                {/* Manager Chips */}
                <span className="bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)] px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  FULL MANAGER
                </span>
                <span className="bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)] px-2 py-0.5 rounded text-[10px] font-mono">
                  ENTRIES ONLY
                </span>

                {/* Seed Chip */}
                <span className="bg-[var(--surface)] border border-[var(--hairline)] text-[var(--accent-ink)] px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  SEED #1
                </span>

                {/* Category Chip */}
                <span className="bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--text-main)] px-2.5 py-1 rounded-xl text-xs font-bold">
                  Men&apos;s Singles
                </span>
              </div>
            </div>

            {/* 2-Row Match Card Demonstration */}
            <div className="court-card p-6 rounded-3xl space-y-4">
              <h3 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight">
                Night-Court Match Card Component
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Two rows with avatar, name, tabular score boxes, winner lime side bar, and live badge.
              </p>

              {/* Sample Match Card */}
              <div className="court-card p-4 rounded-2xl relative overflow-hidden group border border-[var(--accent-lime)] glow-lime">
                {/* Winner Lime Side Bar */}
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[var(--accent-lime)] glow-lime" />

                <div className="flex items-center justify-between text-xs mb-2.5">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                    Semifinals • Match #3 • Court 1
                  </span>
                  <span className="bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)] px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
                    <span className="live-dot" /> LIVE
                  </span>
                </div>

                <div className="space-y-1.5">
                  {/* Row A (Winner) */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[rgba(198,255,61,0.1)] border border-[rgba(198,255,61,0.3)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--accent-lime)]">
                        <Image width={96} height={96} src="/avatars/cat-01.svg" alt="A" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[var(--text-main)]">arjun_smash</span>
                        <span className="text-[10px] font-mono text-[var(--accent-ink)] block">#1 Seed • 1210 Elo</span>
                      </div>
                      <span className="text-[9px] font-black uppercase text-[var(--accent-ink)] bg-[rgba(198,255,61,0.2)] px-1.5 py-0.5 rounded ml-1">
                        W
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-sport font-black text-sm tabular-nums">
                      <span className="w-7 h-7 rounded bg-[var(--accent-lime)] text-[#0B1020] flex items-center justify-center font-black">
                        21
                      </span>
                      <span className="w-7 h-7 rounded bg-[var(--surface)] text-[var(--text-muted)] flex items-center justify-center">
                        18
                      </span>
                      <span className="w-7 h-7 rounded bg-[var(--accent-lime)] text-[#0B1020] flex items-center justify-center font-black">
                        21
                      </span>
                    </div>
                  </div>

                  {/* Row B */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-raised)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--hairline)]">
                        <Image width={96} height={96} src="/avatars/cat-02.svg" alt="B" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[var(--text-main)]">rohan_v</span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] block">#3 Seed • 1150 Elo</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 font-sport font-black text-sm tabular-nums">
                      <span className="w-7 h-7 rounded bg-[var(--surface)] text-[var(--text-muted)] flex items-center justify-center">
                        19
                      </span>
                      <span className="w-7 h-7 rounded bg-[var(--accent-lime)] text-[#0B1020] flex items-center justify-center font-black">
                        21
                      </span>
                      <span className="w-7 h-7 rounded bg-[var(--surface)] text-[var(--text-muted)] flex items-center justify-center">
                        16
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Empty States Demo */}
            <div className="space-y-4">
              <h3 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight px-1">
                Playful Mascot Empty State
              </h3>
              <CatEmptyState
                catNumber={1}
                title="No Matches Yet"
                message="No matches yet. Go smash something."
                actionText="Create Tournament"
                actionHref="/manage/tournaments/new"
              />
            </div>
          </div>
        )}

        {/* ==================== 3. 12 CAT MASCOT AVATARS TAB ==================== */}
        {activeTab === 'avatars' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="court-card p-6 rounded-3xl space-y-2">
              <h3 className="font-sport font-black text-2xl text-[var(--text-main)] uppercase tracking-tight">
                12 Flat Vector Cat Mascots
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Consistent flat vector style: thick rounded outlines, expressive faces, bold backgrounds, sports headbands and shuttles.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {catAvatars.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="court-card p-4 rounded-2xl flex flex-col items-center text-center space-y-3 group hover:border-[var(--accent-lime)] transition-all hover:scale-102"
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--hairline)] group-hover:border-[var(--accent-lime)] transition-colors shadow-lg">
                      <Image width={96} height={96}
                        src={`/avatars/${cat.id}.svg`}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--surface-raised)] border border-[var(--accent-lime)] text-[10px] font-mono font-bold flex items-center justify-center text-[var(--accent-ink)]">
                      #{idx + 1}
                    </span>
                  </div>

                  <div>
                    <p className="font-sport font-black text-sm text-[var(--text-main)] uppercase tracking-wide group-hover:text-[var(--accent-ink)] transition-colors">
                      {cat.name}
                    </p>
                    <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                      {cat.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 4. BRACKET REVEAL TAB ==================== */}
        {activeTab === 'bracket' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="court-card p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-ink)]">
                    Screen 9 Demonstration
                  </span>
                  <h3 className="font-sport font-black text-2xl text-[var(--text-main)] uppercase tracking-tight">
                    Draw Preview: Seeds Sliding Into Place
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Watch seeds animate and lock into position with staggered delays and court line connectors.
                  </p>
                </div>

                <button
                  onClick={triggerReveal}
                  className="tap-target px-4 py-2 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-md shadow-[rgba(198,255,61,0.2)]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-run Animation</span>
                </button>
              </div>

              {/* Animated Bracket Slots */}
              <div key={revealKey} className="space-y-3 pt-2">
                {[
                  { slot: 1, p1: 'arjun_smash (#1)', p2: 'BYE', bye: true },
                  { slot: 2, p1: 'meera_k (#4)', p2: 'sana_shuttle (#5)', bye: false },
                  { slot: 3, p1: 'vikram_ace (#3)', p2: 'tanvi_smash (#6)', bye: false },
                  { slot: 4, p1: 'rohan_v (#2)', p2: 'BYE', bye: true },
                ].map((m, idx) => (
                  <div
                    key={m.slot}
                    style={{ animationDelay: `${idx * 150}ms`, animationFillMode: 'both' }}
                    className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] transition-all animate-in slide-in-from-left-8 duration-500 flex items-center justify-between relative overflow-hidden"
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[var(--accent-lime)]" />

                    <div className="flex items-center gap-3 pl-2">
                      <span className="w-6 h-6 rounded bg-[var(--surface-raised)] text-[10px] font-mono font-bold flex items-center justify-center text-[var(--accent-ink)]">
                        #{m.slot}
                      </span>
                      <span className="font-bold text-xs text-[var(--text-main)]">{m.p1}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">vs</span>
                      <span className="font-bold text-xs text-[var(--text-main)]">{m.p2}</span>
                    </div>

                    {m.bye && (
                      <span className="text-[9px] font-bold text-[var(--accent-win)] bg-[rgba(61,220,151,0.1)] border border-[rgba(61,220,151,0.2)] px-2 py-0.5 rounded-full font-mono">
                        BYE ADVANCES
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. SCOREBOARD MODE TAP AREA TAB ==================== */}
        {activeTab === 'scoreboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="court-card p-6 rounded-3xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-ink)]">
                    Screen 10 Demonstration
                  </span>
                  <h3 className="font-sport font-black text-2xl text-[var(--text-main)] uppercase tracking-tight">
                    Full-Screen Scoreboard Tap Mode
                  </h3>
                </div>

                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="tap-target px-3.5 py-1.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undo Point</span>
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Team A on top, Team B on bottom. Giant tap areas for quick umpire score entry during intense rallies.
              </p>
            </div>

            {/* Giant Scoreboard Simulator Box */}
            <div className="rounded-3xl border-2 border-[var(--hairline)] overflow-hidden bg-[var(--surface)] divide-y divide-[var(--hairline)] shadow-2xl">
              {/* Team A Tap Area */}
              <button
                type="button"
                onClick={addPointA}
                className="w-full p-8 flex flex-col items-center justify-center hover:bg-[rgba(198,255,61,0.06)] active:scale-[0.99] transition-all relative group select-none"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Image width={96} height={96} src="/avatars/cat-01.svg" alt="A" className="w-8 h-8 rounded-full border border-[var(--accent-lime)]" />
                  <span className="font-sport font-black text-lg uppercase text-[var(--text-main)]">
                    arjun_smash (Side A)
                  </span>
                </div>
                <div className="font-sport font-black text-8xl text-[var(--accent-ink)] tabular-nums tracking-tighter group-hover:scale-105 transition-transform">
                  {scoreA}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mt-1">
                  Tap to add point
                </span>
              </button>

              {/* Set & Court Divider Strip */}
              <div className="py-2 px-4 bg-[var(--surface-raised)] flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--text-muted)]">SET {setNumber} • FIRST TO 21</span>
                <span className="text-[var(--accent-ink)] font-bold">COURT 1</span>
              </div>

              {/* Team B Tap Area */}
              <button
                type="button"
                onClick={addPointB}
                className="w-full p-8 flex flex-col items-center justify-center hover:bg-[rgba(198,255,61,0.06)] active:scale-[0.99] transition-all relative group select-none"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Image width={96} height={96} src="/avatars/cat-02.svg" alt="B" className="w-8 h-8 rounded-full border border-[var(--hairline)]" />
                  <span className="font-sport font-black text-lg uppercase text-[var(--text-main)]">
                    rohan_v (Side B)
                  </span>
                </div>
                <div className="font-sport font-black text-8xl text-[var(--text-main)] tabular-nums tracking-tighter group-hover:scale-105 transition-transform">
                  {scoreB}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mt-1">
                  Tap to add point
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
