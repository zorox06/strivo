'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name: string;
  gender: 'boys' | 'girls';
  avatar_id: string;
  bio: string;
  level: 'beginner' | 'amateur' | 'intermediate' | 'advanced' | 'professional';
  rating: number;
  peak_rating: number;
  matches_played: number;
  is_admin: boolean;
  phone?: string | null;
  show_phone?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  hasTournamentAccess: boolean;
  managedTournamentIds: string[];
  canManageTournament: (tournamentId: string, createdBy?: string | null) => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  hasTournamentAccess: false,
  managedTournamentIds: [],
  canManageTournament: () => false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [managedTournamentIds, setManagedTournamentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();
  const profileRequest = useRef(0);
  const invalidateProfile = useCallback(() => { profileRequest.current++; }, []);

  const loadProfile = useCallback(async (authUser: User) => {
    const request = ++profileRequest.current;
    try {
      // 1. Fetch profile
      const { data: prof, error: profErr } = await supabase
        .from('profiles_view')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (request !== profileRequest.current) return;
      if (profErr) throw profErr;

      if (prof) {
        setProfile(prof as UserProfile);

        // 2. Fetch manager roles and created tournaments
        const [{ data: managers }, { data: createdTourneys }] = await Promise.all([
          supabase
            .from('tournament_managers')
            .select('tournament_id')
            .eq('player_id', authUser.id),
          supabase
            .from('tournaments')
            .select('id')
            .eq('created_by', authUser.id),
        ]);

        if (request !== profileRequest.current) return;
        const allIds = new Set<string>();
        managers?.forEach((m) => allIds.add(m.tournament_id));
        createdTourneys?.forEach((t) => allIds.add(t.id));
        setManagedTournamentIds(Array.from(allIds));
      } else {
        setProfile(null);
        setManagedTournamentIds([]);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      if (request === profileRequest.current) {
        setProfile(null);
        setManagedTournamentIds([]);
      }
    }
  }, [supabase]);

  const refreshProfile = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser(currentUser);
      await loadProfile(currentUser);
    } else {
      setUser(null);
      setProfile(null);
      setManagedTournamentIds([]);
    }
  };

  useEffect(() => {
    let active = true;
    let profileTimer: ReturnType<typeof setTimeout> | undefined;
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        clearTimeout(profileTimer);
        if (session?.user) {
          setUser(session.user);
          // Auth callbacks run while Supabase holds its session lock.
          // Query after the callback returns to avoid blocking sign-in.
          const authUser = session.user;
          profileTimer = setTimeout(() => { if (active) void loadProfile(authUser); }, 0);
        } else {
          profileRequest.current++;
          setUser(null);
          setProfile(null);
          setManagedTournamentIds([]);
        }
        setIsLoading(false);
      }
    );

    return () => {
      active = false;
      clearTimeout(profileTimer);
      invalidateProfile();
      subscription.unsubscribe();
    };
  }, [loadProfile, supabase, invalidateProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      profileRequest.current++;
      setUser(null);
      setProfile(null);
      setManagedTournamentIds([]);
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  const hasTournamentAccess = !!profile?.is_admin || managedTournamentIds.length > 0;

  const canManageTournament = useCallback(
    (tournamentId: string, createdBy?: string | null) => {
      if (profile?.is_admin) return true;
      if (managedTournamentIds.includes(tournamentId)) return true;
      if (createdBy && user?.id && createdBy === user.id) return true;
      return false;
    },
    [profile?.is_admin, managedTournamentIds, user?.id]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        hasTournamentAccess,
        managedTournamentIds,
        canManageTournament,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
