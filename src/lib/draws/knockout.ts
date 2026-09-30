/**
-- Badminton Knockout Bracket Generator
-- Pure TypeScript module with ZERO UI or DB dependencies.
-- Implements standard rating-based seeded knockout draw, power-of-two bracket sizing,
-- automatic bye allocation to top seeds, and progression tree generation.
*/

export interface KnockoutParticipant {
  id: string; // entry ID
  name: string;
  rating: number;
  seed?: number;
}

export interface KnockoutMatchNode {
  round: number;
  roundName: string;
  slot: number;
  entryA: KnockoutParticipant | null;
  entryB: KnockoutParticipant | null;
  isBye: boolean;
  winner: KnockoutParticipant | null;
}

export interface KnockoutRound {
  round: number;
  roundName: string;
  matches: KnockoutMatchNode[];
}

export interface KnockoutDrawResult {
  bracketSize: number;
  roundsCount: number;
  participantsCount: number;
  byesCount: number;
  rounds: KnockoutRound[];
}

/**
 * Finds the next power of 2 greater than or equal to n (minimum 2).
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 2) return 2;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Generates standard tournament seed placement for a bracket of size power-of-2.
 * Example for 8: [1, 8, 4, 5, 3, 6, 2, 7]
 */
export function generateSeedOrder(size: number): number[] {
  if (size <= 2) return [1, 2].slice(0, size);
  if (size === 4) return [1, 4, 3, 2];

  let topSeeds = [1, 2];
  while (topSeeds.length < size / 2) {
    const next: number[] = [];
    const sum = topSeeds.length * 2 + 1;
    for (let i = 0; i < topSeeds.length; i++) {
      const s = topSeeds[i];
      if (i < topSeeds.length / 2) {
        next.push(s);
        next.push(sum - s);
      } else {
        next.push(sum - s);
        next.push(s);
      }
    }
    topSeeds = next;
  }

  const result: number[] = [];
  const pairSum = size + 1;
  for (const s of topSeeds) {
    result.push(s);
    result.push(pairSum - s);
  }
  return result;
}

/**
 * Returns human-friendly round name based on remaining players in that round.
 */
export function getRoundName(playersInRound: number): string {
  if (playersInRound === 2) return 'Final';
  if (playersInRound === 4) return 'Semifinals';
  if (playersInRound === 8) return 'Quarterfinals';
  if (playersInRound === 16) return 'Round of 16';
  if (playersInRound === 32) return 'Round of 32';
  if (playersInRound === 64) return 'Round of 64';
  return `Round of ${playersInRound}`;
}

/**
 * Generates a complete rating-seeded knockout draw.
 * 1. Participants are sorted by rating descending.
 * 2. Seeds are assigned 1 to N.
 * 3. Bracket is sized to the next power of 2.
 * 4. Byes are awarded to the highest seeds (1, 2, ...).
 * 5. Matches are arranged round-by-round with byes auto-advancing.
 */
export function generateKnockoutDraw(
  participants: KnockoutParticipant[]
): KnockoutDrawResult {
  if (participants.length < 2) {
    throw new Error('At least 2 participants are required for a knockout draw');
  }

  // 1. Sort by rating descending. Preserve pre-assigned seed if tied or use stable sort
  const sorted = [...participants].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (a.seed && b.seed) return a.seed - b.seed;
    return a.id.localeCompare(b.id);
  });

  // Assign seeds 1..N
  const seededParticipants: (KnockoutParticipant & { seed: number })[] = sorted.map(
    (p, idx) => ({
      ...p,
      seed: p.seed ?? idx + 1,
    })
  );

  const bracketSize = nextPowerOfTwo(seededParticipants.length);
  const byesCount = bracketSize - seededParticipants.length;
  const roundsCount = Math.log2(bracketSize);

  // Map seed number -> participant
  const seedMap = new Map<number, KnockoutParticipant & { seed: number }>();
  seededParticipants.forEach((p) => seedMap.set(p.seed, p));

  const seedOrder = generateSeedOrder(bracketSize);
  const round1Matches: KnockoutMatchNode[] = [];

  // Round 1 matches
  for (let i = 0; i < seedOrder.length; i += 2) {
    const seedA = seedOrder[i];
    const seedB = seedOrder[i + 1];

    const entryA = seedMap.get(seedA) ?? null;
    const entryB = seedMap.get(seedB) ?? null;

    const isBye = entryA === null || entryB === null;
    const winner = isBye ? (entryA ?? entryB) : null;

    round1Matches.push({
      round: 1,
      roundName: getRoundName(bracketSize),
      slot: Math.floor(i / 2) + 1,
      entryA,
      entryB,
      isBye,
      winner,
    });
  }

  const rounds: KnockoutRound[] = [
    {
      round: 1,
      roundName: getRoundName(bracketSize),
      matches: round1Matches,
    },
  ];

  // Build subsequent rounds up to the Final
  let previousRoundMatches = round1Matches;
  for (let r = 2; r <= roundsCount; r++) {
    const playersInRound = Math.pow(2, roundsCount - r + 1);
    const roundMatches: KnockoutMatchNode[] = [];
    const numMatches = previousRoundMatches.length / 2;

    for (let slot = 1; slot <= numMatches; slot++) {
      const matchPrev1 = previousRoundMatches[(slot - 1) * 2];
      const matchPrev2 = previousRoundMatches[(slot - 1) * 2 + 1];

      // If previous match had a bye, advance the winner automatically
      const entryA = matchPrev1.isBye ? matchPrev1.winner : null;
      const entryB = matchPrev2.isBye ? matchPrev2.winner : null;

      roundMatches.push({
        round: r,
        roundName: getRoundName(playersInRound),
        slot,
        entryA,
        entryB,
        isBye: false,
        winner: null,
      });
    }

    rounds.push({
      round: r,
      roundName: getRoundName(playersInRound),
      matches: roundMatches,
    });
    previousRoundMatches = roundMatches;
  }

  return {
    bracketSize,
    roundsCount,
    participantsCount: participants.length,
    byesCount,
    rounds,
  };
}
