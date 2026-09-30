'use client';

import Image from 'next/image';

import type { Tournament, Manager, AuditLog, Player } from '@/lib/types';

import { errorMessage } from '@/lib/errors';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Users, UserPlus, Trash2, Clock, AlertCircle, CheckCircle2, ArrowLeft, Search } from 'lucide-react';
import CatEmptyState from '@/components/CatEmptyState';

export default function AccessManagementPage() {
  const router = useRouter();
  const { user, profile, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [managers, setManagers] = useState<Manager[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Add manager form
  const [targetUsername, setTargetUsername] = useState('');
  const [accessLevel, setAccessLevel] = useState<'entries' | 'full'>('full');
  const [foundPlayer, setFoundPlayer] = useState<Player | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!authLoading && !profile?.is_admin) {
      router.push('/manage');
    }
  }, [authLoading, profile, router]);

  // Load tournaments
  useEffect(() => {
    async function loadTournaments() {
      const { data } = await supabase
        .from('tournaments')
        .select('id, name, date')
        .order('date', { ascending: false });

      if (data && data.length > 0) {
        setTournaments(data as unknown as Tournament[]);
        setSelectedTournamentId(data[0].id);
      }
    }

    if (profile?.is_admin) {
      loadTournaments();
    }
  }, [profile, supabase]);

  // Load managers & audit logs for selected tournament
  const loadAccessData = useCallback(async () => {
    if (!selectedTournamentId) return { managers: [], logs: [] };

    // Load managers
    const { data: mgrs } = await supabase
      .from('tournament_managers')
      .select(`
        id, level, created_at,
        player:profiles(id, username, name, avatar_id, rating)
      `)
      .eq('tournament_id', selectedTournamentId);



    // Load audit logs
    const { data: logs } = await supabase
      .from('audit_log')
      .select(`
        id, action, details, created_at,
        actor:profiles(name, username, avatar_id)
      `)
      .eq('tournament_id', selectedTournamentId)
      .order('created_at', { ascending: false })
      .limit(20);

    return { managers: (mgrs ?? []) as unknown as Manager[], logs: (logs ?? []) as unknown as AuditLog[] };
  }, [selectedTournamentId, supabase]);

  useEffect(() => {
    let active = true;
    loadAccessData().then(data => { if (active) { setManagers(data.managers); setAuditLogs(data.logs); } }).catch(error => { if (active) setErrorMsg(errorMessage(error, 'Unable to load access.')); });
    return () => { active = false; };
  }, [loadAccessData]);

  const refreshAccessData = async () => {
    const data = await loadAccessData();
    setManagers(data.managers); setAuditLogs(data.logs);
  };

  // Search player by username
  const handleSearchManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    setIsSearching(true);
    setErrorMsg('');
    setFoundPlayer(null);

    const clean = targetUsername.trim().toLowerCase().replace('@', '');

    const { data: p } = await supabase
      .from('profiles')
      .select('id, username, name, avatar_id, rating, gender')
      .eq('username', clean)
      .maybeSingle();

    if (!p) {
      setErrorMsg(`No player found with username @${clean}`);
    } else {
      setFoundPlayer(p as unknown as Player);
    }
    setIsSearching(false);
  };

  // Grant manager access
  const handleGrantAccess = async () => {
    if (!foundPlayer || !selectedTournamentId || !user) return;
    setIsAdding(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error: insErr } = await supabase.from('tournament_managers').insert({
        tournament_id: selectedTournamentId,
        player_id: foundPlayer.id,
        level: accessLevel,
      });

      if (insErr) {
        if (insErr.code === '23505') {
          throw new Error('This user is already a manager for this tournament.');
        }
        throw insErr;
      }

      // Audit log
      await supabase.from('audit_log').insert({
        tournament_id: selectedTournamentId,
        action: 'manager_access_granted',
        actor_id: user.id,
        details: {
          managerUsername: foundPlayer.username,
          level: accessLevel,
        },
      });

      setSuccessMsg(`Granted ${accessLevel.toUpperCase()} access to @${foundPlayer.username}`);
      setFoundPlayer(null);
      setTargetUsername('');
      await refreshAccessData();
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Failed to grant access.'));
    } finally {
      setIsAdding(false);
    }
  };

  // Revoke manager access
  const handleRevokeAccess = async (managerId: string, username: string) => {
    if (!confirm(`Revoke manager access for @${username}?`)) return;

    try {
      const { error } = await supabase.from('tournament_managers').delete().eq('id', managerId);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        tournament_id: selectedTournamentId,
        action: 'manager_access_revoked',
        actor_id: user?.id,
        details: { managerUsername: username },
      });

      await refreshAccessData();
    } catch (err: unknown) {
      setErrorMsg(errorMessage(err, 'Failed to revoke access.'));
    }
  };

  if (authLoading) {
    return (
      <div className="space-y-4 py-8">
        <div className="h-8 w-44 rounded-xl skeleton-box" />
        <div className="h-40 rounded-3xl skeleton-box" />
      </div>
    );
  }

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/manage"
            className="tap-target w-9 h-9 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-ink)]">
              Permissions & Delegations
            </span>
            <h1 className="font-sport font-black text-2xl md:text-3xl text-[var(--text-main)] uppercase tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-[var(--accent-ink)]" />
              Manager Access
            </h1>
          </div>
        </div>
      </div>

      {/* Tournament Selector */}
      {tournaments.length > 0 ? (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
            Target Tournament
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {tournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTournamentId(t.id)}
                className={`tap-target px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                  selectedTournamentId === t.id
                    ? 'btn-lime font-black shadow-md shadow-[rgba(198,255,61,0.2)]'
                    : 'bg-[var(--surface-raised)] border-[var(--hairline)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <CatEmptyState
          catNumber={5}
          title="No Tournaments to Delegate"
          message="Create a tournament first before assigning managers."
          actionText="Create Tournament"
          actionHref="/manage/tournaments/new"
        />
      )}

      {selectedTournamentId && (
        <>
          {/* Add Manager Section */}
          <div className="court-card p-5 rounded-3xl space-y-4">
            <div>
              <h3 className="font-sport font-extrabold text-sm text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[var(--accent-ink)]" />
                Assign Tournament Manager
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Grant helper access to manage registrations or scores for{' '}
                <span className="text-[var(--text-main)] font-semibold">
                  {selectedTournament?.name}
                </span>
                .
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[rgba(255,92,122,0.15)] border border-[rgba(255,92,122,0.3)] text-[var(--color-loss)] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-[rgba(61,220,151,0.15)] border border-[rgba(61,220,151,0.3)] text-[var(--accent-win)] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSearchManager} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder="Enter username (e.g. rohan_v)..."
                  className="w-full tap-target pl-9 pr-3.5 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-lime)]"
                />
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
              </div>
              <button
                type="submit"
                disabled={isSearching || !targetUsername.trim()}
                className="tap-target px-4 rounded-xl btn-lime text-xs font-black shrink-0 disabled:opacity-40"
              >
                {isSearching ? 'Finding...' : 'Find Player'}
              </button>
            </form>

            {foundPlayer && (
              <div className="p-4 rounded-2xl bg-[var(--surface-raised)] border border-[var(--hairline)] space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[var(--accent-lime)]">
                      <Image width={96} height={96}
                        src={`/avatars/${foundPlayer.avatar_id || 'cat-01'}.svg`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--text-main)]">
                        {foundPlayer.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] font-mono">
                        @{foundPlayer.username} • {foundPlayer.rating} Elo
                      </p>
                    </div>
                  </div>
                </div>

                {/* Level selector chips */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Access Level
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccessLevel('entries')}
                      className={`tap-target p-3 rounded-xl border text-left transition-all ${
                        accessLevel === 'entries'
                          ? 'bg-[var(--surface)] border-[var(--accent-lime)] text-[var(--text-main)]'
                          : 'bg-[var(--surface)] border-[var(--hairline)] text-[var(--text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-[var(--text-main)]">
                          Entries Only
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--hairline)] text-[var(--text-muted)]">
                          ENTRIES
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">
                        Register/edit players & seeds. Cannot finalize match scores.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessLevel('full')}
                      className={`tap-target p-3 rounded-xl border text-left transition-all ${
                        accessLevel === 'full'
                          ? 'bg-[var(--surface)] border-[var(--accent-lime)] text-[var(--text-main)] shadow-md shadow-[rgba(198,255,61,0.1)]'
                          : 'bg-[var(--surface)] border-[var(--hairline)] text-[var(--text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-[var(--accent-ink)]">
                          Full Manager
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border border-[var(--accent-lime)] font-bold">
                          FULL
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">
                        Entries, publish bracket draw, and score matches live.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFoundPlayer(null)}
                    className="tap-target px-3 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGrantAccess}
                    disabled={isAdding}
                    className="tap-target px-5 py-2 rounded-xl btn-lime text-xs font-black shadow-md shadow-[rgba(198,255,61,0.2)] disabled:opacity-50"
                  >
                    {isAdding ? 'Assigning...' : 'Confirm Delegation'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Managers List */}
          <div className="space-y-3">
            <h3 className="font-sport font-extrabold text-sm text-[var(--text-main)] uppercase tracking-wider px-1">
              Active Managers ({managers.length})
            </h3>

            {managers.length === 0 ? (
              <CatEmptyState
                catNumber={6}
                title="No Managers Assigned"
                message="Only you (the tournament owner) currently manage this tournament. Assign helpers above."
              />
            ) : (
              <div className="space-y-2">
                {managers.map((mgr) => {
                  const isFull = mgr.level === 'full';

                  return (
                    <div
                      key={mgr.id}
                      className="court-card p-3.5 rounded-2xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--hairline)]">
                          <Image width={96} height={96}
                            src={`/avatars/${mgr.player?.avatar_id || 'cat-01'}.svg`}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-[var(--text-main)]">
                            {mgr.player?.name}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] font-mono">
                            @{mgr.player?.username} • {mgr.player?.rating} Elo
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Manager Chips: "Entries" / "Full" */}
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                            isFull
                              ? 'bg-[rgba(198,255,61,0.15)] text-[var(--accent-ink)] border-[var(--accent-lime)] font-bold'
                              : 'bg-[var(--surface-raised)] text-[var(--text-muted)] border-[var(--hairline)]'
                          }`}
                        >
                          {isFull ? 'FULL' : 'ENTRIES'}
                        </span>

                        <button
                          onClick={() => handleRevokeAccess(mgr.id, mgr.player?.username)}
                          className="tap-target w-8 h-8 rounded-lg bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--color-loss)] border border-[var(--hairline)] flex items-center justify-center transition-colors"
                          title="Revoke Access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Audit Logs */}
          <div className="space-y-3 pt-2">
            <h3 className="font-sport font-extrabold text-sm text-[var(--text-main)] uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[var(--text-muted)]" />
              Recent Audit Log
            </h3>

            {auditLogs.length === 0 ? (
              <div className="p-4 court-card rounded-2xl text-center text-xs text-[var(--text-muted)]">
                No recent actions recorded for this tournament.
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 court-card rounded-2xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-mono text-xs text-[var(--text-main)]">
                        <span className="text-[var(--accent-ink)] font-bold">
                          @{log.actor?.username || 'system'}
                        </span>{' '}
                        {log.action.replace(/_/g, ' ')}
                      </p>
                      {log.details && (
                        <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                          {JSON.stringify(log.details).replace(/[{"}]/g, ' ')}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0 ml-2">
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
