import { describe, it, expect } from 'vitest';
import { generateSwissPairings, SwissPlayer } from '../src/lib/draws/swiss';

describe('Swiss Pairing Engine', () => {
  it('pairs an even number of players by closest rating and points, avoiding rematches', () => {
    const players: SwissPlayer[] = [
      { id: 'p1', name: 'P1', rating: 1200, points: 2, hadBye: false, previousOpponentIds: ['p2'] },
      { id: 'p2', name: 'P2', rating: 1180, points: 2, hadBye: false, previousOpponentIds: ['p1'] },
      { id: 'p3', name: 'P3', rating: 1150, points: 2, hadBye: false, previousOpponentIds: ['p4'] },
      { id: 'p4', name: 'P4', rating: 1140, points: 2, hadBye: false, previousOpponentIds: ['p3'] },
    ];

    const result = generateSwissPairings(players, 2);

    expect(result.matches.length).toBe(2);
    expect(result.byePlayer).toBeNull();

    // P1 and P2 already played each other, so P1 should pair with P3, and P2 with P4!
    const match1 = result.matches[0];
    const match2 = result.matches[1];

    const pairs = [
      [match1.entryA.id, match1.entryB?.id].sort().join('-'),
      [match2.entryA.id, match2.entryB?.id].sort().join('-'),
    ];

    expect(pairs).toContain('p1-p3');
    expect(pairs).toContain('p2-p4');
  });

  it('allocates the bye to the lowest-rated player who has not had a bye yet when count is odd', () => {
    const players: SwissPlayer[] = [
      { id: 'p1', name: 'Top', rating: 1200, points: 1, hadBye: false, previousOpponentIds: [] },
      { id: 'p2', name: 'Mid', rating: 1050, points: 1, hadBye: false, previousOpponentIds: [] },
      { id: 'p3', name: 'Low', rating: 900, points: 0, hadBye: true, previousOpponentIds: [] }, // already had bye!
      { id: 'p4', name: 'Lowest Eligible', rating: 920, points: 0, hadBye: false, previousOpponentIds: [] }, // lowest without bye
      { id: 'p5', name: 'Higher', rating: 1000, points: 0, hadBye: false, previousOpponentIds: [] },
    ];

    const result = generateSwissPairings(players, 2);

    // Lowest eligible player who hasn't had a bye is p4 (920 vs p3 who had a bye)
    expect(result.byePlayer?.id).toBe('p4');

    const byeMatch = result.matches.find((m) => m.isBye);
    expect(byeMatch).toBeDefined();
    expect(byeMatch?.entryA.id).toBe('p4');
    expect(byeMatch?.entryB).toBeNull();

    // The other 4 players are paired into 2 matches
    const activeMatches = result.matches.filter((m) => !m.isBye);
    expect(activeMatches.length).toBe(2);
  });
});
