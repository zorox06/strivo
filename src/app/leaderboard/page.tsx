'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  Trophy,
  Search,
  Crown,
  Medal,
  Flame,
  ArrowUpDown,
  Filter,
  X,
  Users,
} from 'lucide-react';
import LoadError from '@/components/LoadError';
import CatEmptyState from '@/components/CatEmptyState';

interface LeaderboardPlayer {
  id: string;
  username: string;
  name: string;
  gender: 'boys' | 'girls';
  avatar_id: string;
  rating: number;
  peak_rating: number;
  matches_played: number;
  level: string;
  is_admin?: boolean;
}

type SortOption = 'rating' | 'peak' | 'matches' | 'name';

export default function LeaderboardPage() {
  const supabase = createClient();
  const { user } = useAuth();

  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [filterGender, setFilterGender] = useState<'all' | 'boys' | 'girls'>('all');
  const [filterLevel, setFilterLevel] = useState<
    'all' | 'beginner' | 'amateur' | 'intermediate' | 'advanced' | 'professional'
  >('all');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  // Load players from Supabase
  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      let query = supabase
        .from('profiles')
        .select('id, username, name, gender, avatar_id, rating, peak_rating, matches_played, level, is_admin')
        .order('rating', { ascending: false });

      if (filterGender !== 'all') {
        query = query.eq('gender', filterGender);
      }

      if (filterLevel !== 'all') {
        query = query.eq('level', filterLevel);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        setPlayers(data as LeaderboardPlayer[]);
      }
    } catch {
      setLoadError('Could not load leaderboard. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [filterGender, filterLevel, supabase]);

  useEffect(() => {
    loadLeaderboard();

    // Realtime listener for live rating adjustments
    const channel = supabase
      .channel('leaderboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          loadLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeaderboard, retryKey, supabase]);

  // Client-side filtering & sorting
  const processedPlayers = useMemo(() => {
    let result = [...players];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q)
      );
    }

    // Sort order
    result.sort((a, b) => {
      switch (sortBy) {
        case 'peak':
          return (b.peak_rating || b.rating) - (a.peak_rating || a.rating);
        case 'matches':
          return (b.matches_played || 0) - (a.matches_played || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
        default:
          return b.rating - a.rating;
      }
    });

    return result;
  }, [players, searchQuery, sortBy]);

  // Overall rank mapping
  const overallRankMap = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.rating - a.rating);
    const map = new Map<string, number>();
    sorted.forEach((p, idx) => map.set(p.id, idx + 1));
    return map;
  }, [players]);

  const top3 = processedPlayers.slice(0, 3);
  const remainingPlayers = processedPlayers.slice(3);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[var(--accent-ink)]" />
            <h1 className="font-sport font-black text-3xl text-[var(--text-main)] tracking-tight uppercase">
              Leaderboard
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Live chess-style ratings ladder starting from 500 Elo.
          </p>
        </div>

        {/* Total Player Counter */}
        <div className="px-3 py-1.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center gap-1.5 shrink-0">
          <Users className="w-3.5 h-3.5 text-[var(--accent-ink)]" />
          <span className="font-sport font-bold text-xs text-[var(--text-main)] tabular-nums">
            {players.length} {players.length === 1 ? 'Player' : 'Players'}
          </span>
        </div>
      </div>

      {/* Control Bar: Division Filter, Level Filter & Search */}
      <div className="space-y-2.5">
        {/* Gender / Division Chips */}
        <div className="grid grid-cols-3 gap-1.5 p-1 court-card-raised rounded-2xl">
          {(['all', 'boys', 'girls'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterGender(tab)}
              className={`tap-target py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                filterGender === tab
                  ? 'btn-lime shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {tab === 'all' ? 'All Divisions' : tab === 'boys' ? 'Boys / Men' : 'Girls / Women'}
            </button>
          ))}
        </div>

        {/* Search & Sort Filters */}
        <div className="flex gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              aria-label="Search players"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or @username..."
              className="w-full tap-target pl-9 pr-8 py-2 rounded-xl bg-[var(--surface)] border border-[var(--hairline)] text-xs text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-lime)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="relative">
            <select
              aria-label="Sort players"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="tap-target px-3 py-2 pr-7 rounded-xl bg-[var(--surface)] border border-[var(--hairline)] text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-lime)] appearance-none cursor-pointer"
            >
              <option value="rating">Highest Elo</option>
              <option value="peak">Peak Elo</option>
              <option value="matches">Most Matches</option>
              <option value="name">Name (A-Z)</option>
            </select>
            <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Skill Level Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3 h-3" /> Tier:
          </span>
          {(['all', 'beginner', 'amateur', 'intermediate', 'advanced', 'professional'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all shrink-0 ${
                filterLevel === lvl
                  ? 'bg-[var(--accent-lime-muted)] text-[var(--text-main)] border border-[var(--accent-lime)]'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--hairline)] hover:text-[var(--text-main)]'
              }`}
            >
              {lvl === 'all' ? 'All Tiers' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-40 court-card skeleton-box" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 court-card skeleton-box" />
          ))}
        </div>
      ) : loadError ? (
        <LoadError message={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : processedPlayers.length === 0 ? (
        <CatEmptyState
          catNumber={9}
          title="No Players Found"
          message={
            players.length === 0
              ? 'No players have registered yet. Create an account to take the #1 spot!'
              : 'No active players match your current filter or search criteria.'
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Top 3 Podium (Shown when at least 3 players exist and no search is active) */}
          {top3.length >= 3 && !searchQuery && (
            <div className="court-card p-5 pt-6 shadow-xl relative overflow-hidden">
              <div className="flex items-end justify-center gap-2 sm:gap-4">
                {/* #2 Rank (Silver) */}
                <Link
                  href={`/profile/${top3[1].username}`}
                  className="flex-1 flex flex-col items-center text-center group"
                >
                  <div className="relative mb-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-slate-400 bg-[var(--surface-raised)] group-hover:scale-105 transition-transform">
                      <Image
                        width={96}
                        height={96}
                        src={`/avatars/${top3[1].avatar_id || 'cat-02'}.svg`}
                        alt={top3[1].name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                    <span className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-slate-400 text-[#0B1020] font-sport font-black text-xs flex items-center justify-center shadow-md">
                      2
                    </span>
                  </div>
                  <p className="text-xs font-black text-[var(--text-main)] truncate max-w-[90px] mt-1">
                    {top3[1].name}
                  </p>
                  <span className="font-sport font-black text-lg text-[var(--text-main)] tabular-nums">
                    {top3[1].rating}
                  </span>
                  <div className="w-full h-16 rounded-t-xl bg-[var(--surface-raised)] border-t border-x border-[var(--hairline)] mt-2 flex items-center justify-center">
                    <span className="font-sport font-bold text-xs text-slate-400">SILVER</span>
                  </div>
                </Link>

                {/* #1 Rank (Champion Gold) */}
                <Link
                  href={`/profile/${top3[0].username}`}
                  className="flex-1 flex flex-col items-center text-center group z-10"
                >
                  <div className="relative mb-2">
                    <Crown className="w-5 h-5 text-amber-400 mx-auto mb-1 animate-bounce" />
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-[var(--accent-lime)] glow-lime bg-[var(--surface-raised)] group-hover:scale-105 transition-transform">
                      <Image
                        width={96}
                        height={96}
                        src={`/avatars/${top3[0].avatar_id || 'cat-01'}.svg`}
                        alt={top3[0].name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                    <span className="absolute -bottom-2 -right-1 w-7 h-7 rounded-full bg-[var(--accent-lime)] text-[#0B1020] font-sport font-black text-sm flex items-center justify-center shadow-md">
                      1
                    </span>
                  </div>
                  <p className="text-xs font-black text-[var(--text-main)] truncate max-w-[100px] mt-1">
                    {top3[0].name}
                  </p>
                  <span className="font-sport font-black text-2xl text-[var(--accent-ink)] tabular-nums">
                    {top3[0].rating}
                  </span>
                  <div className="w-full h-24 rounded-t-2xl bg-[var(--accent-lime-muted)] border-t-2 border-x-2 border-[var(--accent-lime)] mt-2 flex flex-col items-center justify-center">
                    <span className="font-sport font-black text-sm text-[var(--accent-ink)]">CHAMPION</span>
                    <span className="text-[9px] uppercase font-bold text-[var(--text-muted)]">RANK #1</span>
                  </div>
                </Link>

                {/* #3 Rank (Bronze) */}
                <Link
                  href={`/profile/${top3[2].username}`}
                  className="flex-1 flex flex-col items-center text-center group"
                >
                  <div className="relative mb-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-amber-600 bg-[var(--surface-raised)] group-hover:scale-105 transition-transform">
                      <Image
                        width={96}
                        height={96}
                        src={`/avatars/${top3[2].avatar_id || 'cat-03'}.svg`}
                        alt={top3[2].name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    </div>
                    <span className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-amber-600 text-[#0B1020] font-sport font-black text-xs flex items-center justify-center shadow-md">
                      3
                    </span>
                  </div>
                  <p className="text-xs font-black text-[var(--text-main)] truncate max-w-[90px] mt-1">
                    {top3[2].name}
                  </p>
                  <span className="font-sport font-black text-lg text-[var(--text-main)] tabular-nums">
                    {top3[2].rating}
                  </span>
                  <div className="w-full h-12 rounded-t-xl bg-[var(--surface-raised)] border-t border-x border-[var(--hairline)] mt-2 flex items-center justify-center">
                    <span className="font-sport font-bold text-xs text-amber-600">BRONZE</span>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* Leaderboard List (Shows all filtered players or remaining players below top 3) */}
          <div className="space-y-2">
            {(top3.length >= 3 && !searchQuery ? remainingPlayers : processedPlayers).map((player) => {
              const rank = overallRankMap.get(player.id) || 1;
              const isCurrentUser = user?.id === player.id;

              return (
                <Link
                  key={player.id}
                  href={`/profile/${player.username}`}
                  className={`court-card p-3 flex items-center justify-between transition-all hover:scale-[1.01] ${
                    isCurrentUser
                      ? 'border-[var(--accent-lime)] bg-[var(--accent-lime-muted)]'
                      : 'hover:border-[var(--accent-lime)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {/* Rank Indicator */}
                    <div className="shrink-0 flex items-center justify-center">
                      {rank === 1 ? (
                        <span className="w-7 h-7 rounded-xl bg-[var(--accent-lime)] text-[#0B1020] flex items-center justify-center font-sport font-black text-xs shadow-sm">
                          1
                        </span>
                      ) : rank === 2 ? (
                        <span className="w-7 h-7 rounded-xl bg-slate-300 dark:bg-slate-700 text-[var(--text-main)] flex items-center justify-center font-sport font-black text-xs">
                          2
                        </span>
                      ) : rank === 3 ? (
                        <span className="w-7 h-7 rounded-xl bg-amber-700 text-white flex items-center justify-center font-sport font-black text-xs">
                          3
                        </span>
                      ) : (
                        <span className="w-7 h-7 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center font-sport font-black text-xs text-[var(--text-muted)] tabular-nums">
                          #{rank}
                        </span>
                      )}
                    </div>

                    {/* Cat Mascot Avatar */}
                    <div className="relative shrink-0">
                      <Image
                        width={40}
                        height={40}
                        src={`/avatars/${player.avatar_id || 'cat-01'}.svg`}
                        alt={player.name}
                        className="w-10 h-10 rounded-full bg-[var(--surface-raised)] object-cover"
                      />
                      {player.is_admin && (
                        <span
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center text-[8px] font-black text-[#0B1020]"
                          title="Tournament Admin"
                        >
                          ★
                        </span>
                      )}
                    </div>

                    {/* Player Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-[var(--text-main)] truncate">
                          {player.name}
                        </p>
                        {isCurrentUser && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[var(--accent-lime)] text-[#0B1020] font-black uppercase tracking-wider">
                            You
                          </span>
                        )}
                        {(player.matches_played || 0) < 10 && (
                          <span
                            className="text-[10px] text-amber-400 font-bold"
                            title="Provisional (<10 matches)"
                          >
                            ?
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                        <span className="font-mono">@{player.username}</span>
                        <span>•</span>
                        <span>{player.matches_played || 0} matches</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating Display */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="font-sport font-black text-xl text-[var(--accent-ink)] tabular-nums">
                        {player.rating}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 justify-end text-[10px] text-[var(--text-muted)]">
                      <span className="uppercase font-bold">{player.level}</span>
                      {player.peak_rating && player.peak_rating > player.rating && (
                        <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                          <Flame className="w-2.5 h-2.5" />
                          {player.peak_rating}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
