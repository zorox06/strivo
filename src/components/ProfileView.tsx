'use client';

import Image from 'next/image';

import type { Player, RatingHistory } from '@/lib/types';

import { errorMessage } from '@/lib/errors';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Phone, Edit3, LogOut, MessageSquare, Lock } from 'lucide-react';
import { calculateProfileStats, playerWonMatch } from '@/lib/rating/stats';
import CatEmptyState from '@/components/CatEmptyState';

interface ProfileViewProps {
  username?: string; // If undefined, view own profile
}

const CAT_AVATARS = [
  'cat-01', 'cat-02', 'cat-03', 'cat-04',
  'cat-05', 'cat-06', 'cat-07', 'cat-08',
  'cat-09', 'cat-10', 'cat-11', 'cat-12',
];

export default function ProfileView({ username }: ProfileViewProps) {
  const { user, profile: ownProfile, refreshProfile, signOut } = useAuth();
  const supabase = createClient();

  const [profile, setProfile] = useState<Player | null>(null);
  const [history, setHistory] = useState<RatingHistory[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
    pointsScored: 0,
    pointsConceded: 0,
  });
  const [graphRange, setGraphRange] = useState<'last20' | 'all'>('last20');
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; rating: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarId, setEditAvatarId] = useState('cat-01');
  const [editBio, setEditBio] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editShowPhone, setEditShowPhone] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const isOwnProfile = !username || (ownProfile && ownProfile.username === username);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        let targetId = username ? undefined : user?.id;
        let targetRating = ownProfile?.rating ?? 500;

        if (username) {
          const { data: p } = await supabase
            .from('profiles_view')
            .select('*')
            .eq('username', username)
            .maybeSingle();

          if (p) {
            setProfile(p as unknown as Player);
            targetId = p.id;
            targetRating = p.rating;
          } else { setProfile(null); return; }
        } else if (ownProfile) {
          setProfile(ownProfile);
          targetId = ownProfile.id;
        }

        if (targetId) {
          // 1. Get rank
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('rating', targetRating);

          setRank((count ?? 0) + 1);

          // 2. Get rating history with match details
          const { data: hist } = await supabase
            .from('rating_history')
            .select(`
              id, rating_before, rating_after, delta, created_at,
              match:matches(
                id, round_name, set_scores, winner_id,
                category:categories(name, type, tournament:tournaments(name)),
                entry_a:entries!matches_entry_a_id_fkey(
                  id, player1:profiles!entries_player1_id_fkey(id, name, avatar_id),
                  player2:profiles!entries_player2_id_fkey(id, name, avatar_id)
                ),
                entry_b:entries!matches_entry_b_id_fkey(
                  id, player1:profiles!entries_player1_id_fkey(id, name, avatar_id),
                  player2:profiles!entries_player2_id_fkey(id, name, avatar_id)
                )
              )
            `)
            .eq('player_id', targetId)
            .order('created_at', { ascending: true });

          if (hist) {
            setHistory(hist as unknown as RatingHistory[]);

            setStats(calculateProfileStats(hist as unknown as RatingHistory[], targetId));
          }
        }
      } catch (err) {
        console.error('Error loading profile view:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [username, ownProfile, user, supabase]);

  const openEditModal = () => {
    if (!profile) return;
    setEditName(profile.name || '');
    setEditUsername(profile.username || '');
    setEditAvatarId(profile.avatar_id || 'cat-01');
    setEditBio(profile.bio || '');
    setEditPhone(profile.phone || '');
    setEditShowPhone(profile.show_phone || false);
    setEditError('');
    setIsEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setEditSaving(true);
    setEditError('');

    try {
      if (!editName.trim()) throw new Error('Please enter your name.');
      if (!/^[a-z0-9_]{3,20}$/.test(editUsername.trim().toLowerCase())) throw new Error('Username must be 3–20 lowercase letters, numbers, or underscores.');
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          name: editName.trim(),
          username: editUsername.trim().toLowerCase(),
          avatar_id: editAvatarId,
          bio: editBio.trim(),
        })
        .eq('id', user.id);

      if (pErr) throw pErr;

      const { error: cErr } = await supabase
        .from('player_contacts')
        .upsert({
          player_id: user.id,
          phone: editPhone.trim() || null,
          show_phone: editShowPhone,
        });

      if (cErr) throw cErr;

      await refreshProfile();
      setIsEditing(false);
    } catch (err: unknown) {
      setEditError(errorMessage(err, 'Failed to update profile.'));
    } finally {
      setEditSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-44 court-card skeleton-box" />
        <div className="h-32 court-card skeleton-box" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-10 court-card text-center space-y-2">
        <p className="text-sm font-bold text-[var(--text-main)]">Player profile not found.</p>
      </div>
    );
  }

  // Last 5 form
  const last5 = history.slice(-5).map((h) => (playerWonMatch(h, profile.id) ? 'W' : 'L'));

  // Graph points
  const graphData = graphRange === 'last20' ? history.slice(-20) : history;
  const ratingPoints = [
    profile.rating - history.reduce((sum, h) => sum + h.delta, 0),
    ...graphData.map((h) => h.rating_after),
  ];

  const minRating = Math.min(...ratingPoints, 800) - 40;
  const maxRating = Math.max(...ratingPoints, 1200) + 40;
  const chartHeight = 130;
  const chartWidth = 340;

  const pointsSvg = ratingPoints
    .map((val, idx) => {
      const x = (idx / Math.max(ratingPoints.length - 1, 1)) * chartWidth;
      const y = chartHeight - ((val - minRating) / (maxRating - minRating)) * (chartHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  const areaSvg = `${pointsSvg} ${chartWidth},${chartHeight} 0,${chartHeight}`;

  return (
    <div className="space-y-6">
      {/* Desktop 2-column layout wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Hero, Huge Scoreboard Rating & Stats */}
        <div className="lg:col-span-6 space-y-5">
          {/* Hero Profile Card */}
          <div className="court-card p-6 shadow-xl relative overflow-hidden space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {/* Cat Avatar in Squircle Frame with Lime Ring */}
                <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-[var(--accent-lime)] glow-lime bg-[var(--surface-raised)] shrink-0">
                  <Image width={96} height={96}
                    src={`/avatars/${profile.avatar_id || 'cat-01'}.svg`}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-black text-[var(--text-main)]">
                      {profile.name}
                    </h1>
                    {profile.is_admin && (
                      <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-[var(--accent-lime)] text-[#0B1020]">
                        Owner
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-mono text-[var(--text-muted)]">
                    @{profile.username}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)]">
                      {profile.gender === 'boys' ? 'Boys Category' : 'Girls Category'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--accent-lime-muted)] text-[var(--accent-ink)] border border-[var(--accent-lime)]">
                      {profile.level}
                    </span>
                  </div>
                </div>
              </div>

              {isOwnProfile && (
                <button
                  onClick={openEditModal}
                  className="tap-target p-2.5 rounded-xl btn-secondary text-xs"
                  title="Edit Profile"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--hairline)]">
                {profile.bio}
              </p>
            )}

            {/* Phone Row (Call / WhatsApp) */}
            {profile.phone ? (
              <div className="pt-3 border-t border-[var(--hairline)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Phone className="w-3.5 h-3.5 text-[var(--accent-ink)]" />
                  <span className="font-mono text-sm text-[var(--text-main)] font-bold">
                    {profile.phone}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${profile.phone}`}
                    className="tap-target px-3 py-1.5 rounded-xl btn-secondary text-xs font-bold flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5 text-[var(--accent-ink)]" />
                    <span>Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${profile.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap-target px-3 py-1.5 rounded-xl btn-lime text-xs font-black flex items-center gap-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            ) : isOwnProfile ? (
              <div className="pt-3 border-t border-[var(--hairline)] flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <Lock className="w-3.5 h-3.5" />
                <span>Phone hidden from public (enable in settings if you want partners to reach you)</span>
              </div>
            ) : null}
          </div>

          {/* HUGE Scoreboard Rating Box (64px Condensed Numerals) */}
          <div className="court-card p-6 shadow-xl space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block">
              Official Elo Rating
            </span>

            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-sport font-black text-6xl sm:text-7xl text-[var(--accent-ink)] tabular-nums leading-none tracking-tight">
                  {profile.rating}
                </span>
                {profile.matches_played < 10 && (
                  <span className="text-sm font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md" title="Provisional Rating (<10 matches)">
                    ? Provisional
                  </span>
                )}
              </div>

              {/* Peak & Rank Chips */}
              <div className="flex flex-col gap-1.5 text-right">
                {rank && (
                  <div className="px-3 py-1 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      Rank
                    </span>
                    <span className="font-sport font-bold text-base text-[var(--text-main)] tabular-nums">
                      #{rank}
                    </span>
                  </div>
                )}
                <div className="px-3 py-1 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Peak
                  </span>
                  <span className="font-sport font-bold text-base text-[var(--text-main)] tabular-nums">
                    {profile.peak_rating || profile.rating}
                  </span>
                </div>
              </div>
            </div>

            {/* Stat Grid: Matches, Wins, Losses, Win % */}
            <div className="grid grid-cols-4 gap-2 pt-4 border-t border-[var(--hairline)]">
              <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] text-center border border-[var(--hairline)]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Played
                </span>
                <span className="font-sport font-black text-xl text-[var(--text-main)] tabular-nums">
                  {stats.wins + stats.losses}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] text-center border border-[var(--hairline)]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-win)] block">
                  Wins
                </span>
                <span className="font-sport font-black text-xl text-[var(--color-win)] tabular-nums">
                  {stats.wins}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] text-center border border-[var(--hairline)]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-loss)] block">
                  Losses
                </span>
                <span className="font-sport font-black text-xl text-[var(--color-loss)] tabular-nums">
                  {stats.losses}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--surface-raised)] text-center border border-[var(--hairline)]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent-ink)] block">
                  Win %
                </span>
                <span className="font-sport font-black text-xl text-[var(--accent-ink)] tabular-nums">
                  {stats.winRate}%
                </span>
              </div>
            </div>

            {/* Streaks & Points Conceded Strip */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-[var(--surface-raised)]/60">
                <span className="text-[9px] font-bold uppercase text-[var(--text-muted)] block">Streak</span>
                <span className="font-sport font-bold text-sm text-[var(--text-main)] tabular-nums">
                  {stats.currentStreak > 0 ? `+${stats.currentStreak} W` : stats.currentStreak < 0 ? `${stats.currentStreak} L` : '0'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-raised)]/60">
                <span className="text-[9px] font-bold uppercase text-[var(--text-muted)] block">Best Streak</span>
                <span className="font-sport font-bold text-sm text-[var(--accent-ink)] tabular-nums">
                  {stats.bestStreak} Wins
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-raised)]/60">
                <span className="text-[9px] font-bold uppercase text-[var(--text-muted)] block">Pts Scored / Con</span>
                <span className="font-sport font-bold text-xs text-[var(--text-main)] tabular-nums">
                  {stats.pointsScored} : {stats.pointsConceded}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Rating Graph & Match History */}
        <div className="lg:col-span-6 space-y-5">
          {/* Smooth Rating Graph with Touch Tooltip */}
          <div className="court-card p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] block">
                  Rating Trajectory
                </span>
                <p className="font-sport font-black text-lg text-[var(--text-main)] uppercase tracking-tight">
                  Performance Graph
                </p>
              </div>

              <div className="flex rounded-xl bg-[var(--surface-raised)] p-1 border border-[var(--hairline)]">
                <button
                  type="button"
                  onClick={() => setGraphRange('last20')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    graphRange === 'last20'
                      ? 'bg-[var(--accent-lime)] text-[#0B1020]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  Last 20
                </button>
                <button
                  type="button"
                  onClick={() => setGraphRange('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    graphRange === 'all'
                      ? 'bg-[var(--accent-lime)] text-[#0B1020]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>

            {/* SVG Graph */}
            <div className="relative pt-2 pb-1 overflow-hidden">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-36 overflow-visible">
                <defs>
                  <linearGradient id="limeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-lime)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--accent-lime)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid lines */}
                <line x1="0" y1="30" x2={chartWidth} y2="30" stroke="var(--hairline)" strokeDasharray="3 3" />
                <line x1="0" y1="70" x2={chartWidth} y2="70" stroke="var(--hairline)" strokeDasharray="3 3" />
                <line x1="0" y1="110" x2={chartWidth} y2="110" stroke="var(--hairline)" strokeDasharray="3 3" />

                {/* Area fill */}
                <polygon points={areaSvg} fill="url(#limeGrad)" />

                {/* Main Curve */}
                <polyline
                  fill="none"
                  stroke="var(--accent-lime)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsSvg}
                />

                {/* Data Points */}
                {ratingPoints.map((val, idx) => {
                  const x = (idx / Math.max(ratingPoints.length - 1, 1)) * chartWidth;
                  const y = chartHeight - ((val - minRating) / (maxRating - minRating)) * (chartHeight - 20) - 10;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="3.5"
                      fill="var(--accent-lime)"
                      stroke="#0B1020"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:r-5 transition-all"
                      onMouseEnter={() => setHoveredPoint({ rating: val, index: idx })}
                    />
                  );
                })}
              </svg>

              {/* Tooltip info */}
              {hoveredPoint && (
                <div className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-[var(--surface-raised)] border border-[var(--accent-lime)] text-[10px] font-mono text-[var(--accent-ink)]">
                  Match #{hoveredPoint.index}: {hoveredPoint.rating} Elo
                </div>
              )}
            </div>

            {/* Last 5 Form Badges */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--hairline)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Last 5 Outcomes
              </span>
              <div className="flex items-center gap-1.5">
                {last5.length === 0 ? (
                  <span className="text-[11px] text-[var(--text-muted)]">No match records</span>
                ) : (
                  last5.map((f, i) => (
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

          {/* Match History with Rating-Change Chips (+9 / -9) */}
          <div className="space-y-3">
            <h3 className="font-sport font-black text-lg text-[var(--text-main)] uppercase tracking-wide px-1">
              Match History
            </h3>

            {history.length === 0 ? (
              <CatEmptyState
                catNumber={1}
                title="No Matches Yet"
                message="Your next match is the start of your story."
                actionText="Browse Tournaments"
                actionHref="/tournaments"
              />
            ) : (
              <div className="space-y-2.5">
                {history.slice().reverse().map((h) => {
                  const isWin = playerWonMatch(h, profile.id);
                  const deltaSign = isWin ? `+${h.delta}` : `${h.delta}`;
                  const matchObj = h.match;
                  const scores = (matchObj?.set_scores || []) as Array<{ side_a: number; side_b: number }>;
                  const categoryName = matchObj?.category?.name || 'Singles';
                  const tourneyName = matchObj?.category?.tournament?.name || 'Tournament';

                  return (
                    <div
                      key={h.id}
                      className="court-card p-3.5 flex items-center justify-between hover:border-[var(--accent-lime)] transition-all"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mb-1">
                          <span className="font-bold text-[var(--text-main)]">{categoryName}</span>
                          <span>•</span>
                          <span>{tourneyName}</span>
                        </div>

                        {scores.length > 0 && (
                          <p className="font-sport font-black text-sm text-[var(--text-main)] tabular-nums">
                            {scores.map((s) => `${s.side_a}-${s.side_b}`).join(', ')}
                          </p>
                        )}
                      </div>

                      {/* Rating-Change Chip */}
                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl text-xs font-sport font-black tabular-nums ${
                            isWin ? 'chip-win' : 'chip-loss'
                          }`}
                        >
                          {deltaSign}
                        </span>
                        <span className="font-sport text-xs font-bold text-[var(--text-muted)] block mt-0.5 tabular-nums">
                          {h.rating_after} Elo
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Sign Out Action (Own Profile) */}
      {isOwnProfile && (
        <div className="pt-4 flex justify-center">
          <button
            type="button"
            onClick={signOut}
            className="tap-target px-5 py-2.5 rounded-xl btn-secondary text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Strivo</span>
          </button>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm court-card p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-sport font-black text-xl text-[var(--text-main)] uppercase">
                Edit Player Card
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            {editError && (
              <p className="text-xs text-[var(--color-loss)]">{editError}</p>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full tap-target px-3 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                  Avatar Cat
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {CAT_AVATARS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setEditAvatarId(cat)}
                      className={`aspect-square rounded-xl p-1 bg-[var(--surface-raised)] border ${
                        editAvatarId === cat ? 'border-[var(--accent-lime)] glow-lime' : 'border-[var(--hairline)]'
                      }`}
                    >
                      <Image width={96} height={96} src={`/avatars/${cat}.svg`} alt="Cat" className="w-full h-full object-cover rounded-lg" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                  Bio
                </label>
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full tap-target px-3 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs text-[var(--text-main)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full tap-target px-3 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs font-mono text-[var(--text-main)]"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[var(--text-muted)]">Show phone on profile</span>
                <input
                  type="checkbox"
                  checked={editShowPhone}
                  onChange={(e) => setEditShowPhone(e.target.checked)}
                  className="w-5 h-5 accent-[var(--accent-lime)]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 tap-target py-2.5 rounded-xl btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 tap-target py-2.5 btn-lime text-xs font-black"
                >
                  {editSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
