import type { UserProfile } from '@/context/AuthContext';
import type { MatchRules, SetScore } from '@/lib/match/rules';

export type Player = UserProfile;
export interface Tournament {
  id: string;
  name: string;
  date: string;
  status: 'draft' | 'published' | 'in_progress' | 'completed';
  rules: MatchRules;
  created_by?: string | null;
  categories?: Category[];
}
export interface Category {
  id: string;
  name: string;
  tournament_id: string;
  type: 'singles' | 'doubles';
  gender: 'boys' | 'girls' | 'mixed';
  format: 'knockout' | 'groups_knockout' | 'swiss';
  status: string;
  rules_override: MatchRules | null;
  tournament?: Tournament;
}
export interface Entry {
  id: string;
  seed?: number;
  pair_rating: number;
  is_solo: boolean;
  player1: Player;
  player2: Player | null;
}
export interface Match {
  id: string;
  round: number;
  round_name: string;
  slot: number;
  status: 'pending' | 'in_progress' | 'completed' | 'bye';
  court: string | null;
  rules_snapshot: MatchRules;
  set_scores: SetScore[];
  winner_id: string | null;
  next_match_id: string | null;
  entry_a: Entry | null;
  entry_b: Entry | null;
  category: Category;
}
export interface RatingHistory {
  id: string;
  rating_before: number;
  rating_after: number;
  delta: number;
  created_at: string;
  match: Match | null;
}
export interface Manager { id: string; level: 'entries' | 'full'; created_at: string; player: Player; }
export interface AuditLog { id: string; action: string; created_at: string; details: Record<string, unknown>; actor: Player | null; }
