import { describe, it, expect } from 'vitest';
import { calculateMatchRating, getSideRating, getSideK, calculateExpectedScore, replayMatches, STARTING_LEVEL_RATINGS } from '../src/lib/rating/elo';

describe('Badminton Elo Rating Engine', () => {
  it('correctly maps starting level ratings', () => {
    expect(STARTING_LEVEL_RATINGS.beginner).toBe(500);
    expect(STARTING_LEVEL_RATINGS.intermediate).toBe(600);
    expect(STARTING_LEVEL_RATINGS.advanced).toBe(700);
  });

  it('calculates singles ratings and provisional K factors', () => {
    const playerA = { id: 'p1', rating: 1000, matchesPlayed: 3 };
    const playerB = { id: 'p2', rating: 1000, matchesPlayed: 15 };

    const sideA = { players: [playerA] };
    const sideB = { players: [playerB] };

    expect(getSideRating(sideA)).toBe(1000);
    expect(getSideRating(sideB)).toBe(1000);
    expect(getSideK(sideA)).toBe(40); // Provisional (<10 matches)
    expect(getSideK(sideB)).toBe(24); // Standard (>=10 matches)

    const expectedA = calculateExpectedScore(1000, 1000);
    expect(expectedA).toBeCloseTo(0.5, 4);

    const result = calculateMatchRating({
      sideA,
      sideB,
      winner: 'sideA',
    });

    // Side A has K=40, wins -> delta = Math.round(40 * (1 - 0.5)) = +20
    expect(result.deltaA).toBe(20);
    expect(result.sideA[0].ratingAfter).toBe(1020);
    expect(result.sideA[0].peakRating).toBe(1020);
    expect(result.sideA[0].isProvisional).toBe(true);

    // Side B has K=24, loses -> delta = Math.round(24 * (0 - 0.5)) = -12
    expect(result.deltaB).toBe(-12);
    expect(result.sideB[0].ratingAfter).toBe(988);
    expect(result.sideB[0].isProvisional).toBe(false);
  });

  it('calculates doubles ratings with average rating and assigns EXACT SAME delta to partners', () => {
    // Team A: Partner 1 (1100, 12 matches -> K=24), Partner 2 (900, 4 matches -> K=40)
    // Team A average rating = (1100 + 900) / 2 = 1000. Team A K = (24 + 40) / 2 = 32.
    const teamA = {
      players: [
        { id: 'a1', rating: 1100, matchesPlayed: 12, peakRating: 1150 },
        { id: 'a2', rating: 900, matchesPlayed: 4, peakRating: 900 },
      ],
    };

    // Team B: Partner 1 (1050, 15 matches -> K=24), Partner 2 (950, 20 matches -> K=24)
    // Team B average rating = (1050 + 950) / 2 = 1000. Team B K = 24.
    const teamB = {
      players: [
        { id: 'b1', rating: 1050, matchesPlayed: 15, peakRating: 1050 },
        { id: 'b2', rating: 950, matchesPlayed: 20, peakRating: 980 },
      ],
    };

    expect(getSideRating(teamA)).toBe(1000);
    expect(getSideRating(teamB)).toBe(1000);
    expect(getSideK(teamA)).toBe(32);
    expect(getSideK(teamB)).toBe(24);

    const result = calculateMatchRating({
      sideA: teamA,
      sideB: teamB,
      winner: 'sideA',
    });

    // Team A delta = Math.round(32 * (1 - 0.5)) = +16
    expect(result.deltaA).toBe(16);
    // Both partners on Team A must get the EXACT SAME delta!
    expect(result.sideA[0].delta).toBe(16);
    expect(result.sideA[1].delta).toBe(16);
    expect(result.sideA[0].ratingAfter).toBe(1116);
    expect(result.sideA[1].ratingAfter).toBe(916);

    // Peak rating for a1 remains 1150 since 1116 < 1150
    expect(result.sideA[0].peakRating).toBe(1150);
    // Peak rating for a2 updates to 916 since 916 > 900
    expect(result.sideA[1].peakRating).toBe(916);

    // Team B delta = Math.round(24 * (0 - 0.5)) = -12
    expect(result.deltaB).toBe(-12);
    // Both partners on Team B must get the EXACT SAME delta!
    expect(result.sideB[0].delta).toBe(-12);
    expect(result.sideB[1].delta).toBe(-12);
    expect(result.sideB[0].ratingAfter).toBe(1038);
    expect(result.sideB[1].ratingAfter).toBe(938);
  });

  it('applies single-set match multiplier (0.75)', () => {
    const sideA = { players: [{ id: 'p1', rating: 1000, matchesPlayed: 15 }] };
    const sideB = { players: [{ id: 'p2', rating: 1000, matchesPlayed: 15 }] };

    // Standard best of 3: delta = Math.round(24 * 0.5) = 12
    const standardResult = calculateMatchRating({
      sideA,
      sideB,
      winner: 'sideA',
      isSingleSet: false,
    });
    expect(standardResult.deltaA).toBe(12);

    // Single set: delta = Math.round(24 * 0.5 * 0.75) = Math.round(9) = 9
    const singleSetResult = calculateMatchRating({
      sideA,
      sideB,
      winner: 'sideA',
      isSingleSet: true,
    });
    expect(singleSetResult.deltaA).toBe(9);
    expect(singleSetResult.deltaB).toBe(-9);
  });

  it('correctly recomputes ratings by replaying matches in order', () => {
    const initialPlayers = {
      p1: { rating: 1000 },
      p2: { rating: 1000 },
      p3: { rating: 1000 },
    };

    const matches = [
      {
        id: 'm1',
        sideAPlayerIds: ['p1'],
        sideBPlayerIds: ['p2'],
        winner: 'sideA' as const,
      },
      {
        id: 'm2',
        sideAPlayerIds: ['p1'],
        sideBPlayerIds: ['p3'],
        winner: 'sideB' as const,
      },
    ];

    const { finalRatings, history } = replayMatches(initialPlayers, matches);

    expect(history.length).toBe(4); // 2 matches * 2 players
    expect(finalRatings.p1.matchesPlayed).toBe(2);
    expect(finalRatings.p2.matchesPlayed).toBe(1);
    expect(finalRatings.p3.matchesPlayed).toBe(1);

    // Check that p1's peak rating was preserved after losing m2
    expect(finalRatings.p1.peakRating).toBeGreaterThanOrEqual(finalRatings.p1.rating);
  });
});
