'use client';

import Image from 'next/image';

import type { Tournament, Match, RatingHistory } from '@/lib/types';
import { playerWonMatch } from '@/lib/rating/stats';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Swords, ChevronRight, Calendar, TrendingUp, PlusCircle, ArrowUpRight } from 'lucide-react';
import CourtIllustration from '@/components/CourtIllustration';
import LoadError from '@/components/LoadError';
import CatEmptyState from '@/components/CatEmptyState';

export default function HomePage() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [last5Form, setLast5Form] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function loadHomeData() {
      setIsLoading(true);
      setLoadError('');
      setNextMatch(null);
      setUserRank(null);
      setLast5Form([]);
      try {
        // 1. Fetch live tournaments
        const { data: tourneys, error: tournamentError } = await supabase
          .from('tournaments')
          .select('id, name, date, status, rules')
          .order('date', { ascending: false })
          .limit(5);

        if (tournamentError) throw tournamentError;
        if (tourneys) setTournaments(tourneys as unknown as Tournament[]);

        // 2. If logged in, fetch rank, form, and next match
        if (user && profile) {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('rating', profile.rating);

          setUserRank((count ?? 0) + 1);

          const { data: history } = await supabase
            .from('rating_history')
            .select(`delta, match:matches(winner_id, entry_a:entries!matches_entry_a_id_fkey(id, player1:profiles!entries_player1_id_fkey(id), player2:profiles!entries_player2_id_fkey(id)), entry_b:entries!matches_entry_b_id_fkey(id))`)
            .eq('player_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

          if (history) {
            setLast5Form((history as unknown as RatingHistory[]).map((h) => (playerWonMatch(h, user.id) ? 'W' : 'L')).reverse());
          }

          const { data: myEntries } = await supabase
            .from('entries')
            .select('id')
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);

          if (myEntries && myEntries.length > 0) {
            const entryIds = myEntries.map((e) => e.id);
            const { data: match } = await supabase
              .from('matches')
              .select(`
                id, round, round_name, court, status, rules_snapshot,
                entry_a:entries!matches_entry_a_id_fkey(
                  id, seed,
                  player1:profiles!entries_player1_id_fkey(name, avatar_id, rating),
                  player2:profiles!entries_player2_id_fkey(name, avatar_id, rating)
                ),
                entry_b:entries!matches_entry_b_id_fkey(
                  id, seed,
                  player1:profiles!entries_player1_id_fkey(name, avatar_id, rating),
                  player2:profiles!entries_player2_id_fkey(name, avatar_id, rating)
                ),
                category:categories(name, tournament:tournaments(name))
              `)
              .in('status', ['pending', 'in_progress'])
              .or(`entry_a_id.in.(${entryIds.join(',')}),entry_b_id.in.(${entryIds.join(',')})`)
              .order('round', { ascending: true })
              .limit(1)
              .maybeSingle();

            if (match) setNextMatch(match as unknown as Match);
          }
        }
      } catch {
        setLoadError('Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadHomeData();
  }, [user, profile, supabase, retryKey]);

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div><p className="eyebrow">Your badminton arena</p><h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">{user && profile ? `Welcome back, ${profile.name.split(' ')[0]}.` : 'Make every rally count.'}</h1></div>
        <span className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-muted)]"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-ink)]" />Built for badminton</span>
      </div>
      {/* Desktop 2-column wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left Column (Hero & Player Card) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Hero Player Rating Card */}
          {authLoading ? (<div className="court-card skeleton-box h-80" aria-label="Loading your profile" />) : user && profile ? (
            <div className="court-card p-6 shadow-xl relative overflow-hidden">
              {/* Subtle court texture inside card */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-lime-muted)] rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[var(--accent-lime)] glow-lime bg-[var(--surface-raised)]">
                      <Image width={96} height={96}
                        src={`/avatars/${profile.avatar_id || 'cat-01'}.svg`}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--hairline)] text-[var(--accent-ink)]">
                      {profile.gender === 'boys' ? 'Boy' : 'Girl'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-[var(--text-main)]">
                        {profile.name}
                      </h2>
                      {profile.is_admin && (
                        <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-[var(--accent-lime)] text-[#0B1020]">
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-[var(--text-muted)]">
                      @{profile.username}
                    </p>
                  </div>
                </div>

                <Link
                  href="/profile"
                  className="tap-target px-3 py-1.5 rounded-xl btn-secondary text-xs flex items-center gap-1"
                >
                  <span>Stats</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Big Scoreboard Rating Numerals (48px condensed) */}
              <div className="mt-5 pt-4 border-t border-[var(--hairline)] flex items-end justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block mb-0.5">
                    Elo Rating
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-sport font-black text-5xl text-[var(--accent-ink)] tabular-nums leading-none tracking-tight">
                      {profile.rating}
                    </span>
                    {profile.matches_played < 10 && (
                      <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded" title="Provisional Rating">
                        ?
                      </span>
                    )}
                  </div>
                </div>

                {/* Chips: Rank & Peak */}
                <div className="flex items-center gap-2 text-right">
                  {userRank && (
                    <div className="px-2.5 py-1 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                        Rank
                      </span>
                      <span className="font-sport font-bold text-sm text-[var(--text-main)] tabular-nums">
                        #{userRank}
                      </span>
                    </div>
                  )}

                  <div className="px-2.5 py-1 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      Peak
                    </span>
                    <span className="font-sport font-bold text-sm text-[var(--text-main)] tabular-nums">
                      {profile.peak_rating || profile.rating}
                    </span>
                  </div>
                </div>
              </div>

              {/* Last 5 Form Chips */}
              <div className="mt-4 pt-3 border-t border-[var(--hairline)] flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Recent Form
                </span>
                <div className="flex items-center gap-1.5">
                  {last5Form.length === 0 ? (
                    <span className="text-[11px] text-[var(--text-muted)]">No matches yet</span>
                  ) : (
                    last5Form.map((f, i) => (
                      <span
                        key={i}
                        className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center ${
                          f === 'W' ? 'chip-win' : 'chip-loss'
                        }`}
                      >
                        {f}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <section className="strivo-hero court-card">
              <div className="relative z-10 max-w-lg p-6 md:p-8">
                <span className="hero-tag">A BETTER GAME STARTS HERE</span>
                <h2 className="font-sport text-5xl md:text-6xl font-bold uppercase leading-[.95] mt-6">Find your game.<br /><span className="text-[#C6FF3D]">Raise your level.</span></h2>
                <p className="text-sm text-[#A9B4CB] leading-relaxed mt-5 max-w-[260px]">Join the competition. Follow every match. Build a rating that grows with your game.</p>
                <Link href="/login" className="tap-target btn-lime px-5 py-3 mt-6 text-sm gap-2">Get started <ArrowUpRight className="w-4 h-4" /></Link>
                <p className="text-[10px] text-[#A9B4CB] mt-4">Free to join · Email sign-in</p>
              </div>
              <CourtIllustration />
            </section>
          )}

          {/* Next Match Highlight Card */}
          {nextMatch && (
            <div className="court-card p-5 border-l-4 border-l-[var(--accent-lime)] shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="live-dot" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-ink)]">
                    Your Next Match
                  </span>
                </div>
                {nextMatch.court && (
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--text-main)]">
                    {nextMatch.court}
                  </span>
                )}
              </div>

              <p className="text-xs font-bold text-[var(--text-muted)]">
                {nextMatch.category?.tournament?.name} • {nextMatch.category?.name} ({nextMatch.round_name})
              </p>

              <div className="p-3 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Image width={96} height={96}
                    src={`/avatars/${nextMatch.entry_a?.player1?.avatar_id || 'cat-01'}.svg`}
                    alt="Player A"
                    className="w-10 h-10 rounded-xl"
                  />
                  <div>
                    <p className="text-xs font-black text-[var(--text-main)] truncate max-w-[100px]">
                      {nextMatch.entry_a?.player1?.name || 'TBD'}
                    </p>
                    <span className="font-sport text-xs font-bold text-[var(--text-muted)] tabular-nums">
                      {nextMatch.entry_a?.player1?.rating || 500} Elo
                    </span>
                  </div>
                </div>

                <span className="font-sport font-black text-sm text-[var(--text-muted)] px-2">
                  VS
                </span>

                <div className="flex items-center gap-2.5 text-right">
                  <div>
                    <p className="text-xs font-black text-[var(--text-main)] truncate max-w-[100px]">
                      {nextMatch.entry_b?.player1?.name || 'TBD'}
                    </p>
                    <span className="font-sport text-xs font-bold text-[var(--text-muted)] tabular-nums">
                      {nextMatch.entry_b?.player1?.rating || 500} Elo
                    </span>
                  </div>
                  <Image width={96} height={96}
                    src={`/avatars/${nextMatch.entry_b?.player1?.avatar_id || 'cat-02'}.svg`}
                    alt="Player B"
                    className="w-10 h-10 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Tournaments & Quick Actions) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[var(--accent-ink)]" />
              <h3 className="font-sport font-black text-lg text-[var(--text-main)] uppercase tracking-wide">
                Tournaments
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {profile?.is_admin && (
                <Link
                  href="/manage/tournaments/new"
                  className="tap-target px-2.5 py-1 rounded-xl btn-lime text-[11px] font-black flex items-center gap-1 shadow-md shadow-[rgba(198,255,61,0.2)]"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create</span>
                </Link>
              )}
              <Link
                href="/tournaments"
                className="text-xs text-[var(--accent-ink)] font-bold flex items-center gap-0.5 hover:underline"
              >
                All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {isLoading ? (<div className="space-y-3" aria-label="Loading tournaments">{[1, 2, 3].map(i => <div key={i} className="skeleton-box h-24" />)}</div>) : loadError ? (<LoadError message={loadError} onRetry={() => setRetryKey(k => k + 1)} />) : tournaments.length === 0 ? (
            <CatEmptyState
              catNumber={4}
              title="No Tournaments Right Now"
              message={
                profile?.is_admin
                  ? 'Start a tournament to set up rules, add player seeds, and run brackets.'
                  : 'Check back soon for upcoming tournaments and live scores.'
              }
              actionText={profile?.is_admin ? 'Create Tournament' : undefined}
              actionHref={profile?.is_admin ? '/manage/tournaments/new' : undefined}
            />
          ) : (
            <div className="space-y-2.5">
              {tournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="block court-card p-4 hover:border-[var(--accent-lime)] transition-all hover:scale-[1.01]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {t.status === 'in_progress' ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-lime-muted)] text-[var(--accent-ink)] border border-[var(--accent-lime)]">
                            <span className="live-dot w-1.5 h-1.5" />
                            Live
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)]">
                            {t.status.replace('_', ' ')}
                          </span>
                        )}
                        <span className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {t.date}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-[var(--text-main)] mt-1.5">
                        {t.name}
                      </h4>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center text-[var(--text-muted)]">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Quick Nav Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5 pt-1">
            <Link
              href="/leaderboard"
              className="court-card p-4 hover:border-[var(--accent-lime)] transition-all flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center text-[var(--accent-ink)] shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="font-sport font-black text-base text-[var(--text-main)] uppercase leading-none">
                  Leaderboard
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Track your progress
                </p>
              </div>
            </Link>

            <Link
              href="/tournaments"
              className="court-card p-4 hover:border-[var(--accent-lime)] transition-all flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center text-[var(--accent-ink)] shrink-0">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <p className="font-sport font-black text-base text-[var(--text-main)] uppercase leading-none">
                  Brackets
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Follow the competition
                </p>
              </div>
            </Link>
          </div>
        </div>

      </div>
      <section className="grid sm:grid-cols-3 gap-4 stagger-list">
        {[{ icon: Trophy, number: '01', title: 'Find your competition', copy: 'Explore tournaments, categories, and draws in one place.' }, { icon: Swords, number: '02', title: 'Follow every rally', copy: 'Keep up with live scores and every round of the bracket.' }, { icon: TrendingUp, number: '03', title: 'See your progress', copy: 'Track your Elo, match history, and place on the leaderboard.' }].map(item => <div key={item.number} className="court-card p-5"><div className="flex justify-between items-center mb-5"><item.icon className="h-5 w-5 text-[var(--accent-ink)]" /><span className="text-xs font-mono text-[var(--text-subtle)]">{item.number}</span></div><h3 className="font-bold text-sm">{item.title}</h3><p className="text-xs text-[var(--text-muted)] leading-relaxed mt-2">{item.copy}</p></div>)}
      </section>
      <p className="text-[10px] text-[var(--text-muted)] text-center py-2 tracking-wider">STRIVO · PLAY. COMPETE. RISE.</p>
    </div>
  );
}
