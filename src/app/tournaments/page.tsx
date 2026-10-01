'use client';

import type { Tournament, Category } from '@/lib/types';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Calendar, ChevronRight, PlusCircle, CheckCircle2 } from 'lucide-react';
import LoadError from '@/components/LoadError';
import CatEmptyState from '@/components/CatEmptyState';

export default function TournamentsPage() {
  const { user, hasTournamentAccess } = useAuth();
  const supabase = createClient();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registeredTournamentIds, setRegisteredTournamentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function loadTournaments() {
      setIsLoading(true);
      setLoadError('');
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('id, name, date, status, rules, categories(id, name, type, gender)')
          .order('date', { ascending: false });

        if (error) throw error;
        if (data) setTournaments(data as unknown as Tournament[]);

        if (user) {
          const { data: userEntries } = await supabase
            .from('entries')
            .select('category:categories(tournament_id)')
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);

          if (userEntries) {
            const ids = (userEntries as unknown as Array<{ category: { tournament_id: string } | null }>)
              .map((e) => e.category?.tournament_id)
              .filter((id): id is string => Boolean(id));
            setRegisteredTournamentIds(ids);
          }
        }
      } catch {
        setLoadError('Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadTournaments();
  }, [supabase, user, retryKey]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-ink)]">
            Arena Tournaments
          </span>
          <h1 className="font-sport font-black text-2xl md:text-3xl text-[var(--text-main)] uppercase tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[var(--accent-ink)]" />
            Tournaments & Brackets
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Official badminton events with live scores and bracket tabs.
          </p>
        </div>

        {hasTournamentAccess && (
          <Link
            href="/manage/tournaments/new"
            className="tap-target px-3.5 py-2 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-md shadow-[rgba(198,255,61,0.2)] shrink-0 transition-all hover:scale-102"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Tournament</span>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-3xl skeleton-box" />
          ))}
        </div>
      ) : loadError ? (<LoadError message={loadError} onRetry={() => setRetryKey(k => k + 1)} />) : tournaments.length === 0 ? (
        <CatEmptyState
          catNumber={2}
          title="No Tournaments Yet"
          message={
            hasTournamentAccess
              ? "You haven't created any tournaments yet. Set one up in just 3 steps!"
              : 'No tournaments are currently scheduled. Check back soon or ask your organizer!'
          }
          actionText={hasTournamentAccess ? 'Create Tournament' : undefined}
          actionHref={hasTournamentAccess ? '/manage/tournaments/new' : undefined}
        />
      ) : (
        <div className="space-y-3 stagger-list">
          {tournaments.map((t) => {
            const isLive = t.status === 'in_progress';
            const isRegistered = registeredTournamentIds.includes(t.id);

            return (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className={`block court-card p-5 rounded-3xl hover:border-[var(--accent-lime)] transition-all group ${
                  isRegistered
                    ? 'border-[var(--accent-lime)] ring-1 ring-[var(--accent-lime)]/40 shadow-lg shadow-[rgba(198,255,61,0.05)]'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isRegistered && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--accent-lime)] text-[#0B1020] flex items-center gap-1 shadow-sm">
                          <CheckCircle2 className="w-3 h-3" />
                          Registered
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          isLive
                            ? 'bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)] flex items-center gap-1.5 w-fit'
                            : t.status === 'completed'
                            ? 'bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)]'
                            : 'bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)]'
                        }`}
                      >
                        {isLive && <span className="live-dot" />}
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="font-sport font-black text-xl text-[var(--text-main)] group-hover:text-[var(--accent-ink)] transition-colors mt-1">
                      {t.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      {t.date}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--accent-ink)] group-hover:border-[var(--accent-lime)] transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>

                {/* Categories Pills */}
                {t.categories && t.categories.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--hairline)] flex flex-wrap gap-1.5">
                    {t.categories.map((c: Category) => (
                      <span
                        key={c.id}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)] font-mono"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
