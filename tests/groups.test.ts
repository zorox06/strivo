import { describe, it, expect } from 'vitest';
import { snakeDistribute, generateGroupMatches, calculateGroupStandings, qualifyGroupTop2 } from '../src/lib/draws/groups';

describe('Group Stage & Snake Distribution', () => {
  it('correctly distributes 9 players into 3 groups via snake distribution (A, B, C, C, B, A, A, B, C)', () => {
    const players = [
      { id: 'p1', name: 'P1', rating: 1200 },
      { id: 'p2', name: 'P2', rating: 1100 },
      { id: 'p3', name: 'P3', rating: 1050 },
      { id: 'p4', name: 'P4', rating: 1000 },
      { id: 'p5', name: 'P5', rating: 950 },
      { id: 'p6', name: 'P6', rating: 900 },
      { id: 'p7', name: 'P7', rating: 850 },
      { id: 'p8', name: 'P8', rating: 800 },
      { id: 'p9', name: 'P9', rating: 750 },
    ];

    const groups = snakeDistribute(players, 3);

    // Group A should get: 1st (p1), 6th (p6), 7th (p7)
    expect(groups['A'].map((p) => p.id)).toEqual(['p1', 'p6', 'p7']);

    // Group B should get: 2nd (p2), 5th (p5), 8th (p8)
    expect(groups['B'].map((p) => p.id)).toEqual(['p2', 'p5', 'p8']);

    // Group C should get: 3rd (p3), 4th (p4), 9th (p9)
    expect(groups['C'].map((p) => p.id)).toEqual(['p3', 'p4', 'p9']);
  });

  it('generates all round-robin matches for groups', () => {
    const groups = {
      A: [
        { id: 'p1', name: 'P1', rating: 1200 },
        { id: 'p2', name: 'P2', rating: 1100 },
        { id: 'p3', name: 'P3', rating: 1000 },
      ],
    };

    const matches = generateGroupMatches(groups);
    // For 3 players: 3 matches (1v2, 1v3, 2v3)
    expect(matches.length).toBe(3);
    expect(matches[0].entryA.id).toBe('p1');
    expect(matches[0].entryB.id).toBe('p2');
    expect(matches[1].entryA.id).toBe('p1');
    expect(matches[1].entryB.id).toBe('p3');
    expect(matches[2].entryA.id).toBe('p2');
    expect(matches[2].entryB.id).toBe('p3');
  });

  it('calculates group standings based on match wins, set difference, and points', () => {
    const participants = [
      { id: 'p1', name: 'P1', rating: 1200 },
      { id: 'p2', name: 'P2', rating: 1000 },
      { id: 'p3', name: 'P3', rating: 800 },
    ];

    // p1 beats p2 (2-0 sets, 42-30 points)
    // p1 beats p3 (2-0 sets, 42-20 points)
    // p2 beats p3 (2-1 sets, 55-50 points)
    const matches = [
      {
        entryAId: 'p1',
        entryBId: 'p2',
        setsWonA: 2,
        setsWonB: 0,
        pointsA: 42,
        pointsB: 30,
        winnerId: 'p1',
      },
      {
        entryAId: 'p1',
        entryBId: 'p3',
        setsWonA: 2,
        setsWonB: 0,
        pointsA: 42,
        pointsB: 20,
        winnerId: 'p1',
      },
      {
        entryAId: 'p2',
        entryBId: 'p3',
        setsWonA: 2,
        setsWonB: 1,
        pointsA: 55,
        pointsB: 50,
        winnerId: 'p2',
      },
    ];

    const standings = calculateGroupStandings(participants, matches);

    expect(standings[0].participant.id).toBe('p1');
    expect(standings[0].won).toBe(2);
    expect(standings[0].rank).toBe(1);

    expect(standings[1].participant.id).toBe('p2');
    expect(standings[1].won).toBe(1);
    expect(standings[1].rank).toBe(2);

    expect(standings[2].participant.id).toBe('p3');
    expect(standings[2].won).toBe(0);
    expect(standings[2].rank).toBe(3);
  });

  it('qualifies top 2 from each group for knockout stage', () => {
    const groupAStandings = [
      { participant: { id: 'a1', name: 'A1', rating: 1200 }, rank: 1, won: 2, lost: 0, played: 2, setsWon: 4, setsLost: 0, pointsWon: 84, pointsLost: 40, pointsDiff: 44 },
      { participant: { id: 'a2', name: 'A2', rating: 1000 }, rank: 2, won: 1, lost: 1, played: 2, setsWon: 2, setsLost: 2, pointsWon: 70, pointsLost: 70, pointsDiff: 0 },
      { participant: { id: 'a3', name: 'A3', rating: 800 }, rank: 3, won: 0, lost: 2, played: 2, setsWon: 0, setsLost: 4, pointsWon: 40, pointsLost: 84, pointsDiff: -44 },
    ];

    const groupBStandings = [
      { participant: { id: 'b1', name: 'B1', rating: 1150 }, rank: 1, won: 2, lost: 0, played: 2, setsWon: 4, setsLost: 0, pointsWon: 84, pointsLost: 45, pointsDiff: 39 },
      { participant: { id: 'b2', name: 'B2', rating: 950 }, rank: 2, won: 1, lost: 1, played: 2, setsWon: 2, setsLost: 3, pointsWon: 65, pointsLost: 75, pointsDiff: -10 },
    ];

    const qualifiers = qualifyGroupTop2({
      A: groupAStandings,
      B: groupBStandings,
    });

    expect(qualifiers.map((p) => p.id)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });
});
