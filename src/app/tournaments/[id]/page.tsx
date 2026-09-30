'use client';

import Image from 'next/image';

import type { Tournament, Category, Match } from '@/lib/types';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Calendar, Edit2, ArrowLeft, Grid, List } from 'lucide-react';
import { MatchRules } from '@/lib/match/rules';
import CatEmptyState from '@/components/CatEmptyState';

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const tournamentId = resolvedParams.id;
  const supabase = createClient();
  const { hasTournamentAccess } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'round' | 'bracket'>('round');

  // 1. Load tournament and categories
  useEffect(() => {
    async function loadTournament() {
      try {
        const { data: tourney } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', tournamentId)
          .single();

        if (tourney) setTournament(tourney as unknown as Tournament);

        const { data: cats } = await supabase
          .from('categories')
          .select('*')
          .eq('tournament_id', tournamentId);

        if (cats && cats.length > 0) {
          setCategories(cats as unknown as Category[]);
          setSelectedCategoryId(cats[0].id);
        }
      } catch (err) {
        console.error('Error loading tournament:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadTournament();
  }, [tournamentId, supabase]);

  // 2. Load matches for selected category & setup Realtime
  useEffect(() => {
    if (!selectedCategoryId) return;

    async function loadMatches() {
      const { data } = await supabase
        .from('matches')
        .select(`
          id, round, round_name, slot, status, court, rules_snapshot, set_scores, winner_id,
          entry_a:entries!matches_entry_a_id_fkey(
            id, seed, pair_rating,
            player1:profiles!entries_player1_id_fkey(id, name, avatar_id, username, rating),
            player2:profiles!entries_player2_id_fkey(id, name, avatar_id, username, rating)
          ),
          entry_b:entries!matches_entry_b_id_fkey(
            id, seed, pair_rating,
            player1:profiles!entries_player1_id_fkey(id, name, avatar_id, username, rating),
            player2:profiles!entries_player2_id_fkey(id, name, avatar_id, username, rating)
          )
        `)
        .eq('category_id', selectedCategoryId)
        .order('round', { ascending: true })
        .order('slot', { ascending: true });

      if (data) {
        setMatches(data as unknown as Match[]);
        if (data.length > 0) {
          const inProgressMatch = data.find((m) => m.status === 'in_progress');
          setSelectedRound(inProgressMatch ? inProgressMatch.round : 1);
        }
      }
    }

    loadMatches();

    const channel = supabase
      .channel(`matches-cat-${selectedCategoryId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `category_id=eq.${selectedCategoryId}`,
        },
        () => {
          loadMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCategoryId, supabase]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-8 w-48 skeleton-box" />
        <div className="h-44 court-card skeleton-box" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-10 court-card text-center space-y-4">
        <p className="font-sport font-bold text-lg text-[var(--text-main)]">
          Tournament Not Found
        </p>
        <Link href="/tournaments" className="tap-target px-4 py-2 rounded-xl btn-lime text-xs font-bold inline-block">
          ← Back to Tournaments
        </Link>
      </div>
    );
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const rules = (selectedCategory?.rules_override || tournament.rules) as MatchRules;

  // Extract distinct rounds
  const roundsList: { round: number; roundName: string }[] = [];
  matches.forEach((m) => {
    if (!roundsList.some((r) => r.round === m.round)) {
      roundsList.push({
        round: m.round,
        roundName: m.round_name || `Round ${m.round}`,
      });
    }
  });

  const currentRoundMatches = matches.filter((m) => m.round === selectedRound);

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/tournaments"
          className="tap-target px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Tournaments</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Desktop View Switcher (Round List vs Wide Bracket) */}
          {roundsList.length > 1 && (
            <div className="hidden lg:flex items-center p-1 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
              <button
                onClick={() => setViewMode('round')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'round'
                    ? 'bg-[var(--surface)] text-[var(--accent-ink)] shadow-sm'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Round View</span>
              </button>
              <button
                onClick={() => setViewMode('bracket')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'bracket'
                    ? 'bg-[var(--surface)] text-[var(--accent-ink)] shadow-sm'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Wide Bracket</span>
              </button>
            </div>
          )}

          {hasTournamentAccess && (
            <Link
              href={`/manage/tournaments/${tournament.id}`}
              className="tap-target px-3.5 py-1.5 rounded-xl btn-lime text-xs font-black flex items-center gap-1 shadow-md shadow-[rgba(198,255,61,0.2)] transition-all hover:scale-102"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Manage Draw</span>
            </Link>
          )}
        </div>
      </div>

      {/* Header Banner (Night-Court Motif) */}
      <div className="court-card p-6 shadow-xl relative overflow-hidden space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {tournament.status === 'in_progress' ? (
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)]">
                  <span className="live-dot" />
                  Live Tournament
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)]">
                  {tournament.status.replace('_', ' ')}
                </span>
              )}
              <span className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {tournament.date}
              </span>
            </div>

            <h1 className="font-sport font-black text-3xl sm:text-4xl text-[var(--text-main)] tracking-tight uppercase">
              {tournament.name}
            </h1>
          </div>
        </div>

        {/* Rules Snapshot Strip */}
        {rules && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[var(--hairline)]">
            <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Sets
              </span>
              <span className="font-sport font-black text-sm text-[var(--text-main)]">
                Best of {rules.sets}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Target Points
              </span>
              <span className="font-sport font-black text-sm text-[var(--text-main)]">
                {rules.points_per_set} pts {rules.win_by_2 && '(win-by-2)'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Point Cap
              </span>
              <span className="font-sport font-black text-sm text-[var(--text-main)]">
                {rules.point_cap ? `Max ${rules.point_cap}` : 'No cap'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Deciding Set
              </span>
              <span className="font-sport font-black text-sm text-[var(--text-main)]">
                {rules.deciding_set_points ? `${rules.deciding_set_points} pts` : 'Standard'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Category Pills Strip */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`tap-target px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategoryId === cat.id
                  ? 'btn-lime font-black shadow-md shadow-[rgba(198,255,61,0.2)]'
                  : 'bg-[var(--surface-raised)] border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Round View or Desktop Wide Bracket View */}
      {roundsList.length > 0 ? (
        viewMode === 'bracket' ? (
          /* Desktop Wider Bracket View */
          <div className="space-y-4">
            <div className="overflow-x-auto pb-6">
              <div className="grid grid-flow-col auto-cols-[300px] gap-6 min-w-max pt-2">
                {roundsList.map((r) => {
                  const roundMatches = matches.filter((m) => m.round === r.round);
                  return (
                    <div key={r.round} className="space-y-3">
                      <div className="court-card-raised p-2.5 rounded-xl text-center">
                        <span className="font-sport font-black text-sm uppercase tracking-wider text-[var(--accent-ink)]">
                          {r.roundName}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {roundMatches.length} Matches
                        </span>
                      </div>

                      <div className="space-y-4">
                        {roundMatches.map((m) => {
                          const isFinished = m.status === 'completed';
                          const isWinnerA = isFinished && m.winner_id === m.entry_a?.id;
                          const isWinnerB = isFinished && m.winner_id === m.entry_b?.id;
                          const setScores = (m.set_scores || []) as Array<{ set: number; side_a: number; side_b: number }>;

                          return (
                            <div
                              key={m.id}
                              className={`court-card p-3 rounded-2xl relative transition-all ${
                                m.status === 'in_progress' ? 'glow-lime border-[var(--accent-lime)]' : ''
                              }`}
                            >
                              {/* Winner Indicator Bar */}
                              {isWinnerA && <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--accent-lime)] glow-lime" />}
                              {isWinnerB && <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--accent-lime)] glow-lime" />}

                              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono mb-2 pb-1 border-b border-[var(--hairline)]">
                                <span>#{m.slot} {m.court && `• ${m.court}`}</span>
                                {m.status === 'in_progress' ? (
                                  <span className="text-[var(--accent-ink)] font-bold flex items-center gap-1">
                                    <span className="live-dot" /> LIVE
                                  </span>
                                ) : (
                                  <span>{m.status}</span>
                                )}
                              </div>

                              {/* Side A */}
                              <div className={`flex items-center justify-between p-1.5 rounded-lg mb-1 ${isWinnerA ? 'bg-[rgba(198,255,61,0.1)] font-bold' : ''}`}>
                                <div className="flex items-center gap-2 truncate">
                                  <Image width={96} height={96} src={`/avatars/${m.entry_a?.player1?.avatar_id || 'cat-01'}.svg`} alt="A" className="w-5 h-5 rounded-full" />
                                  <span className="text-xs text-[var(--text-main)] truncate">{m.entry_a?.player1?.name || 'TBD'}</span>
                                  {m.entry_a?.seed && <span className="text-[9px] font-mono text-[var(--accent-ink)]">#{m.entry_a.seed}</span>}
                                </div>
                                <div className="flex gap-1 font-sport font-black text-xs tabular-nums">
                                  {setScores.map((s, i) => (
                                    <span key={i} className={`w-5 h-5 flex items-center justify-center rounded ${s.side_a > s.side_b ? 'bg-[var(--accent-lime)] text-[#0B1020]' : 'text-[var(--text-muted)]'}`}>
                                      {s.side_a}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Side B */}
                              <div className={`flex items-center justify-between p-1.5 rounded-lg ${isWinnerB ? 'bg-[rgba(198,255,61,0.1)] font-bold' : ''}`}>
                                <div className="flex items-center gap-2 truncate">
                                  <Image width={96} height={96} src={`/avatars/${m.entry_b?.player1?.avatar_id || 'cat-02'}.svg`} alt="B" className="w-5 h-5 rounded-full" />
                                  <span className="text-xs text-[var(--text-main)] truncate">{m.entry_b?.player1?.name || 'TBD'}</span>
                                  {m.entry_b?.seed && <span className="text-[9px] font-mono text-[var(--accent-ink)]">#{m.entry_b.seed}</span>}
                                </div>
                                <div className="flex gap-1 font-sport font-black text-xs tabular-nums">
                                  {setScores.map((s, i) => (
                                    <span key={i} className={`w-5 h-5 flex items-center justify-center rounded ${s.side_b > s.side_a ? 'bg-[var(--accent-lime)] text-[#0B1020]' : 'text-[var(--text-muted)]'}`}>
                                      {s.side_b}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Mobile Round Tabs View (Scrollable chips + 2-row cards) */
          <div className="space-y-4">
            <div className="flex gap-2 p-1.5 court-card-raised rounded-2xl overflow-x-auto scrollbar-none">
              {roundsList.map((r) => (
                <button
                  key={r.round}
                  onClick={() => setSelectedRound(r.round)}
                  className={`tap-target flex-1 py-2 px-3 rounded-xl font-sport text-sm font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                    selectedRound === r.round
                      ? 'bg-[var(--accent-lime)] text-[#0B1020] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {r.roundName}
                </button>
              ))}
            </div>

            {/* Match Cards List (Two rows with avatar, name, tabular score boxes, lime side bar on winner) */}
            <div className="space-y-3">
              {currentRoundMatches.map((m) => {
                const isFinished = m.status === 'completed';
                const isBye = m.status === 'bye';
                const isDoubles = selectedCategory?.type === 'doubles';
                const setScores = (m.set_scores || []) as Array<{ set: number; side_a: number; side_b: number }>;

                const isWinnerA = isFinished && m.winner_id === m.entry_a?.id;
                const isWinnerB = isFinished && m.winner_id === m.entry_b?.id;

                const nameA = isDoubles
                  ? `${m.entry_a?.player1?.name || 'TBD'} & ${m.entry_a?.player2?.name || 'TBD'}`
                  : m.entry_a?.player1?.name || (isBye ? 'BYE' : 'TBD');

                const nameB = isDoubles
                  ? `${m.entry_b?.player1?.name || 'TBD'} & ${m.entry_b?.player2?.name || 'TBD'}`
                  : m.entry_b?.player1?.name || (isBye ? 'BYE' : 'TBD');

                return (
                  <div
                    key={m.id}
                    className={`court-card p-4 transition-all relative overflow-hidden ${
                      m.status === 'in_progress' ? 'glow-lime border-[var(--accent-lime)]' : ''
                    }`}
                  >
                    {/* Winner Lime Side Bar */}
                    {isWinnerA && <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[var(--accent-lime)] glow-lime" />}
                    {isWinnerB && <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[var(--accent-lime)] glow-lime" />}

                    {/* Match Header */}
                    <div className="flex items-center justify-between text-xs pb-2.5 mb-2.5 border-b border-[var(--hairline)]">
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {m.round_name} • Match #{m.slot}
                      </span>

                      <div className="flex items-center gap-2">
                        {m.court && (
                          <span className="font-bold text-[10px] font-mono text-[var(--accent-ink)] bg-[var(--surface-raised)] px-2 py-0.5 rounded-md border border-[var(--hairline)]">
                            {m.court}
                          </span>
                        )}

                        {m.status === 'in_progress' ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-ink)]">
                            <span className="live-dot" />
                            Live
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase text-[var(--text-muted)]">
                            {m.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Match Rows */}
                    <div className="space-y-2">
                      {/* Row 1: Side A */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                          isWinnerA
                            ? 'bg-[rgba(198,255,61,0.1)] border border-[rgba(198,255,61,0.3)] pl-3'
                            : 'bg-[var(--surface-raised)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <Image width={96} height={96}
                            src={`/avatars/${m.entry_a?.player1?.avatar_id || 'cat-01'}.svg`}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full border border-[var(--hairline)] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className={`text-xs font-black truncate ${isWinnerA ? 'text-[var(--accent-ink)]' : 'text-[var(--text-main)]'}`}>
                              {nameA}
                            </p>
                            <span className="font-sport text-[11px] text-[var(--text-muted)] tabular-nums font-mono">
                              {m.entry_a?.pair_rating || m.entry_a?.player1?.rating || 500} Elo
                              {m.entry_a?.seed && ` • #${m.entry_a.seed}`}
                            </span>
                          </div>
                        </div>

                        {/* Score Boxes */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {setScores.map((s, idx) => (
                            <div
                              key={idx}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-sport font-black text-base tabular-nums border ${
                                s.side_a > s.side_b
                                  ? 'bg-[var(--accent-lime)] text-[#0B1020] border-[var(--accent-lime)]'
                                  : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--hairline)]'
                              }`}
                            >
                              {s.side_a}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Row 2: Side B */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                          isWinnerB
                            ? 'bg-[rgba(198,255,61,0.1)] border border-[rgba(198,255,61,0.3)] pl-3'
                            : 'bg-[var(--surface-raised)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <Image width={96} height={96}
                            src={`/avatars/${m.entry_b?.player1?.avatar_id || 'cat-02'}.svg`}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full border border-[var(--hairline)] shrink-0"
                          />
                          <div className="min-w-0">
                            <p className={`text-xs font-black truncate ${isWinnerB ? 'text-[var(--accent-ink)]' : 'text-[var(--text-main)]'}`}>
                              {nameB}
                            </p>
                            <span className="font-sport text-[11px] text-[var(--text-muted)] tabular-nums font-mono">
                              {m.entry_b?.pair_rating || m.entry_b?.player1?.rating || 500} Elo
                              {m.entry_b?.seed && ` • #${m.entry_b.seed}`}
                            </span>
                          </div>
                        </div>

                        {/* Score Boxes */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {setScores.map((s, idx) => (
                            <div
                              key={idx}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-sport font-black text-base tabular-nums border ${
                                s.side_b > s.side_a
                                  ? 'bg-[var(--accent-lime)] text-[#0B1020] border-[var(--accent-lime)]'
                                  : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--hairline)]'
                              }`}
                            >
                              {s.side_b}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <CatEmptyState
          catNumber={8}
          title="Draw Not Generated"
          message="No draw has been published for this category yet. Check back once registration concludes!"
          actionText={hasTournamentAccess ? 'Manage Draw in Portal' : undefined}
          actionHref={hasTournamentAccess ? `/manage/tournaments/${tournament.id}` : undefined}
        />
      )}
    </div>
  );
}
