'use client';

import Image from 'next/image';

import type { Tournament, Category, Match, Entry, Player } from '@/lib/types';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  Calendar,
  Edit2,
  ArrowLeft,
  Grid,
  List,
  Users,
  CheckCircle2,
  Trophy,
  Plus,
  Trash2,
  UserPlus,
  Loader2,
  AlertCircle,
  LogIn,
  Search,
  X,
} from 'lucide-react';
import { MatchRules } from '@/lib/match/rules';
import CatEmptyState from '@/components/CatEmptyState';
import AddPlayerModal from '@/components/AddPlayerModal';
import DoublesRegisterModal from '@/components/DoublesRegisterModal';

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const tournamentId = resolvedParams.id;
  const supabase = createClient();
  const { user, profile, hasTournamentAccess, managedTournamentIds } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userRegisteredCatIds, setUserRegisteredCatIds] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'round' | 'bracket'>('round');
  const [activeTab, setActiveTab] = useState<'matches' | 'players'>('matches');

  // Modals & Action Feedback State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Inline assign partner state
  const [assigningEntryId, setAssigningEntryId] = useState<string | null>(null);
  const [assignQuery, setAssignQuery] = useState('');
  const [assignFoundPlayer, setAssignFoundPlayer] = useState<Player | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Access check: Owner, Admin, or Tournament Manager
  const isOwnerOrManager =
    !!profile?.is_admin ||
    managedTournamentIds.includes(tournamentId) ||
    (!!tournament?.created_by && tournament.created_by === user?.id);

  const getAuthHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    };
  }, [supabase]);

  // Load category data
  const loadCategoryData = useCallback(async () => {
    if (!selectedCategoryId) return;

    // 1. Fetch confirmed entries
    const { data: entriesData } = await supabase
      .from('entries')
      .select(`
        id, category_id, seed, pair_rating, is_solo,
        player1:profiles!entries_player1_id_fkey(id, username, name, avatar_id, rating, gender, level),
        player2:profiles!entries_player2_id_fkey(id, username, name, avatar_id, rating, gender, level)
      `)
      .eq('category_id', selectedCategoryId)
      .order('seed', { ascending: true, nullsFirst: false });

    if (entriesData) {
      setEntries(entriesData as unknown as Entry[]);
    }

    // 2. Fetch matches
    const { data: matchesData } = await supabase
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

    if (matchesData) {
      setMatches(matchesData as unknown as Match[]);
      if (matchesData.length > 0) {
        const inProgressMatch = matchesData.find((m) => m.status === 'in_progress');
        setSelectedRound(inProgressMatch ? inProgressMatch.round : 1);
      }
    }
  }, [selectedCategoryId, supabase]);

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
          let initialCatId = cats[0].id;

          if (user) {
            const catIds = cats.map((c) => c.id);
            const { data: userEnts } = await supabase
              .from('entries')
              .select('category_id')
              .in('category_id', catIds)
              .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);
            if (userEnts && userEnts.length > 0) {
              const regIds = userEnts.map((e) => e.category_id);
              setUserRegisteredCatIds(regIds);
              initialCatId = regIds[0];
            }
          }

          setSelectedCategoryId(initialCatId);
        }
      } catch (err) {
        console.error('Error loading tournament:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadTournament();
  }, [tournamentId, supabase, user]);

  // 2. Load matches & entries for selected category & setup Realtime
  useEffect(() => {
    if (!selectedCategoryId) return;

    loadCategoryData();

    const channel = supabase
      .channel(`tourney-cat-${selectedCategoryId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `category_id=eq.${selectedCategoryId}`,
        },
        () => {
          loadCategoryData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entries',
          filter: `category_id=eq.${selectedCategoryId}`,
        },
        () => {
          loadCategoryData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCategoryId, supabase, loadCategoryData]);

  // Manager: Add player/pair
  const handleAddPlayer = async (player1Id: string, player2Id?: string | null, isSolo = false) => {
    setActionError(null);
    setActionSuccess(null);
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        categoryId: selectedCategoryId,
        player1Id,
        player2Id: player2Id || null,
        isSolo,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add entry');
    }
    setActionSuccess('Player added to category successfully.');
    await loadCategoryData();
  };

  // Manager / Self: Delete entry
  const handleDeleteEntry = async (entry: Entry) => {
    const isMe = user && (entry.player1?.id === user.id || entry.player2?.id === user.id);
    const p1Name = entry.player1?.name || entry.player1?.username || 'this entry';
    const confirmMsg =
      isMe && !isOwnerOrManager
        ? 'Are you sure you want to withdraw from this category?'
        : `Are you sure you want to remove ${p1Name} from this category?`;

    if (!confirm(confirmMsg)) return;

    setActionError(null);
    setActionSuccess(null);
    setIsActionLoading(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tournaments/${tournamentId}/entries?entryId=${entry.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove entry');
      }

      setActionSuccess(isMe && !isOwnerOrManager ? 'Withdrawn successfully.' : 'Player removed successfully.');
      if (isMe) {
        setUserRegisteredCatIds((prev) => prev.filter((id) => id !== selectedCategoryId));
      }
      await loadCategoryData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Player: Self-register
  const handleSelfRegister = async (isSolo = true, partnerId?: string | null) => {
    if (!user) return;
    setActionError(null);
    setActionSuccess(null);
    setIsActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          player1Id: user.id,
          player2Id: partnerId || null,
          isSolo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register');
      }
      setUserRegisteredCatIds((prev) => [...prev, selectedCategoryId]);
      setActionSuccess('You have successfully registered for this category!');
      await loadCategoryData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Search partner inline for solo doubles entry
  const handleSearchInlinePartner = async (e: React.FormEvent, targetEntry: Entry) => {
    e.preventDefault();
    const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
    if (!assignQuery.trim() || !selectedCategory) return;
    setAssignLoading(true);
    setAssignError('');
    setAssignFoundPlayer(null);

    try {
      const clean = assignQuery.trim().toLowerCase().replace('@', '');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, name, gender, avatar_id, rating, level')
        .eq('username', clean)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setAssignError(`No player found with username @${clean}`);
        return;
      }

      const p = data as unknown as Player;

      if (p.id === targetEntry.player1?.id) {
        setAssignError('Partner cannot be the same as Player 1.');
        return;
      }

      if (selectedCategory.gender !== 'mixed' && p.gender !== selectedCategory.gender) {
        setAssignError(`@${p.username} is ${p.gender}, but this category requires ${selectedCategory.gender}.`);
        return;
      }

      if (selectedCategory.gender === 'mixed' && targetEntry.player1 && p.gender === targetEntry.player1.gender) {
        setAssignError('Mixed doubles requires one boy and one girl.');
        return;
      }

      const alreadyIn = entries.some((ent) => ent.player1?.id === p.id || ent.player2?.id === p.id);
      if (alreadyIn) {
        setAssignError(`@${p.username} is already registered in this category.`);
        return;
      }

      setAssignFoundPlayer(p);
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Failed to search partner');
    } finally {
      setAssignLoading(false);
    }
  };

  // Confirm inline partner assignment
  const handleConfirmAssignPartner = async (entryId: string) => {
    if (!assignFoundPlayer) return;
    setAssignLoading(true);
    setAssignError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          entryId,
          player2Id: assignFoundPlayer.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign partner');
      }

      setActionSuccess('Partner assigned successfully!');
      setAssigningEntryId(null);
      setAssignFoundPlayer(null);
      setAssignQuery('');
      await loadCategoryData();
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign partner');
    } finally {
      setAssignLoading(false);
    }
  };

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
          {categories.map((cat) => {
            const isUserInCat = userRegisteredCatIds.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`tap-target px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 ${
                  selectedCategoryId === cat.id
                    ? 'btn-lime font-black shadow-md shadow-[rgba(198,255,61,0.2)]'
                    : 'bg-[var(--surface-raised)] border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <span>{cat.name}</span>
                {isUserInCat && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      selectedCategoryId === cat.id ? 'bg-[#0B1020]' : 'bg-[var(--accent-lime)] glow-lime'
                    }`}
                    title="You are registered in this category"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback Alert Banner */}
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-400 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-400 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* User Registration Status / Join Banner */}
      {(() => {
        const myEntry = entries.find(
          (e) => e.player1?.id === user?.id || e.player2?.id === user?.id
        );

        if (myEntry) {
          const isDoubles = selectedCategory?.type === 'doubles' || !!myEntry.player2;
          const myPartner = isDoubles
            ? myEntry.player1?.id === user?.id
              ? myEntry.player2
              : myEntry.player1
            : null;

          return (
            <div className="p-4 rounded-2xl bg-[rgba(198,255,61,0.12)] border border-[rgba(198,255,61,0.35)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-[rgba(198,255,61,0.05)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--accent-lime)] text-[#0B1020] flex items-center justify-center font-black shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[#0B1020]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-[var(--accent-ink)] uppercase tracking-wide">
                      You are registered in this tournament
                    </p>
                    {myEntry.seed && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-lime)] text-[#0B1020] font-black">
                        Seed #{myEntry.seed}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Category: <strong className="text-[var(--text-main)]">{selectedCategory?.name}</strong>
                    {isDoubles && (
                      <>
                        {' • '}
                        {myPartner ? (
                          <>Partner: <strong className="text-[var(--text-main)]">{myPartner.name}</strong> (@{myPartner.username})</>
                        ) : (
                          <span className="text-amber-400 font-bold">Solo Entry • Waiting for Partner Assignment</span>
                        )}
                      </>
                    )}
                    {' • '}Rating: {myEntry.pair_rating || profile?.rating || 500} Elo
                    {matches.length === 0 ? ' • Waiting for tournament draw to be published' : ' • Draw is live! Check your match below.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-[var(--surface-raised)] text-[var(--accent-ink)] border border-[var(--accent-lime)]">
                  {isDoubles && !myPartner ? 'Solo Player' : 'Confirmed Team'}
                </span>
                {tournament.status === 'draft' && matches.length === 0 && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => handleDeleteEntry(myEntry)}
                    className="tap-target px-3 py-1 rounded-xl text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all"
                    title="Withdraw your entry"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          );
        }

        // User is NOT registered in this category: show registration invite if tournament in draft
        if (tournament.status === 'draft' && matches.length === 0) {
          if (user) {
            return (
              <div className="p-4 rounded-2xl bg-[rgba(198,255,61,0.07)] border border-[rgba(198,255,61,0.3)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-[rgba(198,255,61,0.04)]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--accent-ink)] uppercase tracking-wide">
                      Compete in {selectedCategory?.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-raised)] border border-[var(--hairline)] font-mono text-[var(--text-muted)]">
                      Your Rating: {profile?.rating || 500} Elo
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Register now to participate in this category and compete on the leaderboard.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedCategory?.type === 'doubles' ? (
                    <>
                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => handleSelfRegister(true)}
                        className="tap-target px-3.5 py-1.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] text-xs font-bold text-[var(--text-main)] transition-all"
                      >
                        Join Solo (Need Partner)
                      </button>
                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => setIsRegisterModalOpen(true)}
                        className="tap-target px-4 py-1.5 rounded-xl btn-lime text-xs font-black shadow-md shadow-[rgba(198,255,61,0.2)] hover:scale-102 transition-all"
                      >
                        Join with Partner
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={() => handleSelfRegister(true)}
                      className="tap-target px-4 py-2 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-md shadow-[rgba(198,255,61,0.2)] hover:scale-102 transition-all"
                    >
                      {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Register for Category</span>
                    </button>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div className="p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-[var(--text-main)] uppercase tracking-wide">
                  Want to participate in {selectedCategory?.name}?
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Log in or create an account to register for this tournament.
                </p>
              </div>
              <Link
                href={`/login?redirect=/tournaments/${tournamentId}`}
                className="tap-target px-3.5 py-1.5 rounded-xl btn-lime text-xs font-black flex items-center gap-1 shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log in to Register</span>
              </Link>
            </div>
          );
        }

        return null;
      })()}

      {/* Sub-Navigation: Matches vs Registered Players */}
      <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-2">
        <div className="flex items-center gap-2">
          {matches.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('matches')}
              className={`tap-target px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'matches'
                  ? 'bg-[var(--accent-lime-muted)] text-[var(--accent-ink)] border border-[var(--accent-lime)] font-black'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Matches ({matches.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('players')}
            className={`tap-target px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'players' || matches.length === 0
                ? 'bg-[var(--accent-lime-muted)] text-[var(--accent-ink)] border border-[var(--accent-lime)] font-black'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Registered Players ({entries.length})</span>
          </button>
        </div>

        {/* Desktop View Switcher (Round List vs Wide Bracket) */}
        {matches.length > 0 && activeTab === 'matches' && roundsList.length > 1 && (
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
      </div>

      {/* Tab Content: Registered Players or Matches */}
      {activeTab === 'players' || matches.length === 0 ? (
        entries.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between court-card-raised p-3 rounded-2xl flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--accent-ink)]" />
                <span className="font-sport font-black text-sm uppercase tracking-wider text-[var(--text-main)]">
                  Registered Roster ({entries.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] font-mono hidden sm:inline">
                  {selectedCategory?.name}
                </span>
                {isOwnerOrManager && (
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="tap-target px-3.5 py-1.5 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-md shadow-[rgba(198,255,61,0.2)] hover:scale-102 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Player {selectedCategory?.type === 'doubles' ? '/ Team' : ''}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entries.map((entry) => {
                const isMe =
                  user &&
                  (entry.player1?.id === user.id || entry.player2?.id === user.id);
                const isDoubles = selectedCategory?.type === 'doubles' || !!entry.player2;
                const isAssigningThis = assigningEntryId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className={`court-card p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                      isMe
                        ? 'border-[var(--accent-lime)] ring-1 ring-[var(--accent-lime)] bg-[rgba(198,255,61,0.06)] shadow-md'
                        : 'hover:border-[var(--hairline-strong)]'
                    }`}
                  >
                    {isMe && (
                      <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[var(--accent-lime)] glow-lime" />
                    )}

                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <Image
                            width={96}
                            height={96}
                            src={`/avatars/${entry.player1?.avatar_id || 'cat-01'}.svg`}
                            alt="Avatar"
                            className="w-11 h-11 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)]"
                          />
                          {isDoubles && (
                            entry.player2 ? (
                              <Image
                                width={96}
                                height={96}
                                src={`/avatars/${entry.player2?.avatar_id || 'cat-02'}.svg`}
                                alt="Partner Avatar"
                                className="w-7 h-7 rounded-full border border-[var(--surface)] bg-[var(--surface-raised)] absolute -bottom-1 -right-1"
                              />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full border border-dashed border-amber-400/60 bg-[var(--surface)] text-[10px] text-amber-400 font-bold flex items-center justify-center absolute -bottom-1 -right-1"
                                title="Waiting for partner"
                              >
                                ?
                              </div>
                            )
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-black truncate ${isMe ? 'text-[var(--accent-ink)]' : 'text-[var(--text-main)]'}`}>
                              {isDoubles
                                ? entry.player2
                                  ? `${entry.player1?.name || 'Player 1'} & ${entry.player2?.name || 'Player 2'}`
                                  : `${entry.player1?.name || entry.player1?.username || 'Player 1'}`
                                : entry.player1?.name || entry.player1?.username || 'Player'}
                            </p>
                            {isDoubles && !entry.player2 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/30">
                                Needs Partner
                              </span>
                            )}
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[var(--accent-lime)] text-[#0B1020]">
                                YOU
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                            <span className="font-mono text-[11px] truncate">
                              @{entry.player1?.username}
                              {isDoubles && entry.player2 && ` & @${entry.player2.username}`}
                            </span>
                            <span className="font-sport font-bold text-[11px] text-[var(--text-muted)] tabular-nums">
                              {entry.pair_rating || entry.player1?.rating || 500} Elo
                            </span>
                            {entry.player1?.level && (
                              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] opacity-80">
                                • {entry.player1.level}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Seed, Status & Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          {entry.seed ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black font-sport bg-[var(--accent-lime-muted)] text-[var(--accent-ink)] border border-[var(--accent-lime)]">
                              Seed #{entry.seed}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">
                              Unseeded
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed
                          </span>
                        </div>

                        {/* Owner / Manager / Self Actions */}
                        {(isOwnerOrManager || (isMe && tournament.status === 'draft' && matches.length === 0)) && (
                          <div className="flex items-center gap-1 ml-2 border-l border-[var(--hairline)] pl-2">
                            {isDoubles && !entry.player2 && (isOwnerOrManager || isMe) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssigningEntryId(isAssigningThis ? null : entry.id);
                                  setAssignQuery('');
                                  setAssignFoundPlayer(null);
                                  setAssignError('');
                                }}
                                className={`tap-target px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                  isAssigningThis
                                    ? 'bg-[var(--accent-lime)] text-[#0B1020]'
                                    : 'bg-[var(--surface-raised)] border border-[var(--hairline)] hover:border-[var(--accent-lime)] text-[var(--accent-ink)]'
                                }`}
                                title="Assign Partner"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline text-[10px]">Assign</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleDeleteEntry(entry)}
                              className="tap-target p-1.5 rounded-lg text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title={isOwnerOrManager ? 'Delete Player / Entry' : 'Withdraw from Category'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Assign Partner Form */}
                    {isAssigningThis && (
                      <div className="mt-3 p-3 rounded-2xl bg-[var(--surface)] border border-[var(--accent-lime)] space-y-2.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase text-[var(--text-muted)]">
                            Assign Partner for {entry.player1?.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAssigningEntryId(null)}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                          >
                            Cancel
                          </button>
                        </div>

                        <form onSubmit={(e) => handleSearchInlinePartner(e, entry)} className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)]">
                              @
                            </span>
                            <input
                              type="text"
                              value={assignQuery}
                              onChange={(e) => setAssignQuery(e.target.value)}
                              placeholder="search partner username"
                              className="w-full pl-6 pr-3 py-1.5 text-xs rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={assignLoading || !assignQuery.trim()}
                            className="px-3 py-1.5 rounded-xl btn-lime text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                          >
                            {assignLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                            <span>Find</span>
                          </button>
                        </form>

                        {assignError && (
                          <p className="text-[11px] text-rose-400 font-medium">{assignError}</p>
                        )}

                        {assignFoundPlayer && (
                          <div className="p-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Image
                                width={32}
                                height={32}
                                src={`/avatars/${assignFoundPlayer.avatar_id || 'cat-02'}.svg`}
                                alt="Partner"
                                className="w-8 h-8 rounded-full border border-[var(--hairline)]"
                              />
                              <div>
                                <p className="text-xs font-black text-[var(--text-main)]">{assignFoundPlayer.name}</p>
                                <p className="text-[10px] text-[var(--text-muted)] font-mono">
                                  @{assignFoundPlayer.username} • {assignFoundPlayer.rating} Elo
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={assignLoading}
                              onClick={() => handleConfirmAssignPartner(entry.id)}
                              className="px-3 py-1 rounded-xl btn-lime text-[11px] font-black"
                            >
                              {assignLoading ? 'Assigning...' : 'Confirm'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <CatEmptyState
            catNumber={8}
            title="No Players Registered Yet"
            message="No players have registered or been added to this category yet."
            actionText={isOwnerOrManager ? '+ Add Player / Team' : (user ? 'Register for Category' : undefined)}
            onActionClick={
              isOwnerOrManager
                ? () => setIsAddModalOpen(true)
                : (user ? () => handleSelfRegister(true) : undefined)
            }
          />
        )
      ) : roundsList.length > 0 ? (
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

      {/* Modals */}
      {selectedCategory && (
        <>
          <AddPlayerModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            category={selectedCategory}
            existingEntries={entries}
            onAdd={handleAddPlayer}
          />

          {user && profile && (
            <DoublesRegisterModal
              isOpen={isRegisterModalOpen}
              onClose={() => setIsRegisterModalOpen(false)}
              category={selectedCategory}
              userProfile={profile}
              existingEntries={entries}
              onRegister={async (partnerId) => {
                await handleSelfRegister(false, partnerId);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
