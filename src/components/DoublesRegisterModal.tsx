'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { Category, Entry, Player } from '@/lib/types';
import type { UserProfile } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { X, Search, CheckCircle2, AlertCircle, Loader2, Users } from 'lucide-react';

interface DoublesRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  userProfile: UserProfile;
  existingEntries: Entry[];
  onRegister: (partnerId: string) => Promise<void>;
}

export default function DoublesRegisterModal({
  isOpen,
  onClose,
  category,
  userProfile,
  existingEntries,
  onRegister,
}: DoublesRegisterModalProps) {
  const supabase = createClient();

  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerFound, setPartnerFound] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setPartnerQuery('');
    setPartnerFound(null);
    setLoading(false);
    setError('');
    onClose();
  };

  const handleSearchPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerQuery.trim()) return;
    setLoading(true);
    setError('');
    setPartnerFound(null);

    try {
      const clean = partnerQuery.trim().toLowerCase().replace('@', '');

      if (clean === userProfile.username.toLowerCase()) {
        setError('You cannot partner with yourself.');
        return;
      }

      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, username, name, gender, avatar_id, rating, level')
        .eq('username', clean)
        .maybeSingle();

      if (err) throw err;
      if (!data) {
        setError(`No player found with username @${clean}`);
        return;
      }

      const p = data as unknown as Player;

      // Gender validation
      if (category.gender !== 'mixed' && p.gender !== category.gender) {
        setError(
          `@${p.username} is registered as ${p.gender}, but this category requires ${category.gender}.`
        );
        return;
      }

      if (category.gender === 'mixed' && p.gender === userProfile.gender) {
        setError('Mixed doubles requires one boy and one girl.');
        return;
      }

      // Check if partner already registered
      const alreadyIn = existingEntries.some(
        (ent) => ent.player1?.id === p.id || ent.player2?.id === p.id
      );
      if (alreadyIn) {
        setError(`@${p.username} is already registered in this category.`);
        return;
      }

      setPartnerFound(p);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to search partner');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!partnerFound) {
      setError('Please search and select a partner.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onRegister(partnerFound.id);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sport font-black text-lg text-[var(--text-main)] uppercase tracking-wide">
                Register as Doubles Pair
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Category: {category.name}
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

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* You (Player 1) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Player 1 (You)
          </label>
          <div className="p-3 rounded-2xl bg-[rgba(198,255,61,0.06)] border border-[var(--accent-lime)] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <Image
                width={40}
                height={40}
                src={`/avatars/${userProfile.avatar_id || 'cat-01'}.svg`}
                alt="Your Avatar"
                className="w-10 h-10 rounded-full border border-[var(--accent-lime)] bg-[var(--surface)]"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[var(--accent-ink)]">{userProfile.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-muted)] font-mono">
                    @{userProfile.username}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5 font-mono">
                  <span className="text-[var(--accent-ink)] font-bold">{userProfile.rating} Elo</span>
                  <span>•</span>
                  <span className="capitalize">{userProfile.gender}</span>
                </div>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-[var(--accent-lime)] text-[#0B1020] px-2 py-0.5 rounded">
              YOU
            </span>
          </div>
        </div>

        {/* Partner Search */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Find Partner
          </label>
          <form onSubmit={handleSearchPartner} className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)]">
                @
              </span>
              <input
                type="text"
                value={partnerQuery}
                onChange={(e) => setPartnerQuery(e.target.value)}
                placeholder="search by username"
                className="w-full pl-7 pr-3 py-2 text-xs rounded-xl bg-[var(--surface-raised)] border border-[var(--hairline)] focus:border-[var(--accent-lime)] text-[var(--text-main)] focus:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !partnerQuery.trim()}
              className="px-3.5 py-2 rounded-xl btn-lime text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
          </form>

          {partnerFound && (
            <div className="p-3 rounded-2xl bg-[var(--surface-raised)] border border-[var(--accent-lime)] flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <Image
                  width={40}
                  height={40}
                  src={`/avatars/${partnerFound.avatar_id || 'cat-02'}.svg`}
                  alt="Partner Avatar"
                  className="w-10 h-10 rounded-full border border-[var(--hairline)] bg-[var(--surface)]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[var(--text-main)]">{partnerFound.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-muted)] font-mono">
                      @{partnerFound.username}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5 font-mono">
                    <span className="text-[var(--accent-ink)] font-bold">{partnerFound.rating} Elo</span>
                    <span>•</span>
                    <span className="capitalize">{partnerFound.level}</span>
                    <span>•</span>
                    <span className="capitalize">{partnerFound.gender}</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                Partner Selected
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
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
            disabled={submitting || !partnerFound}
            onClick={handleSubmit}
            className="tap-target px-5 py-2 rounded-xl btn-lime text-xs font-black flex items-center gap-2 shadow-md shadow-[rgba(198,255,61,0.2)] disabled:opacity-50 hover:scale-102 transition-all"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Register Doubles Pair</span>
          </button>
        </div>
      </div>
    </div>
  );
}
