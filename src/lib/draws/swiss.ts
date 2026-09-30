/**
-- Badminton Swiss-Style Pairing Engine
-- Pure TypeScript module with ZERO UI or DB dependencies.
-- Pairs players with similar points, closest ratings, avoids rematches,
-- and assigns byes to the lowest-rated player who has not had a bye yet.
*/

import { KnockoutParticipant } from './knockout';

export interface SwissPlayer extends KnockoutParticipant {
  points: number; // wins/points accumulated
  hadBye: boolean;
  previousOpponentIds: string[];
}

export interface SwissMatch {
  round: number;
  slot: number;
  entryA: KnockoutParticipant;
  entryB: KnockoutParticipant | null; // null represents a bye
  isBye: boolean;
}

export interface SwissPairingResult {
  round: number;
  matches: SwissMatch[];
  byePlayer: KnockoutParticipant | null;
}

/**
 * Generates Swiss-system pairings for a round.
 */
export function generateSwissPairings(
  players: SwissPlayer[],
  currentRound: number
): SwissPairingResult {
  if (players.length < 2) {
    throw new Error('At least 2 players are required for Swiss pairings');
  }

  const pool = [...players];
  let byePlayer: SwissPlayer | null = null;
  const matches: SwissMatch[] = [];

  // 1. Handle odd player count: Bye goes to the lowest-rated player who has not had a bye yet
  if (pool.length % 2 !== 0) {
    // Sort ascending by rating to find lowest rated
    const eligibleForBye = pool
      .filter((p) => !p.hadBye)
      .sort((a, b) => a.rating - b.rating);

    if (eligibleForBye.length > 0) {
      byePlayer = eligibleForBye[0];
    } else {
      // If everyone had a bye, pick lowest rated overall
      byePlayer = [...pool].sort((a, b) => a.rating - b.rating)[0];
    }

    // Remove bye player from active pairing pool
    const byeIdx = pool.findIndex((p) => p.id === byePlayer!.id);
    if (byeIdx !== -1) {
      pool.splice(byeIdx, 1);
    }
  }

  // 2. Sort remaining active players by points descending, then rating descending
  pool.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.rating - a.rating;
  });

  // 3. Match players with similar points & closest rating, avoiding rematches
  const pairedIds = new Set<string>();
  let slot = 1;

  for (let i = 0; i < pool.length; i++) {
    const playerA = pool[i];
    if (pairedIds.has(playerA.id)) continue;

    // Find best opponent: prioritize no-rematch, closest points, then closest rating
    let bestOpponent: SwissPlayer | null = null;
    let bestDistance = Infinity;

    for (let j = i + 1; j < pool.length; j++) {
      const candidate = pool[j];
      if (pairedIds.has(candidate.id)) continue;

      const isRematch = playerA.previousOpponentIds.includes(candidate.id);
      // Penalty for rematch: huge distance so non-rematch is preferred
      const pointsDiff = Math.abs(playerA.points - candidate.points);
      const ratingDiff = Math.abs(playerA.rating - candidate.rating);
      const distance = (isRematch ? 100000 : 0) + pointsDiff * 1000 + ratingDiff;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestOpponent = candidate;
      }
    }

    if (bestOpponent) {
      pairedIds.add(playerA.id);
      pairedIds.add(bestOpponent.id);
      matches.push({
        round: currentRound,
        slot: slot++,
        entryA: playerA,
        entryB: bestOpponent,
        isBye: false,
      });
    } else {
      // If unpaired, pair with next available
      for (let j = i + 1; j < pool.length; j++) {
        const candidate = pool[j];
        if (!pairedIds.has(candidate.id)) {
          pairedIds.add(playerA.id);
          pairedIds.add(candidate.id);
          matches.push({
            round: currentRound,
            slot: slot++,
            entryA: playerA,
            entryB: candidate,
            isBye: false,
          });
          break;
        }
      }
    }
  }

  // Add the bye match if an odd player existed
  if (byePlayer) {
    matches.push({
      round: currentRound,
      slot: slot++,
      entryA: byePlayer,
      entryB: null,
      isBye: true,
    });
  }

  return {
    round: currentRound,
    matches,
    byePlayer,
  };
}
