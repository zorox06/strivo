'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { Category, Entry, Player } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { X, Search, Plus, AlertCircle, Loader2, Users, User } from 'lucide-react';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  existingEntries: Entry[];
  onAdd: (player1Id: string, player2Id?: string | null, isSolo?: boolean) => Promise<void>;
}

export default function AddPlayerModal({
  isOpen,
  onClose,
  category,
  existingEntries,
  onAdd,
}: AddPlayerModalProps) {
  const supabase = createClient();

  const [p1Query, setP1Query] = useState('');
  const [p1Found, setP1Found] = useState<Player | null>(null);
  const [p1Loading, setP1Loading] = useState(false);
  const [p1Error, setP1Error] = useState('');

  const [isSolo, setIsSolo] = useState(false);
  const [p2Query, setP2Query] = useState('');
  const [p2Found, setP2Found] = useState<Player | null>(null);
  const [p2Loading, setP2Loading] = useState(false);
  const [p2Error, setP2Error] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  if (!isOpen) return null;

  const isDoubles = category.type === 'doubles';

  const resetAll = () => {
    setP1Query('');
    setP1Found(null);
    setP1Loading(false);
    setP1Error('');
    setIsSolo(false);
    setP2Query('');
    setP2Found(null);
    setP2Loading(false);
    setP2Error('');
    setGeneralError('');
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // Search Player 1
  const handleSearchP1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p1Query.trim()) return;
    setP1Loading(true);
    setP1Error('');
    setP1Found(null);

    try {
      const clean = p1Query.trim().toLowerCase().replace('@', '');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, name, gender, avatar_id, rating, level')
        .eq('username', clean)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setP1Error(`No player found with username @${clean}`);
        return;
      }

      const p = data as unknown as Player;

      // Gender check
      if (category.gender !== 'mixed' && p.gender !== category.gender) {
        setP1Error(
          `@${p.username} is ${p.gender}, but this category requires ${category.gender}.`
        );
        return;
      }

      // Check already in category
      const alreadyIn = existingEntries.some(
        (ent) => ent.player1?.id === p.id || ent.player2?.id === p.id
      );
      if (alreadyIn) {
        setP1Error(`@${p.username} is already registered in this category.`);
        return;
      }

      if (p2Found && p2Found.id === p.id) {
        setP1Error('Player 1 and Player 2 cannot be the same player.');
        return;
      }

      setP1Found(p);
    } catch (err: unknown) {
      setP1Error(err instanceof Error ? err.message : 'Failed to search player');
    } finally {
      setP1Loading(false);
    }
  };

  // Search Player 2
  const handleSearchP2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p2Query.trim()) return;
    setP2Loading(true);
    setP2Error('');
    setP2Found(null);

    try {
      const clean = p2Query.trim().toLowerCase().replace('@', '');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, name, gender, avatar_id, rating, level')
        .eq('username', clean)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setP2Error(`No player found with username @${clean}`);
        return;
      }

      const p = data as unknown as Player;

      if (p1Found && p1Found.id === p.id) {
        setP2Error('Player 1 and Player 2 cannot be the same player.');
        return;
      }

      // Gender check
      if (category.gender !== 'mixed' && p.gender !== category.gender) {
        setP2Error(
          `@${p.username} is ${p.gender}, but this category requires ${category.gender}.`
        );
        return;
      }

      if (category.gender === 'mixed' && p1Found && p1Found.gender === p.gender) {
        setP2Error('Mixed doubles requires one boy and one girl.');
        return;
      }

      // Check already in category
      const alreadyIn = existingEntries.some(
        (ent) => ent.player1?.id === p.id || ent.player2?.id === p.id
      );
      if (alreadyIn) {
        setP2Error(`@${p.username} is already registered in this category.`);
        return;
      }

      setP2Found(p);
    } catch (err: unknown) {
      setP2Error(err instanceof Error ? err.message : 'Failed to search player');
    } finally {
      setP2Loading(false);
    }
  };

  const handleSubmit = async () => {
    if (!p1Found) {
      setGeneralError('Please search and select Player 1.');
      return;
    }

    if (isDoubles && !isSolo && !p2Found) {
      setGeneralError('Please select Player 2 or check "Add as Solo Entry".');
      return;
    }

    setSubmitting(true);
    setGeneralError('');
    try {
      await onAdd(p1Found.id, isDoubles && !isSolo && p2Found ? p2Found.id : null, isDoubles && isSolo);
      handleClose();
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="court-card max-w-lg w-full p-6 space-y-5 rounded-3xl border border-[var(--hairline-strong)] shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-lime-muted)] text-[var(--accent-ink)] flex items-center justify-center font-bold">
              {isDoubles ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-sport font-black text-lg text-[var(--text-main)] uppercase tracking-wide">
                Add {isDoubles ? 'Doubles Team' : 'Player'}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Category: {category.name} ({category.gender})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {generalError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Player 1 Section */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-[var(--text-muted)] tracking-wider">
            {isDoubles ? 'Player 1' : 'Player Username'}
          </label>
          <form onSubmit={handleSearchP1} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)]">
                @
              </span>
              <input
                type="text"
                value={p1Query}
                onChange={(e) => setP1Query(e.target.value)}
                placeholder="search username (e.g. abuzar)"
                className="w-full pl-7 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] focus:border-[var(--accent-lime)] text-[var(--text-main)] focus:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={p1Loading || !p1Query.trim()}
              className="px-3.5 py-2 rounded-xl btn-lime text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {p1Loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
          </form>

          {p1Error && (
            <p className="text-[11px] text-rose-400 font-medium">{p1Error}</p>
          )}

          {p1Found && (
            <div className="p-3 rounded-2xl bg-[var(--surface-raised)] border border-[var(--accent-lime)] flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <Image
                  width={40}
                  height={40}
                  src={`/avatars/${p1Found.avatar_id || 'cat-01'}.svg`}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-[var(--hairline)] bg-[var(--surface)]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--text-main)]">{p1Found.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-muted)] font-mono">
                      @{p1Found.username}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5 font-mono">
                    <span className="text-[var(--accent-ink)] font-bold">{p1Found.rating} Elo</span>
                    <span>•</span>
                    <span className="capitalize">{p1Found.level}</span>
                    <span>•</span>
                    <span className="capitalize">{p1Found.gender}</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                Selected
              </span>
            </div>
          )}
        </div>

        {/* Doubles Options */}
        {isDoubles && (
          <div className="space-y-3 pt-2 border-t border-[var(--hairline)]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-[var(--text-muted)] tracking-wider">
                Doubles Partner Mode
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-main)] font-bold">
                <input
                  type="checkbox"
                  checked={isSolo}
                  onChange={(e) => {
                    setIsSolo(e.target.checked);
                    if (e.target.checked) {
                      setP2Found(null);
                      setP2Query('');
                      setP2Error('');
                    }
                  }}
                  className="rounded border-[var(--hairline)] text-[var(--accent-lime)] focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Add as Solo Entry (Needs Partner)</span>
              </label>
            </div>

            {!isSolo && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-[var(--text-muted)] tracking-wider">
                  Player 2 (Partner)
                </label>
                <form onSubmit={handleSearchP2} className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)]">
                      @
                    </span>
                    <input
                      type="text"
                      value={p2Query}
                      onChange={(e) => setP2Query(e.target.value)}
                      placeholder="search partner username"
                      className="w-full pl-7 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] focus:border-[var(--accent-lime)] text-[var(--text-main)] focus:outline-none transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={p2Loading || !p2Query.trim()}
                    className="px-3.5 py-2 rounded-xl btn-lime text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {p2Loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Search</span>
                  </button>
                </form>

                {p2Error && (
                  <p className="text-[11px] text-rose-400 font-medium">{p2Error}</p>
                )}

                {p2Found && (
                  <div className="p-3 rounded-2xl bg-[var(--surface-raised)] border border-[var(--accent-lime)] flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                      <Image
                        width={40}
                        height={40}
                        src={`/avatars/${p2Found.avatar_id || 'cat-02'}.svg`}
                        alt="Avatar"
                        className="w-10 h-10 rounded-full border border-[var(--hairline)] bg-[var(--surface)]"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[var(--text-main)]">{p2Found.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-muted)] font-mono">
                            @{p2Found.username}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5 font-mono">
                          <span className="text-[var(--accent-ink)] font-bold">{p2Found.rating} Elo</span>
                          <span>•</span>
                          <span className="capitalize">{p2Found.level}</span>
                          <span>•</span>
                          <span className="capitalize">{p2Found.gender}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                      Partner
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--hairline)]">
          <button
            type="button"
            onClick={handleClose}
            className="tap-target px-4 py-2 rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !p1Found || (isDoubles && !isSolo && !p2Found)}
            onClick={handleSubmit}
            className="tap-target px-5 py-2 rounded-xl btn-lime text-xs font-black flex items-center gap-2 shadow-md shadow-[rgba(198,255,61,0.2)] disabled:opacity-50 hover:scale-102 transition-all"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Confirm & Add {isDoubles ? (isSolo ? 'Solo Player' : 'Team') : 'Player'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
