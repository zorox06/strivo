import { describe, it, expect } from 'vitest';
import { autoPairSolos, SoloPlayer } from '../src/lib/draws/autopair';

describe('Doubles Solo Auto-Pairing Engine', () => {
  it('pairs same-gender solos in balanced distribution: strongest with weakest', () => {
    const boys: SoloPlayer[] = [
      { id: 'b1', name: 'Boy 1', gender: 'boys', rating: 1200 },
      { id: 'b2', name: 'Boy 2', gender: 'boys', rating: 1100 },
      { id: 'b3', name: 'Boy 3', gender: 'boys', rating: 1000 },
      { id: 'b4', name: 'Boy 4', gender: 'boys', rating: 900 },
    ];

    const result = autoPairSolos(boys, 'boys');

    expect(result.success).toBe(true);
    expect(result.pairs.length).toBe(2);
    expect(result.unpairedPlayers.length).toBe(0);

    // Pair 1: Strongest (b1: 1200) with Weakest (b4: 900) -> Avg = 1050
    expect(result.pairs[0].player1.id).toBe('b1');
    expect(result.pairs[0].player2.id).toBe('b4');
    expect(result.pairs[0].pairRating).toBe(1050);

    // Pair 2: 2nd strongest (b2: 1100) with 2nd weakest (b3: 1000) -> Avg = 1050
    expect(result.pairs[1].player1.id).toBe('b2');
    expect(result.pairs[1].player2.id).toBe('b3');
    expect(result.pairs[1].pairRating).toBe(1050);
  });

  it('flags the odd leftover solo player in same-gender doubles', () => {
    const girls: SoloPlayer[] = [
      { id: 'g1', name: 'Girl 1', gender: 'girls', rating: 1200 },
      { id: 'g2', name: 'Girl 2', gender: 'girls', rating: 1100 },
      { id: 'g3', name: 'Girl 3', gender: 'girls', rating: 1000 },
      { id: 'g4', name: 'Girl 4', gender: 'girls', rating: 900 },
      { id: 'g5', name: 'Girl 5', gender: 'girls', rating: 800 },
    ];

    const result = autoPairSolos(girls, 'girls');

    expect(result.pairs.length).toBe(2);
    expect(result.unpairedPlayers.length).toBe(1);
    // The middle player (g3) is left over
    expect(result.unpairedPlayers[0].id).toBe('g3');

    // Pair 1: g1 (1200) & g5 (800) -> Avg = 1000
    expect(result.pairs[0].player1.id).toBe('g1');
    expect(result.pairs[0].player2.id).toBe('g5');
    expect(result.pairs[0].pairRating).toBe(1000);

    // Pair 2: g2 (1100) & g4 (900) -> Avg = 1000
    expect(result.pairs[1].player1.id).toBe('g2');
    expect(result.pairs[1].player2.id).toBe('g4');
    expect(result.pairs[1].pairRating).toBe(1000);
  });

  it('correctly auto-pairs Mixed Doubles (one boy + one girl) and flags excess players', () => {
    const mixedSolos: SoloPlayer[] = [
      { id: 'b1', name: 'Boy 1', gender: 'boys', rating: 1200 },
      { id: 'b2', name: 'Boy 2', gender: 'boys', rating: 1000 },
      { id: 'b3', name: 'Boy 3', gender: 'boys', rating: 900 }, // excess boy
      { id: 'g1', name: 'Girl 1', gender: 'girls', rating: 1100 },
      { id: 'g2', name: 'Girl 2', gender: 'girls', rating: 800 },
    ];

    const result = autoPairSolos(mixedSolos, 'mixed');

    expect(result.pairs.length).toBe(2);
    expect(result.unpairedPlayers.length).toBe(1);
    expect(result.unpairedPlayers[0].id).toBe('b3'); // excess boy

    // Balanced: Boy 1 (1200) with Girl 2 (800) -> Avg = 1000
    expect(result.pairs[0].player1.id).toBe('b1');
    expect(result.pairs[0].player2.id).toBe('g2');
    expect(result.pairs[0].pairRating).toBe(1000);

    // Boy 2 (1000) with Girl 1 (1100) -> Avg = 1050
    expect(result.pairs[1].player1.id).toBe('b2');
    expect(result.pairs[1].player2.id).toBe('g1');
    expect(result.pairs[1].pairRating).toBe(1050);
  });

  it('throws an error if a player has the wrong gender for a gender-restricted category', () => {
    const invalidPlayers: SoloPlayer[] = [
      { id: 'b1', name: 'Boy', gender: 'boys', rating: 1000 },
      { id: 'g1', name: 'Girl', gender: 'girls', rating: 1000 },
    ];

    expect(() => autoPairSolos(invalidPlayers, 'boys')).toThrowError(
      /has gender 'girls', but category requires 'boys'/
    );
  });
});
