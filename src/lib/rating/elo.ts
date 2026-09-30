/**
-- Badminton Elo Rating Engine
-- Pure TypeScript module with ZERO UI or DB dependencies.
-- Implements single & doubles Elo with identical partner deltas,
-- provisional K-factor weighting, single-set match factor, and peak rating tracking.
*/

export interface EloPlayer {
  id: string;
  rating: number;
  matchesPlayed: number;
  peakRating?: number;
}

export interface EloTeam {
  players: EloPlayer[];
}

export interface MatchRatingInput {
  sideA: EloTeam;
  sideB: EloTeam;
  winner: 'sideA' | 'sideB';
  isSingleSet?: boolean;
}

export interface PlayerRatingResult {
  playerId: string;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  peakRating: number;
  isProvisional: boolean;
}

export interface MatchRatingResult {
  sideA: PlayerRatingResult[];
  sideB: PlayerRatingResult[];
  deltaA: number;
  deltaB: number;
  expectedA: number;
  expectedB: number;
}

export const SINGLE_SET_DELTA_MULTIPLIER = 0.75;
export const PROVISIONAL_MATCH_THRESHOLD = 10;
export const PROVISIONAL_K = 40;
export const STANDARD_K = 24;

export const STARTING_LEVEL_RATINGS = {
  beginner: 800,
  intermediate: 1000,
  advanced: 1200,
} as const;

export type PlayerLevel = keyof typeof STARTING_LEVEL_RATINGS;

/**
 * Calculates a player's individual K-factor based on provisional status.
 */
export function getPlayerK(matchesPlayed: number): number {
  return matchesPlayed < PROVISIONAL_MATCH_THRESHOLD ? PROVISIONAL_K : STANDARD_K;
}

/**
 * Calculates the side rating:
 * In singles: player's rating.
 * In doubles: mathematical average of the two partners' ratings.
 */
export function getSideRating(team: EloTeam): number {
  if (team.players.length === 0) {
    throw new Error('Team must contain at least one player');
  }
  const sum = team.players.reduce((acc, p) => acc + p.rating, 0);
  return sum / team.players.length;
}

/**
 * Calculates the side K-factor:
 * In singles: the player's K.
 * In doubles: average of partners' K-factors.
 */
export function getSideK(team: EloTeam): number {
  if (team.players.length === 0) {
    throw new Error('Team must contain at least one player');
  }
  const sum = team.players.reduce((acc, p) => acc + getPlayerK(p.matchesPlayed), 0);
  return sum / team.players.length;
}

/**
 * Calculates the expected score for side A against side B.
 * E = 1 / (1 + 10^((R_opponent - R_side) / 400))
 */
export function calculateExpectedScore(ratingSide: number, ratingOpponent: number): number {
  return 1 / (1 + Math.pow(10, (ratingOpponent - ratingSide) / 400));
}

/**
 * Calculates rating updates for a badminton match.
 * - Single rating per player (no singles/doubles split)
 * - Doubles side rating is the average of partners' ratings
 * - Both partners receive the EXACT SAME integer delta
 * - Multiplier of 0.75 applied for single-set matches
 */
export function calculateMatchRating(input: MatchRatingInput): MatchRatingResult {
  const { sideA, sideB, winner, isSingleSet = false } = input;

  const ratingA = getSideRating(sideA);
  const ratingB = getSideRating(sideB);

  const kA = getSideK(sideA);
  const kB = getSideK(sideB);

  const expectedA = calculateExpectedScore(ratingA, ratingB);
  const expectedB = calculateExpectedScore(ratingB, ratingA);

  const scoreA = winner === 'sideA' ? 1 : 0;
  const scoreB = winner === 'sideB' ? 1 : 0;

  const multiplier = isSingleSet ? SINGLE_SET_DELTA_MULTIPLIER : 1.0;

  // Delta = K * (S - E) * multiplier, rounded to integer ONCE per side
  const deltaA = Math.round(kA * (scoreA - expectedA) * multiplier);
  const deltaB = Math.round(kB * (scoreB - expectedB) * multiplier);

  const processTeam = (team: EloTeam, delta: number): PlayerRatingResult[] => {
    return team.players.map((player) => {
      const ratingAfter = player.rating + delta;
      const currentPeak = player.peakRating ?? player.rating;
      const peakRating = Math.max(currentPeak, ratingAfter);
      const isProvisional = player.matchesPlayed < PROVISIONAL_MATCH_THRESHOLD;

      return {
        playerId: player.id,
        ratingBefore: player.rating,
        ratingAfter,
        delta,
        peakRating,
        isProvisional,
      };
    });
  };

  return {
    sideA: processTeam(sideA, deltaA),
    sideB: processTeam(sideB, deltaB),
    deltaA,
    deltaB,
    expectedA,
    expectedB,
  };
}

/**
 * Recomputes player ratings from scratch by replaying matches in order.
 * Essential for recalculating ratings when past match results are edited.
 */
export interface ReplayMatch {
  id: string;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
  winner: 'sideA' | 'sideB';
  isSingleSet?: boolean;
}

export function replayMatches(
  initialPlayers: Record<string, { rating: number; level?: PlayerLevel }>,
  matches: ReplayMatch[]
): {
  finalRatings: Record<string, { rating: number; peakRating: number; matchesPlayed: number }>;
  history: Array<{ matchId: string; playerId: string; before: number; after: number; delta: number }>;
} {
  const state: Record<string, { rating: number; peakRating: number; matchesPlayed: number }> = {};
  for (const [id, data] of Object.entries(initialPlayers)) {
    const baseRating = data.rating ?? (data.level ? STARTING_LEVEL_RATINGS[data.level] : 1000);
    state[id] = { rating: baseRating, peakRating: baseRating, matchesPlayed: 0 };
  }

  const history: Array<{ matchId: string; playerId: string; before: number; after: number; delta: number }> = [];

  for (const m of matches) {
    const sideAElo: EloTeam = {
      players: m.sideAPlayerIds.map((id) => ({
        id,
        rating: state[id]?.rating ?? 1000,
        matchesPlayed: state[id]?.matchesPlayed ?? 0,
        peakRating: state[id]?.peakRating ?? 1000,
      })),
    };

    const sideBElo: EloTeam = {
      players: m.sideBPlayerIds.map((id) => ({
        id,
        rating: state[id]?.rating ?? 1000,
        matchesPlayed: state[id]?.matchesPlayed ?? 0,
        peakRating: state[id]?.peakRating ?? 1000,
      })),
    };

    const result = calculateMatchRating({
      sideA: sideAElo,
      sideB: sideBElo,
      winner: m.winner,
      isSingleSet: m.isSingleSet,
    });

    for (const p of [...result.sideA, ...result.sideB]) {
      const current = state[p.playerId];
      if (current) {
        current.rating = p.ratingAfter;
        current.peakRating = Math.max(current.peakRating, p.ratingAfter);
        current.matchesPlayed += 1;
      }
      history.push({
        matchId: m.id,
        playerId: p.playerId,
        before: p.ratingBefore,
        after: p.ratingAfter,
        delta: p.delta,
      });
    }
  }

  return { finalRatings: state, history };
}
