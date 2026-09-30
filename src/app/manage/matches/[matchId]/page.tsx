'use client';

import Image from 'next/image';

import type { Match } from '@/lib/types';

import { errorMessage } from '@/lib/errors';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Trophy, CheckCircle2, AlertCircle, Loader2, ArrowLeft, RotateCcw, Smartphone, FileSpreadsheet } from 'lucide-react';
import { evaluateMatch, evaluateSetScore, MatchRules, SetScore } from '@/lib/match/rules';
import { evaluateSheetSetScore, evaluateSheetMatch, formatMatchupInfo } from '@/lib/match/scoring';
import { finalizeMatchResult } from '@/lib/match/finalize';

export default function ScoreEntryPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const resolvedParams = use(params);
  const matchId = resolvedParams.matchId;
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [match, setMatch] = useState<Match | null>(null);
  const [rules, setRules] = useState<MatchRules | null>(null);
  const [setScores, setSetScores] = useState<SetScore[]>([]);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [mode, setMode] = useState<'scoreboard' | 'sheet'>('scoreboard');
  const [court, setCourt] = useState('');
  const [historyStack, setHistoryStack] = useState<SetScore[][]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadMatch() {
      try {
        const { data: m } = await supabase
          .from('matches')
          .select(`
            id, round, round_name, slot, status, court, rules_snapshot, set_scores, winner_id, next_match_id,
            category:categories(
              id, name, type, gender,
              tournament:tournaments(id, name)
            ),
            entry_a:entries!matches_entry_a_id_fkey(
              id, seed, pair_rating,
              player1:profiles!entries_player1_id_fkey(id, name, username, avatar_id, rating, matches_played, peak_rating),
              player2:profiles!entries_player2_id_fkey(id, name, username, avatar_id, rating, matches_played, peak_rating)
            ),
            entry_b:entries!matches_entry_b_id_fkey(
              id, seed, pair_rating,
              player1:profiles!entries_player1_id_fkey(id, name, username, avatar_id, rating, matches_played, peak_rating),
              player2:profiles!entries_player2_id_fkey(id, name, username, avatar_id, rating, matches_played, peak_rating)
            )
          `)
          .eq('id', matchId)
          .single();

        if (m) {
          const mData = m as unknown as Match;
          setMatch(mData);
          const r = mData.rules_snapshot as MatchRules;
          setRules(r);
          setCourt(mData.court || '');

          const existingScores = (mData.set_scores as SetScore[]) || [];
          if (existingScores.length > 0) {
            setSetScores(existingScores);
          } else {
            const numSets = r?.sets || 3;
            const initialSets: SetScore[] = [];
            for (let i = 1; i <= numSets; i++) {
              initialSets.push({ set: i, side_a: 0, side_b: 0 });
            }
            setSetScores(initialSets);
          }
        }
      } catch (err) {
        console.error('Error loading match:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMatch();
  }, [matchId, supabase]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-8 max-w-md mx-auto">
        <div className="h-8 w-44 skeleton-box" />
        <div className="h-64 court-card skeleton-box" />
      </div>
    );
  }

  if (!match || !rules) return <div role="alert" className="court-card p-8 text-center"><h1 className="font-bold">Match unavailable</h1><p className="text-sm text-[var(--text-muted)] mt-2">This match may have been removed or you may not have access.</p><button onClick={() => router.back()} className="btn-secondary tap-target px-5 mt-4">Go back</button></div>;

  const matchup = formatMatchupInfo(
    match.category?.type || 'singles',
    match.entry_a,
    match.entry_b
  );

  const evaluation = mode === 'scoreboard' ? evaluateMatch(rules, setScores) : evaluateSheetMatch(rules, setScores);
  const currentSet = setScores[currentSetIdx] || { set: 1, side_a: 0, side_b: 0 };
  const currentSetEval = (mode === 'scoreboard' ? evaluateSetScore : evaluateSheetSetScore)(rules, currentSet.set, currentSet.side_a, currentSet.side_b);

  // Scoreboard Point Click
  const handleScoreTap = (side: 'a' | 'b') => {
    if (evaluation.isFinished || currentSetEval.isFinished || isSubmitting || match.status === 'completed') return;
    // Save to history stack for undo
    setHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(setScores))]);

    const updated = setScores.map(set => ({ ...set }));
    if (side === 'a') {
      updated[currentSetIdx].side_a += 1;
    } else {
      updated[currentSetIdx].side_b += 1;
    }

    // Auto-advance to next set if current set finished and match not finished
    const checkSet = evaluateSetScore(rules, updated[currentSetIdx].set, updated[currentSetIdx].side_a, updated[currentSetIdx].side_b);
    if (checkSet.isFinished && currentSetIdx < rules.sets - 1) {
      const matchEval = evaluateMatch(rules, updated);
      if (!matchEval.isFinished) {
        // Next set
        if (!updated[currentSetIdx + 1]) {
          updated.push({ set: currentSetIdx + 2, side_a: 0, side_b: 0 });
        }
        setCurrentSetIdx(Math.min(currentSetIdx + 1, rules.sets - 1));
      }
    }

    setSetScores(updated);
  };

  // Undo point
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const last = historyStack[historyStack.length - 1];
    setSetScores(last);
    const unfinished = last.findIndex(set => !evaluateSetScore(rules, set.set, set.side_a, set.side_b).isFinished);
    setCurrentSetIdx(unfinished < 0 ? last.length - 1 : unfinished);
    setHistoryStack((prev) => prev.slice(0, -1));
  };

  // Manual Sheet input change
  const handleManualScoreChange = (setIndex: number, side: 'a' | 'b', val: string) => {
    const num = val === '' ? 0 : parseInt(val, 10);
    const updated = setScores.map(set => ({ ...set }));
    if (!updated[setIndex]) return;

    if (side === 'a') {
      updated[setIndex].side_a = isNaN(num) ? 0 : Math.max(0, num);
    } else {
      updated[setIndex].side_b = isNaN(num) ? 0 : Math.max(0, num);
    }
    setSetScores(updated);
  };

  // Finalize and Confirm Match
  const handleConfirmResult = async () => {
    if (!user || !evaluation.winner || !match.entry_a || !match.entry_b) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const validScores = setScores.filter((s) => s.side_a > 0 || s.side_b > 0);
      if (validScores.length === 0) {
        throw new Error('Please enter scores before confirming.');
      }

      const result = await finalizeMatchResult({
        supabase,
        matchId: match.id,
        category: match.category,
        entryA: match.entry_a,
        entryB: match.entry_b,
        rules,
        setScores: validScores,
        winnerSide: evaluation.winner,
        court,
        actorId: user.id,
        nextMatchId: match.next_match_id,
        matchSlot: match.slot,
      });

      setSuccessMsg(`Match confirmed! ${result.winnerName} wins! Ratings updated.`);
      setTimeout(() => {
        router.push(`/manage/tournaments/${match.category?.tournament?.id}`);
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Failed to confirm result.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-12 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="tap-target p-2 rounded-xl btn-secondary text-xs"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-[10px] uppercase font-bold text-[var(--accent-ink)]">
            {match.category?.name} • {match.round_name}
          </p>
          <h1 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight">
            Score Entry
          </h1>
        </div>

        {/* Mode Toggle: Scoreboard vs Sheet */}
        <div className="flex rounded-xl bg-[var(--surface-raised)] p-0.5 border border-[var(--hairline)]">
          <button
            type="button"
            onClick={() => setMode('scoreboard')}
            className={`tap-target px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              mode === 'scoreboard' ? 'btn-lime' : 'text-[var(--text-muted)]'
            }`}
            title="Scoreboard Tap Mode"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMode('sheet')}
            className={`tap-target px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              mode === 'sheet' ? 'btn-lime' : 'text-[var(--text-muted)]'
            }`}
            title="Scoresheet Numbers Mode"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-[var(--color-loss-bg)] border border-[var(--color-loss)] text-[var(--color-loss)] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-[var(--accent-lime-muted)] border border-[var(--accent-lime)] text-[var(--text-main)] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--accent-ink)]" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Set Selector Strip (Sets 1, 2, 3) */}
      <div className="flex gap-2">
        {setScores.slice(0, rules.sets).map((s, idx) => {
          const evalSet = evaluateSheetSetScore(rules, s.set, s.side_a, s.side_b);

          return (
            <button
              key={s.set}
              type="button"
              onClick={() => setCurrentSetIdx(idx)}
              className={`tap-target flex-1 py-2 px-3 rounded-2xl border transition-all text-center ${
                currentSetIdx === idx
                  ? 'border-[var(--accent-lime)] bg-[var(--surface-raised)] glow-lime'
                  : 'border-[var(--hairline)] bg-[var(--surface)] text-[var(--text-muted)]'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider block">
                Set {s.set}
              </span>
              <span className="font-sport font-black text-sm text-[var(--text-main)] tabular-nums">
                {s.side_a} - {s.side_b}
              </span>
              {evalSet.isFinished && (
                <span className="text-[9px] font-bold text-[var(--accent-ink)] block">
                  ✓ {evalSet.winner === 'sideA' ? matchup.shortA : matchup.shortB}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. SCOREBOARD MODE: Huge Tap Areas for Team A and Team B */}
      {mode === 'scoreboard' && (
        <div className="court-card p-4 space-y-3 shadow-2xl">
          {/* Top Half: Team A / Player A */}
          <div
            onClick={() => handleScoreTap('a')}
            className="court-card p-6 cursor-pointer active:scale-[0.99] transition-transform hover:border-[var(--accent-lime)] text-center relative overflow-hidden bg-gradient-to-b from-[var(--surface-raised)] to-[var(--surface)]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <Image width={96} height={96}
                  src={`/avatars/${match.entry_a?.player1?.avatar_id || 'cat-01'}.svg`}
                  alt="Avatar"
                  className="w-10 h-10 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)]"
                />
                <div className="text-left">
                  <p className="text-sm font-black text-[var(--text-main)] truncate max-w-[140px]">
                    {matchup.isDoubles ? 'Team A' : matchup.sideALabel}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[140px]">
                    {matchup.sideAPlayers}
                  </p>
                </div>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--accent-ink)] bg-[var(--accent-lime-muted)] px-2 py-0.5 rounded-full">
                Tap to +1
              </span>
            </div>

            {/* Giant Numerals */}
            <div className="py-2">
              <span className="font-sport font-black text-8xl text-[var(--text-main)] tabular-nums tracking-tight">
                {currentSet.side_a}
              </span>
            </div>
          </div>

          {/* Center Utility Bar: Set Indicator, Target & Undo */}
          <div className="flex items-center justify-between px-2 text-xs">
            <span className="font-sport font-bold text-xs uppercase text-[var(--text-muted)] tracking-wider">
              Set {currentSet.set} • Target {rules.points_per_set} pts
            </span>

            <button
              type="button"
              onClick={handleUndo}
              disabled={historyStack.length === 0}
              className="tap-target px-3 py-1 rounded-xl btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Point</span>
            </button>
          </div>

          {/* Bottom Half: Team B / Player B */}
          <div
            onClick={() => handleScoreTap('b')}
            className="court-card p-6 cursor-pointer active:scale-[0.99] transition-transform hover:border-[var(--accent-lime)] text-center relative overflow-hidden bg-gradient-to-t from-[var(--surface-raised)] to-[var(--surface)]"
          >
            {/* Giant Numerals */}
            <div className="py-2">
              <span className="font-sport font-black text-8xl text-[var(--text-main)] tabular-nums tracking-tight">
                {currentSet.side_b}
              </span>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2.5">
                <Image width={96} height={96}
                  src={`/avatars/${match.entry_b?.player1?.avatar_id || 'cat-02'}.svg`}
                  alt="Avatar"
                  className="w-10 h-10 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)]"
                />
                <div className="text-left">
                  <p className="text-sm font-black text-[var(--text-main)] truncate max-w-[140px]">
                    {matchup.isDoubles ? 'Team B' : matchup.sideBLabel}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[140px]">
                    {matchup.sideBPlayers}
                  </p>
                </div>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--accent-ink)] bg-[var(--accent-lime-muted)] px-2 py-0.5 rounded-full">
                Tap to +1
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. SHEET MODE: Direct Inputs From Paper Sheet */}
      {mode === 'sheet' && (
        <div className="court-card p-6 shadow-xl space-y-4">
          <div>
            <h2 className="font-sport font-black text-lg text-[var(--text-main)] uppercase tracking-wide">
              Manual Scoresheet Mode
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Enter final points from your physical sheet (e.g. Set 1: 12-15)
            </p>
          </div>

          <div className="space-y-3">
            {setScores.slice(0, rules.sets).map((s, idx) => {
              const evalSet = evaluateSheetSetScore(rules, s.set, s.side_a, s.side_b);
              const winnerSide = evalSet.isFinished ? evalSet.winner : null;
              const winnerLabel = winnerSide === 'sideA' ? matchup.shortA : matchup.shortB;

              return (
                <div
                  key={s.set}
                  className="p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-between gap-3"
                >
                  <div className="w-20">
                    <span className="font-sport font-bold text-sm text-[var(--text-main)] block">
                      Set {s.set}
                    </span>
                    {winnerSide && (
                      <span className="text-[10px] font-bold text-[var(--accent-ink)] block truncate">
                        ✓ {winnerLabel}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <span className="text-[9px] text-[var(--text-muted)] block mb-0.5 truncate max-w-[65px]">
                        {matchup.shortA}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={s.side_a === 0 ? '' : s.side_a}
                        onChange={(e) => handleManualScoreChange(idx, 'a', e.target.value)}
                        placeholder="0"
                        className="w-16 h-12 rounded-xl bg-[var(--surface)] border-2 border-[var(--hairline)] text-center font-sport font-black text-2xl text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
                      />
                    </div>

                    <span className="font-sport font-black text-xl text-[var(--text-muted)] pt-3">:</span>

                    <div className="text-center">
                      <span className="text-[9px] text-[var(--text-muted)] block mb-0.5 truncate max-w-[65px]">
                        {matchup.shortB}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={s.side_b === 0 ? '' : s.side_b}
                        onChange={(e) => handleManualScoreChange(idx, 'b', e.target.value)}
                        placeholder="0"
                        className="w-16 h-12 rounded-xl bg-[var(--surface)] border-2 border-[var(--hairline)] text-center font-sport font-black text-2xl text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Winner Decided Banner */}
      {evaluation.isFinished && evaluation.winner && (
        <div className="court-card p-4 border border-[var(--accent-lime)] bg-[var(--accent-lime-muted)] text-center space-y-1 shadow-xl">
          <p className="font-sport font-black text-xl text-[var(--accent-ink)] uppercase tracking-tight flex items-center justify-center gap-1.5">
            <Trophy className="w-5 h-5 text-[var(--accent-ink)]" />
            {evaluation.winner === 'sideA' ? (matchup.isDoubles ? 'Team A' : matchup.sideALabel) : (matchup.isDoubles ? 'Team B' : matchup.sideBLabel)} Wins Match!
          </p>
          <p className="font-sport font-bold text-sm text-[var(--text-main)] tabular-nums">
            Final Sets: {setScores.filter((s) => s.side_a > 0 || s.side_b > 0).map((s) => `${s.side_a}-${s.side_b}`).join(', ')}
          </p>
        </div>
      )}

      {/* Big Shuttle Lime Confirm Bar */}
      <button
        type="button"
        onClick={handleConfirmResult}
        disabled={isSubmitting || !evaluation.isFinished}
        className="w-full tap-target py-4 btn-lime flex items-center justify-center gap-2 shadow-xl shadow-[rgba(198,255,61,0.25)] text-sm font-black uppercase tracking-wider"
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin text-[#0B1020]" />
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" />
            <span>Confirm & Save Result</span>
          </>
        )}
      </button>
    </div>
  );
}
