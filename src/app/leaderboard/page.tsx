'use client';

import Image from 'next/image';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Trophy, Search, Crown } from 'lucide-react';
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
}

export default function LeaderboardPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [filterGender, setFilterGender] = useState<'all' | 'boys' | 'girls'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function loadLeaderboard() {
      setIsLoading(true);
      setIsLoading(true);
      setLoadError('');
      try {
        let query = supabase
          .from('profiles')
          .select('id, username, name, gender, avatar_id, rating, peak_rating, matches_played, level')
          .order('rating', { ascending: false });

        if (filterGender !== 'all') {
          query = query.eq('gender', filterGender);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) setPlayers(data as LeaderboardPlayer[]);
      } catch {
        setLoadError('Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadLeaderboard();
  }, [filterGender, supabase, retryKey]);

  const filteredPlayers = players.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
  });

  const rankedPlayers = new Map(players.map((p, i) => [p.id, i + 1]));
  const top3 = filteredPlayers.slice(0, 3);
  const remainingPlayers = filteredPlayers.slice(3);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[var(--accent-ink)]" />
          <h1 className="font-sport font-black text-3xl text-[var(--text-main)] tracking-tight uppercase">
            Leaderboard
          </h1>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Chess-style ratings ladder. One rating per player.
        </p>
      </div>

      {/* Gender Filter Chips & Search */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 p-1 court-card-raised rounded-2xl">
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
              {tab === 'all' ? 'All' : tab === 'boys' ? 'Boys / Men' : 'Girls / Women'}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            aria-label="Search players"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or @username..."
            className="w-full tap-target pl-10 pr-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--hairline)] text-xs text-[var(--text-main)] placeholder-[var(--text-subtle)] focus:outline-none focus:border-[var(--accent-lime)]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-48 court-card skeleton-box" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 court-card skeleton-box" />
          ))}
        </div>
      ) : loadError ? (<LoadError message={loadError} onRetry={() => setRetryKey(k => k + 1)} />) : filteredPlayers.length === 0 ? (
        <CatEmptyState
          catNumber={9}
          title="No Players Found"
          message="No active players found for this filter. Try adjusting your search query or category."
        />
      ) : (
        <div className="space-y-5">
          {/* Top 3 Podium (Rank 2 Left, Rank 1 Center Taller, Rank 3 Right) */}
          {top3.length >= 3 && !searchQuery && (
            <div className="court-card p-5 pt-6 shadow-xl relative overflow-hidden">
              <div className="flex items-end justify-center gap-2 sm:gap-4">

                {/* #2 Rank (Left) */}
                <Link
                  href={`/profile/${top3[1].username}`}
                  className="flex-1 flex flex-col items-center text-center group"
                >
                  <div className="relative mb-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-slate-400 bg-[var(--surface-raised)] group-hover:scale-105 transition-transform">
                      <Image width={96} height={96}
                        src={`/avatars/${top3[1].avatar_id || 'cat-02'}.svg`}
                        alt={top3[1].name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-slate-400 text-[#0B1020] font-sport font-black text-xs flex items-center justify-center shadow-md">
                      2
                    </span>
                  </div>
                  <p className="text-xs font-black text-[var(--text-main)] truncate max-w-[90px] mt-1">
                    {top3[1].name.split(' ')[0]}
                  </p>
                  <span className="font-sport font-black text-lg text-[var(--text-main)] tabular-nums">
                    {top3[1].rating}
                  </span>
                  <div className="w-full h-16 rounded-t-xl bg-[var(--surface-raised)] border-t border-x border-[var(--hairline)] mt-2 flex items-center justify-center">
                    <span className="font-sport font-bold text-xs text-slate-400">SILVER</span>
                  </div>
                </Link>

                {/* #1 Rank (Center, Taller, Lime Glow) */}
                <Link
                  href={`/profile/${top3[0].username}`}
                  className="flex-1 flex flex-col items-center text-center group z-10"
                >
                  <div className="relative mb-2">
                    <Crown className="w-5 h-5 text-amber-400 mx-auto mb-1 animate-bounce" />
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-[var(--accent-lime)] glow-lime bg-[var(--surface-raised)] group-hover:scale-105 transition-transform">
                      <Image width={96} height={96}
                        src={`/avatars/${top3[0].avatar_id || 'cat-01'}.svg`}
                        alt={top3[0].name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute -bottom-2 -right-1 w-7 h-7 rounded-full bg-[var(--accent-lime)] text-[#0B1020] font-sport font-black text-sm flex items-center justify-center shadow-md">
                      1
                    </span>
                  </div>
                  <p className="text-xs font-black text-[var(--text-main)] truncate max-w-[100px] mt-1">
                    {top3[0].name.split(' ')[0]}
                  </p>
                  <span className="font-sport font-black text-2xl text-[var(--accent-ink)] tabular-nums">
                    {top3[0].rating}
                  </span>
                  <div className="w-full h-24 rounded-t-2xl bg-[var(--accent-lime-muted)] border-t-2 border-x-2 border-[var(--accent-lime)] mt-2 flex flex-col items-center justify-center">
                    <span className="font-sport font-black text-sm text-[var(--accent-ink)]">CHAMPION</span>
                    <span className="text-[9px] uppercase font-bold text-[var(--text-muted)]">RANK #1</span>
                  </div>
                </Link>

                {/* #3 Rank (Right) */}
                <Link
                  href={`/profile/${top3[2].username}`}
                  className="flex-1 flex flex-col items-center text-center group"
                >
                  <div className="relative mb-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border-2 border-amber-600 bg-[var(--surface-raised)] group-hover:scale-105 transition-transform">
                      <Image width={96} height={96}
                        src={`/avatars/${top3[2].avatar_id || 'cat-03'}.svg`}
                        alt={top3[2].name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-amber-600 text-[#0B1020] font-sport font-black text-xs flex items-center justify-center shadow-md">
                      3
                    </span>
                  </div>
                  <p className="text-xs font-black text-[var(--text-main)] truncate max-w-[90px] mt-1">
                    {top3[2].name.split(' ')[0]}
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

          {/* Ranked List (#4 and below, or full list when searching) */}
          <div className="space-y-2 stagger-list">
            {(top3.length >= 3 && !searchQuery ? remainingPlayers : filteredPlayers).map((player, idx) => {
              const rank = rankedPlayers.get(player.id) ?? idx + 1;

              return (
                <Link
                  key={player.id}
                  href={`/profile/${player.username}`}
                  className="court-card p-3 flex items-center justify-between hover:border-[var(--accent-lime)] transition-all hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {/* Rank Badge */}
                    <span className="w-7 h-7 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center font-sport font-black text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
                      #{rank}
                    </span>

                    {/* Cat Avatar in Squircle Frame */}
                    <Image width={96} height={96}
                      src={`/avatars/${player.avatar_id || 'cat-01'}.svg`}
                      alt={player.name}
                      className="w-10 h-10 rounded-xl bg-[var(--surface-raised)] shrink-0"
                    />

                    {/* Name & Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-[var(--text-main)] truncate">
                          {player.name}
                        </p>
                        {player.matches_played < 10 && (
                          <span className="text-[10px] text-amber-400 font-bold" title="Provisional">
                            ?
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        @{player.username}
                      </span>
                    </div>
                  </div>

                  {/* Big Condensed Rating */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="font-sport font-black text-xl text-[var(--accent-ink)] tabular-nums">
                        {player.rating}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                      {player.level}
                    </span>
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
