'use client';

import Image from 'next/image';

import type { Tournament, Category, Entry, Match, Player } from '@/lib/types';

import { errorMessage } from '@/lib/errors';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Swords, UserPlus, Play, CheckCircle2, AlertCircle, Loader2, Edit2, ExternalLink, ArrowLeft, Sparkles, Maximize2, Search } from 'lucide-react';
import { generateKnockoutDraw, type KnockoutDrawResult, type KnockoutMatchNode } from '@/lib/draws/knockout';
import { SetScore, MatchRules } from '@/lib/match/rules';
import { evaluateSheetMatch, formatMatchupInfo } from '@/lib/match/scoring';
import { buildKnockoutRows } from '@/lib/draws/persist';
import { finalizeMatchResult } from '@/lib/match/finalize';
import CatEmptyState from '@/components/CatEmptyState';

export default function ManageTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const tournamentId = resolvedParams.id;
  const { user } = useAuth();
  const supabase = createClient();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add player form
  const [searchUsername, setSearchUsername] = useState('');
  const [foundPlayer, setFoundPlayer] = useState<Player | null>(null);
  const [searchError, setSearchError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Draw generation state
  const [drawPreview, setDrawPreview] = useState<KnockoutDrawResult | null>(null);
  const [isPublishingDraw, setIsPublishingDraw] = useState(false);
  const [revealKey, setRevealKey] = useState(0); // For re-triggering reveal animation

  // Quick Score Modal State
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [modalScores, setModalScores] = useState<SetScore[]>([]);
  const [isSavingModal, setIsSavingModal] = useState(false);
  const [modalError, setModalError] = useState('');

  // Fetch on route changes and ignore responses from an earlier route.
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [tourney, cats] = await Promise.all([
          supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
          supabase.from('categories').select('*').eq('tournament_id', tournamentId),
        ]);
        if (!active) return;
        if (tourney.error) throw tourney.error;
        if (cats.error) throw cats.error;
        setTournament(tourney.data as Tournament);
        setCategories(cats.data as Category[]);
        setSelectedCategoryId(cats.data?.[0]?.id ?? '');
      } catch (error) {
        if (active) setSearchError(errorMessage(error, 'Unable to load tournament.'));
      } finally { if (active) setIsLoading(false); }
    }
    void loadData();
    return () => { active = false; };
  }, [supabase, tournamentId]);

  // Load category entries and matches
  const loadCategoryData = useCallback(async () => {
    if (!selectedCategoryId) return { entries: [], matches: [] };

    // Load entries
    const { data: ent } = await supabase
      .from('entries')
      .select(`
        id, seed, pair_rating, is_solo,
        player1:profiles!entries_player1_id_fkey(id, username, name, avatar_id, rating, gender),
        player2:profiles!entries_player2_id_fkey(id, username, name, avatar_id, rating, gender)
      `)
      .eq('category_id', selectedCategoryId)
      .order('seed', { ascending: true, nullsFirst: false });



    // Load matches
    const { data: m } = await supabase
      .from('matches')
      .select(`
        id, round, round_name, slot, status, court, rules_snapshot, set_scores, winner_id, next_match_id,
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
      .eq('category_id', selectedCategoryId)
      .order('round', { ascending: true })
      .order('slot', { ascending: true });

    return { entries: (ent ?? []) as unknown as Entry[], matches: (m ?? []) as unknown as Match[] };
  }, [supabase, selectedCategoryId]);

  useEffect(() => {
    let active = true;
    loadCategoryData().then(data => {
      if (active) { setEntries(data.entries); setMatches(data.matches); }
    }).catch(error => { if (active) setSearchError(errorMessage(error, 'Unable to load category.')); });
    return () => { active = false; };
  }, [loadCategoryData]);

  const refreshCategoryData = async () => {
    const data = await loadCategoryData();
    setEntries(data.entries); setMatches(data.matches);
  };

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  // Search player by username and validate gender
  const handleSearchPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim() || !selectedCategory) return;
    setSearchError('');
    setFoundPlayer(null);

    const usernameClean = searchUsername.trim().toLowerCase().replace('@', '');

    const { data: p } = await supabase
      .from('profiles')
      .select('id, username, name, gender, avatar_id, rating, level')
      .eq('username', usernameClean)
      .maybeSingle();

    if (!p) {
      setSearchError(`No player found with username @${usernameClean}`);
      return;
    }

    if (selectedCategory.gender !== 'mixed' && p.gender !== selectedCategory.gender) {
      setSearchError(
        `Player @${usernameClean} is registered as ${p.gender}, but this category requires ${selectedCategory.gender}.`
      );
      return;
    }

    const alreadyIn = entries.some(
      (e) => e.player1?.id === p.id || e.player2?.id === p.id
    );
    if (alreadyIn) {
      setSearchError(`@${usernameClean} is already registered in this category.`);
      return;
    }

    setFoundPlayer(p as unknown as Player);
  };

  // Add player entry
  const handleAddPlayer = async () => {
    if (!foundPlayer || !selectedCategory || !tournament || !user) return;
    setIsAdding(true);
    setSearchError('');

    try {
      const nextSeed = entries.length + 1;

      const { error: insErr } = await supabase.from('entries').insert({
        category_id: selectedCategory.id,
        player1_id: foundPlayer.id,
        seed: nextSeed,
        pair_rating: foundPlayer.rating,
        is_solo: true,
      });

      if (insErr) throw insErr;

      await supabase.from('audit_log').insert({
        tournament_id: tournament.id,
        action: 'entry_added',
        actor_id: user.id,
        details: {
          categoryName: selectedCategory.name,
          playerUsername: foundPlayer.username,
        },
      });

      setFoundPlayer(null);
      setSearchUsername('');
      await refreshCategoryData();
    } catch (err: unknown) {
      setSearchError(errorMessage(err, 'Failed to add entry.'));
    } finally {
      setIsAdding(false);
    }
  };

  // Generate Knockout Draw Preview with Reveal animation
  const handleGenerateDraw = () => {
    if (entries.length < 2) {
      setSearchError('Need at least 2 entries to generate a draw.');
      return;
    }

    try {
      const participants = entries.map((e) => ({
        id: e.id,
        name: e.player1?.name || 'TBD',
        rating: e.pair_rating || e.player1?.rating || 1000,
        seed: e.seed,
        avatar_id: e.player1?.avatar_id,
        username: e.player1?.username,
      }));

      const draw = generateKnockoutDraw(participants);
      setDrawPreview(draw);
      setRevealKey((prev) => prev + 1); // Triggers the slide-in CSS keyframes
    } catch (err: unknown) {
      setSearchError(errorMessage(err, 'Error generating draw.'));
    }
  };

  // Publish Draw to DB
  const handlePublishDraw = async () => {
    if (!drawPreview || !selectedCategory || !tournament || !user) return;
    setIsPublishingDraw(true);

    try {
      const matchRulesSnapshot = selectedCategory.rules_override || tournament.rules;

      if (matches.some(match => match.status === 'completed' || match.status === 'in_progress')) throw new Error('A draw cannot be replaced once scoring has started.');
      const rows = buildKnockoutRows(drawPreview, selectedCategory.id, matchRulesSnapshot, () => crypto.randomUUID());
      const { error: deleteError } = await supabase.from('matches').delete().eq('category_id', selectedCategory.id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from('matches').insert(rows);
      if (insertError) throw insertError;

      await supabase
        .from('categories')
        .update({ status: 'in_progress' })
        .eq('id', selectedCategory.id);

      await supabase.from('audit_log').insert({
        tournament_id: tournament.id,
        action: 'draw_published',
        actor_id: user.id,
        details: {
          categoryName: selectedCategory.name,
          bracketSize: drawPreview.bracketSize,
          roundsCount: drawPreview.roundsCount,
        },
      });

      setDrawPreview(null);
      await refreshCategoryData();
    } catch (err: unknown) {
      setSearchError(errorMessage(err, 'Failed to publish draw.'));
    } finally {
      setIsPublishingDraw(false);
    }
  };

  // Quick Score Modal open handler
  const openQuickScore = (m: Match, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScoringMatch(m);
    setModalError('');

    const existing = (m.set_scores as SetScore[]) || [];
    if (existing.length > 0) {
      setModalScores(existing);
    } else {
      const matchRules = (m.rules_snapshot as MatchRules) || selectedCategory?.rules_override || tournament?.rules;
      const numSets = matchRules?.sets || 3;
      const initial: SetScore[] = [];
      for (let i = 1; i <= numSets; i++) {
        initial.push({ set: i, side_a: 0, side_b: 0 });
      }
      setModalScores(initial);
    }
  };

  const handleModalScoreChange = (setIdx: number, side: 'a' | 'b', val: string) => {
    const num = val === '' ? 0 : parseInt(val, 10);
    const updated = modalScores.map(set => ({ ...set }));
    if (side === 'a') {
      updated[setIdx].side_a = isNaN(num) ? 0 : Math.max(0, num);
    } else {
      updated[setIdx].side_b = isNaN(num) ? 0 : Math.max(0, num);
    }
    setModalScores(updated);
  };

  const handleSaveModalScore = async () => {
    if (!scoringMatch || !user || !tournament || !selectedCategory || !scoringMatch.entry_a || !scoringMatch.entry_b) return;
    setIsSavingModal(true);
    setModalError('');

    try {
      const validScores = modalScores.filter((s) => s.side_a > 0 || s.side_b > 0);
      if (validScores.length === 0) {
        throw new Error('Please enter scores before confirming.');
      }

      const matchRules = (scoringMatch.rules_snapshot as MatchRules) || selectedCategory.rules_override || tournament.rules;
      const evalResult = evaluateSheetMatch(matchRules, validScores);
      if (!evalResult.isFinished || !evalResult.winner) {
        throw new Error('Please enter winning scores for the set/match according to rules.');
      }

      await finalizeMatchResult({
        supabase,
        matchId: scoringMatch.id,
        category: {
          id: selectedCategory.id,
          type: selectedCategory.type,
          tournament: { id: tournament.id },
        },
        entryA: scoringMatch.entry_a,
        entryB: scoringMatch.entry_b,
        rules: matchRules,
        setScores: validScores,
        winnerSide: evalResult.winner,
        court: scoringMatch.court,
        actorId: user.id,
        nextMatchId: scoringMatch.next_match_id,
        matchSlot: scoringMatch.slot,
      });

      setScoringMatch(null);
      await refreshCategoryData();
    } catch (err: unknown) {
      setModalError(errorMessage(err, 'Failed to save scores.'));
    } finally {
      setIsSavingModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-8 w-44 rounded-xl skeleton-box" />
        <div className="h-40 rounded-3xl skeleton-box" />
      </div>
    );
  }

  if (!tournament) return <div role="alert" className="court-card p-8">Tournament unavailable.</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="court-card p-5 rounded-3xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/manage"
              className="tap-target w-9 h-9 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-ink)]">
                Tournament Director
              </span>
              <h1 className="font-sport font-black text-2xl md:text-3xl text-[var(--text-main)] uppercase tracking-tight">
                {tournament?.name}
              </h1>
            </div>
          </div>

          <Link
            href={`/tournaments/${tournament.id}`}
            className="tap-target px-3.5 py-1.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 transition-colors"
          >
            <span>Public Arena</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategoryId(cat.id); setDrawPreview(null); }}
              className={`tap-target px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
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

      {searchError && (
        <div className="p-3.5 rounded-2xl bg-[rgba(255,92,122,0.15)] border border-[rgba(255,92,122,0.3)] text-[var(--color-loss)] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Section 1: Register Player */}
      <div className="court-card p-5 rounded-3xl space-y-3">
        <h3 className="font-sport font-extrabold text-sm text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[var(--accent-ink)]" />
          Register Player to Category
        </h3>

        <form onSubmit={handleSearchPlayer} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              placeholder="Search username (e.g. arjun_smash, meera_k)..."
              className="w-full tap-target pl-9 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
          </div>
          <button
            type="submit"
            className="tap-target px-4 rounded-xl btn-lime text-xs font-black shrink-0"
          >
            Find
          </button>
        </form>

        {foundPlayer && (
          <div className="p-3.5 rounded-2xl bg-[var(--surface-raised)] border border-[var(--accent-lime)] flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--accent-lime)]">
                <Image width={96} height={96}
                  src={`/avatars/${foundPlayer.avatar_id || 'cat-01'}.svg`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-extrabold text-[var(--text-main)]">
                  {foundPlayer.name}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  @{foundPlayer.username} • {foundPlayer.rating} Elo ({foundPlayer.gender})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddPlayer}
              disabled={isAdding}
              className="tap-target px-4 py-2 rounded-xl btn-lime text-xs font-black shadow-md shadow-[rgba(198,255,61,0.2)] disabled:opacity-50"
            >
              {isAdding ? 'Adding...' : 'Confirm Entry'}
            </button>
          </div>
        )}
      </div>

      {/* Section 2: Registered Entries */}
      <div className="court-card p-5 rounded-3xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-sport font-extrabold text-sm text-[var(--text-main)] uppercase tracking-wider">
              Registered Entries ({entries.length})
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Sorted by seed / rating for knockout placement
            </p>
          </div>

          <button
            onClick={handleGenerateDraw}
            disabled={entries.length < 2}
            className="tap-target px-4 py-2 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-md shadow-[rgba(198,255,61,0.2)] disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Generate Draw</span>
          </button>
        </div>

        {entries.length === 0 ? (
          <CatEmptyState
            catNumber={7}
            title="No Entries Added"
            message="Search and register players by username above to fill this bracket."
          />
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)]"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[var(--surface)] border border-[var(--hairline)] flex items-center justify-center text-[10px] font-mono font-bold text-[var(--text-muted)]">
                    #{idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--hairline)]">
                    <Image width={96} height={96}
                      src={`/avatars/${entry.player1?.avatar_id || 'cat-01'}.svg`}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-main)] block">
                      {entry.player1?.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      @{entry.player1?.username}
                    </span>
                  </div>
                </div>

                <span className="font-sport text-sm font-black text-[var(--accent-ink)] font-mono tabular-nums">
                  {entry.pair_rating || entry.player1?.rating} Elo
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Screen 9: Draw Preview (Bracket revealing with seeds sliding into place) */}
      {drawPreview && (
        <div
          key={revealKey}
          className="court-card-raised p-5 rounded-3xl border-2 border-[var(--accent-lime)] bg-gradient-to-b from-[var(--surface-raised)] to-[var(--surface)] shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[rgba(198,255,61,0.2)] text-[var(--accent-ink)] border border-[var(--accent-lime)] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Draw Reveal Preview
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {drawPreview.bracketSize} Bracket • {drawPreview.byesCount} Byes
                </span>
              </div>
              <h3 className="font-sport font-black text-lg text-[var(--text-main)] uppercase tracking-tight mt-1">
                Seeded Knockout Bracket
              </h3>
            </div>

            <button
              onClick={handlePublishDraw}
              disabled={isPublishingDraw}
              className="tap-target px-4 py-2 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-lg shadow-[rgba(198,255,61,0.25)] disabled:opacity-50"
            >
              {isPublishingDraw ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publish Draw</span>
                </>
              )}
            </button>
          </div>

          {/* Bracket slots with seeds sliding into place */}
          <div className="space-y-3">
            <p className="text-[11px] text-[var(--text-muted)] italic">
              Seeded matchups, ready for review.
            </p>

            <div className="space-y-2.5">
              {drawPreview.rounds[0].matches.map((m: KnockoutMatchNode, mIdx: number) => {
                // Staggered slide-in animation delay
                const delayStyle = {
                  animationDelay: `${Math.min(mIdx * 55, 330)}ms`,
                  animationFillMode: 'both' as const,
                };

                return (
                  <div
                    key={m.slot}
                    style={delayStyle}
                    className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] transition-all animate-in slide-in-from-left-6 duration-500 flex flex-col md:flex-row md:items-center justify-between gap-2 relative overflow-hidden"
                  >
                    {/* Subtle court line connector marker */}
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--accent-lime)]" />

                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase">
                        Slot #{m.slot}
                      </span>
                      {m.isBye && (
                        <span className="text-[9px] font-bold text-[var(--accent-win)] bg-[rgba(61,220,151,0.1)] border border-[rgba(61,220,151,0.2)] px-2 py-0.5 rounded-full">
                          BYE ADVANCES
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 flex-1 md:px-4">
                      {/* Side A */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
                        <span className="w-5 h-5 rounded bg-[var(--surface)] text-[10px] font-mono font-bold flex items-center justify-center text-[var(--accent-ink)]">
                          {m.entryA?.seed ? `#${m.entryA.seed}` : '-'}
                        </span>
                        <span className="text-xs font-bold text-[var(--text-main)] truncate">
                          {m.entryA ? m.entryA.name : 'BYE'}
                        </span>
                      </div>

                      {/* Side B */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
                        <span className="w-5 h-5 rounded bg-[var(--surface)] text-[10px] font-mono font-bold flex items-center justify-center text-[var(--accent-ink)]">
                          {m.entryB?.seed ? `#${m.entryB.seed}` : '-'}
                        </span>
                        <span className="text-xs font-bold text-[var(--text-main)] truncate">
                          {m.entryB ? m.entryB.name : 'BYE'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Published Matches & Score Entry */}
      {matches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-sport font-extrabold text-sm text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
              <Swords className="w-4 h-4 text-[var(--accent-ink)]" />
              Published Matches & Scores
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              Tap match for Scoreboard or Quick Score
            </span>
          </div>

          <div className="space-y-2.5">
            {matches.map((m) => {
              const matchup = formatMatchupInfo(
                selectedCategory?.type || 'singles',
                m.entry_a,
                m.entry_b
              );
              const scores = (m.set_scores || []) as Array<{ set: number; side_a: number; side_b: number }>;
              const isFinished = m.status === 'completed';
              const isLive = m.status === 'in_progress';
              const isWinnerA = isFinished && m.winner_id === m.entry_a?.id;
              const isWinnerB = isFinished && m.winner_id === m.entry_b?.id;

              return (
                <div
                  key={m.id}
                  className="court-card p-4 rounded-2xl relative overflow-hidden group hover:border-[var(--accent-lime)] transition-all"
                >
                  {/* Winner Lime Side Bar */}
                  {isWinnerA && (
                    <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[var(--accent-lime)] glow-lime" />
                  )}
                  {isWinnerB && (
                    <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[var(--accent-lime)] glow-lime" />
                  )}

                  <div className="flex items-center justify-between text-xs mb-2.5">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      {m.round_name} • Match #{m.slot} {m.court ? `• ${m.court}` : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isFinished
                            ? 'bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)]'
                            : isLive
                            ? 'bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)] flex items-center gap-1'
                            : 'bg-[var(--surface-raised)] text-[var(--text-muted)]'
                        }`}
                      >
                        {isLive && <span className="live-dot" />}
                        {m.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* 2-Row Match Card with Tabular Score Boxes */}
                  <div className="space-y-1.5">
                    {/* Row A */}
                    <div
                      className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                        isWinnerA
                          ? 'bg-[rgba(198,255,61,0.1)] border border-[rgba(198,255,61,0.3)] font-bold'
                          : 'bg-[var(--surface-raised)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-[var(--hairline)]">
                          <Image width={96} height={96}
                            src={`/avatars/${m.entry_a?.player1?.avatar_id || 'cat-01'}.svg`}
                            alt="A"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-xs font-bold text-[var(--text-main)]">
                          {matchup.sideALabel}
                        </span>
                        {m.entry_a?.seed && (
                          <span className="text-[9px] font-mono px-1 rounded bg-[var(--surface)] text-[var(--accent-ink)]">
                            #{m.entry_a.seed}
                          </span>
                        )}
                        {isWinnerA && (
                          <span className="text-[9px] font-black uppercase text-[var(--accent-ink)] bg-[rgba(198,255,61,0.15)] px-1.5 py-0.5 rounded">
                            W
                          </span>
                        )}
                      </div>

                      {/* Score Boxes */}
                      <div className="flex items-center gap-1 font-sport font-black text-sm tabular-nums">
                        {scores.length > 0 ? (
                          scores.map((s, idx) => (
                            <span
                              key={idx}
                              className={`w-7 h-7 rounded flex items-center justify-center ${
                                s.side_a > s.side_b
                                  ? 'bg-[var(--accent-lime)] text-[#0B1020] font-black'
                                  : 'bg-[var(--surface)] text-[var(--text-muted)]'
                              }`}
                            >
                              {s.side_a}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--text-muted)] font-mono">-</span>
                        )}
                      </div>
                    </div>

                    {/* Row B */}
                    <div
                      className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                        isWinnerB
                          ? 'bg-[rgba(198,255,61,0.1)] border border-[rgba(198,255,61,0.3)] font-bold'
                          : 'bg-[var(--surface-raised)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-[var(--hairline)]">
                          <Image width={96} height={96}
                            src={`/avatars/${m.entry_b?.player1?.avatar_id || 'cat-02'}.svg`}
                            alt="B"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-xs font-bold text-[var(--text-main)]">
                          {matchup.sideBLabel}
                        </span>
                        {m.entry_b?.seed && (
                          <span className="text-[9px] font-mono px-1 rounded bg-[var(--surface)] text-[var(--accent-ink)]">
                            #{m.entry_b.seed}
                          </span>
                        )}
                        {isWinnerB && (
                          <span className="text-[9px] font-black uppercase text-[var(--accent-ink)] bg-[rgba(198,255,61,0.15)] px-1.5 py-0.5 rounded">
                            W
                          </span>
                        )}
                      </div>

                      {/* Score Boxes */}
                      <div className="flex items-center gap-1 font-sport font-black text-sm tabular-nums">
                        {scores.length > 0 ? (
                          scores.map((s, idx) => (
                            <span
                              key={idx}
                              className={`w-7 h-7 rounded flex items-center justify-center ${
                                s.side_b > s.side_a
                                  ? 'bg-[var(--accent-lime)] text-[#0B1020] font-black'
                                  : 'bg-[var(--surface)] text-[var(--text-muted)]'
                              }`}
                            >
                              {s.side_b}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--text-muted)] font-mono">-</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Quick Scoresheet or Full-Screen Scoreboard */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--hairline)] flex items-center justify-between">
                    <button
                      onClick={(e) => openQuickScore(m, e)}
                      className="tap-target px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[var(--accent-ink)]" />
                      <span>{isFinished ? 'Edit Score' : 'Scoresheet Entry'}</span>
                    </button>

                    <Link
                      href={`/manage/matches/${m.id}`}
                      className="tap-target px-3.5 py-1.5 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-md shadow-[rgba(198,255,61,0.15)] hover:scale-102 transition-all"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Scoreboard Mode</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Score Modal (Scoresheet Input) */}
      {scoringMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="court-card-raised p-6 rounded-3xl max-w-sm w-full space-y-4 border-2 border-[var(--accent-lime)] shadow-2xl">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-ink)]">
                Scoresheet Entry Mode
              </span>
              <h3 className="font-sport font-black text-xl text-[var(--text-main)] uppercase tracking-tight mt-0.5">
                {scoringMatch.round_name} • Match #{scoringMatch.slot}
              </h3>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-[rgba(255,92,122,0.15)] border border-[rgba(255,92,122,0.3)] text-[var(--color-loss)] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Set Scores Inputs */}
            <div className="space-y-3">
              {modalScores.map((score, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--hairline)] space-y-2"
                >
                  <span className="font-sport font-black text-xs text-[var(--text-muted)] uppercase tracking-wider">
                    Set {idx + 1}
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block truncate mb-1">
                        {scoringMatch.entry_a?.player1?.name || 'Side A'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="35"
                        value={score.side_a}
                        onChange={(e) => handleModalScoreChange(idx, 'a', e.target.value)}
                        className="w-full tap-target py-2 px-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] font-sport font-black text-xl text-center text-[var(--text-main)] focus:border-[var(--accent-lime)] focus:outline-none tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] block truncate mb-1">
                        {scoringMatch.entry_b?.player1?.name || 'Side B'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="35"
                        value={score.side_b}
                        onChange={(e) => handleModalScoreChange(idx, 'b', e.target.value)}
                        className="w-full tap-target py-2 px-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] font-sport font-black text-xl text-center text-[var(--text-main)] focus:border-[var(--accent-lime)] focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScoringMatch(null)}
                className="tap-target flex-1 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalScore}
                disabled={isSavingModal}
                className="tap-target flex-1 py-2.5 rounded-xl btn-lime text-xs font-black shadow-md shadow-[rgba(198,255,61,0.2)] disabled:opacity-50"
              >
                {isSavingModal ? 'Saving...' : 'Confirm Result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
