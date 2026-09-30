/**
-- Badminton Solo Players Auto-Pairing Engine
-- Pure TypeScript module with ZERO UI or DB dependencies.
-- Implements balanced auto-pairing for doubles (strongest with weakest,
-- second strongest with second weakest, etc.), gender validation for Boys/Girls,
-- boy+girl matching for Mixed Doubles, and leftover player flagging.
*/

export interface SoloPlayer {
  id: string;
  name: string;
  gender: 'boys' | 'girls';
  rating: number;
}

export interface PairedTeam {
  player1: SoloPlayer;
  player2: SoloPlayer;
  pairRating: number;
}

export interface AutoPairResult {
  pairs: PairedTeam[];
  unpairedPlayers: SoloPlayer[];
  success: boolean;
  message?: string;
}

/**
 * Auto-pairs solo players in a balanced rating distribution:
 * Strongest pairs with weakest, 2nd strongest with 2nd weakest.
 * Team rating = arithmetic average of both players' ratings.
 */
export function autoPairSolos(
  solos: SoloPlayer[],
  categoryGender: 'boys' | 'girls' | 'mixed'
): AutoPairResult {
  if (solos.length === 0) {
    return { pairs: [], unpairedPlayers: [], success: true };
  }

  // 1. Same-Gender Doubles (Boys or Girls)
  if (categoryGender === 'boys' || categoryGender === 'girls') {
    // Verify gender consistency
    const invalidGender = solos.find((s) => s.gender !== categoryGender);
    if (invalidGender) {
      throw new Error(
        `Player ${invalidGender.name} has gender '${invalidGender.gender}', but category requires '${categoryGender}'`
      );
    }

    // Sort descending by rating
    const sorted = [...solos].sort((a, b) => b.rating - a.rating);

    const pairs: PairedTeam[] = [];
    const unpairedPlayers: SoloPlayer[] = [];

    const total = sorted.length;
    const numPairs = Math.floor(total / 2);

    for (let i = 0; i < numPairs; i++) {
      const strongest = sorted[i];
      const weakest = sorted[total - 1 - i];
      pairs.push({
        player1: strongest,
        player2: weakest,
        pairRating: Math.round((strongest.rating + weakest.rating) / 2),
      });
    }

    if (total % 2 !== 0) {
      // Middle player is left over
      unpairedPlayers.push(sorted[numPairs]);
    }

    return {
      pairs,
      unpairedPlayers,
      success: true,
      message:
        unpairedPlayers.length > 0
          ? `Formed ${pairs.length} pairs. 1 player could not be paired.`
          : `Formed ${pairs.length} balanced pairs.`,
    };
  }

  // 2. Mixed Doubles (One boy + one girl)
  const boys = solos.filter((s) => s.gender === 'boys').sort((a, b) => b.rating - a.rating);
  const girls = solos.filter((s) => s.gender === 'girls').sort((a, b) => b.rating - a.rating);

  const numPairs = Math.min(boys.length, girls.length);
  const pairs: PairedTeam[] = [];

  // Pair strongest boy with weakest available girl, 2nd boy with 2nd weakest, etc.
  for (let i = 0; i < numPairs; i++) {
    const boy = boys[i];
    const girl = girls[numPairs - 1 - i];
    pairs.push({
      player1: boy,
      player2: girl,
      pairRating: Math.round((boy.rating + girl.rating) / 2),
    });
  }

  // Any remaining boys or girls are flagged
  const unpairedPlayers: SoloPlayer[] = [
    ...boys.slice(numPairs),
    ...girls.slice(numPairs),
  ];

  return {
    pairs,
    unpairedPlayers,
    success: true,
    message:
      unpairedPlayers.length > 0
        ? `Formed ${pairs.length} mixed pairs. ${unpairedPlayers.length} player(s) left unpaired.`
        : `Formed ${pairs.length} balanced mixed pairs.`,
  };
}
