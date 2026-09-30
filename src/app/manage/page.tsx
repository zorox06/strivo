'use client';

import type { Tournament } from '@/lib/types';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Settings, PlusCircle, Users, Shield, Calendar, ChevronRight } from 'lucide-react';
import CatEmptyState from '@/components/CatEmptyState';

export default function ManageDashboardPage() {
  const router = useRouter();
  const { user, profile, hasTournamentAccess, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !hasTournamentAccess) {
      router.push('/');
    }
  }, [authLoading, hasTournamentAccess, router]);

  useEffect(() => {
    async function loadManagedTournaments() {
      if (!user) return;
      try {
        let query = supabase
          .from('tournaments')
          .select('id, name, date, status, rules, categories(id, name, type, gender)')
          .order('date', { ascending: false });

        // If not owner, filter by tournament_managers
        if (!profile?.is_admin) {
          const { data: managers } = await supabase
            .from('tournament_managers')
            .select('tournament_id')
            .eq('player_id', user.id);

          const ids = managers?.map((m) => m.tournament_id) || [];
          if (ids.length > 0) {
            query = query.in('id', ids);
          } else {
            setTournaments([]);
            setIsLoading(false);
            return;
          }
        }

        const { data } = await query;
        if (data) setTournaments(data as unknown as Tournament[]);
      } catch (err) {
        console.error('Error loading managed tournaments:', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (user && hasTournamentAccess) {
      loadManagedTournaments();
    }
  }, [user, profile, hasTournamentAccess, supabase]);

  if (authLoading || isLoading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-8 w-44 rounded-xl skeleton-box" />
        <div className="h-32 rounded-3xl skeleton-box" />
      </div>
    );
  }

  if (!hasTournamentAccess) {
    return (
      <div className="p-8 court-card rounded-2xl text-center space-y-3">
        <Shield className="w-10 h-10 text-[var(--color-loss)] mx-auto mb-2" />
        <p className="font-sport font-black text-lg text-[var(--text-main)] uppercase">
          Access Restricted
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          You need organizer or manager permissions to view this portal.
        </p>
      </div>
    );
  }

  const activeCount = tournaments.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--accent-ink)]">
              {profile?.is_admin ? 'Owner Portal' : 'Manager Portal'}
            </span>
            {activeCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent-ink)]">
                <span className="live-dot" />
                {activeCount} Live
              </span>
            )}
          </div>
          <h1 className="font-sport font-black text-2xl md:text-3xl text-[var(--text-main)] uppercase tracking-tight mt-1 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[var(--accent-ink)]" />
            Tournament Management
          </h1>
        </div>

        {profile?.is_admin && (
          <Link
            href="/manage/tournaments/new"
            className="tap-target px-3.5 py-2 rounded-xl btn-lime text-xs font-black flex items-center gap-1.5 shadow-md shadow-[rgba(198,255,61,0.2)] transition-all hover:scale-102"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Tournament</span>
            <span className="sm:hidden">Create</span>
          </Link>
        )}
      </div>

      {/* Admin Quick Action Cards */}
      {profile?.is_admin && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/manage/tournaments/new"
            className="p-4 court-card-raised rounded-2xl hover:border-[var(--accent-lime)] transition-all group flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-lime)] text-[#0B1020] flex items-center justify-center font-black shrink-0 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-sport font-black text-sm text-[var(--text-main)] uppercase tracking-wide">
                New Tournament
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                3-step rules & draw
              </p>
            </div>
          </Link>

          <Link
            href="/manage/access"
            className="p-4 court-card-raised rounded-2xl hover:border-[var(--accent-lime)] transition-all group flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center text-[var(--accent-ink)] shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-sport font-black text-sm text-[var(--text-main)] uppercase tracking-wide">
                Manager Access
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Permissions & audit
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* Managed Tournaments List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-sport font-extrabold text-sm text-[var(--text-main)] uppercase tracking-wider">
            Your Tournaments ({tournaments.length})
          </h3>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {profile?.is_admin ? 'Full Access' : 'Assigned Tournaments'}
          </span>
        </div>

        {tournaments.length === 0 ? (
          <CatEmptyState
            catNumber={3}
            title="No Tournaments Yet"
            message={
              profile?.is_admin
                ? 'Set up rules, enable singles or doubles categories, and publish brackets in 3 quick steps.'
                : 'You have not been assigned to manage any tournaments yet.'
            }
            actionText={profile?.is_admin ? 'Create First Tournament' : undefined}
            actionHref={profile?.is_admin ? '/manage/tournaments/new' : undefined}
          />
        ) : (
          <div className="space-y-2.5">
            {tournaments.map((t) => {
              const isLive = t.status === 'in_progress';

              return (
                <Link
                  key={t.id}
                  href={`/manage/tournaments/${t.id}`}
                  className="block court-card p-4 rounded-2xl hover:border-[var(--accent-lime)] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isLive
                              ? 'bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)] flex items-center gap-1.5'
                              : 'bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--hairline)]'
                          }`}
                        >
                          {isLive && <span className="live-dot" />}
                          {t.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                          {t.date}
                        </span>
                      </div>

                      <h4 className="font-sport font-black text-lg text-[var(--text-main)] group-hover:text-[var(--accent-ink)] transition-colors tracking-tight">
                        {t.name}
                      </h4>

                      {t.categories && (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {t.categories.length} Categories • Best of {t.rules?.sets || 3} sets to {t.rules?.points_per_set || 21} pts
                        </p>
                      )}
                    </div>

                    <div className="w-9 h-9 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--accent-ink)] group-hover:border-[var(--accent-lime)] transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
