import { describe, it, expect } from 'vitest';
import { DEFAULT_MATCH_RULES } from '../src/lib/match/rules';
import { evaluateSheetSetScore, evaluateSheetMatch, formatMatchupInfo } from '../src/lib/match/scoring';

describe('Scoresheet Evaluation Module', () => {
  it('correctly evaluates user prompt singles format: a vs b set1 12-15 (B wins)', () => {
    const set1 = evaluateSheetSetScore(DEFAULT_MATCH_RULES, 1, 12, 15);
    expect(set1.isFinished).toBe(true);
    expect(set1.winner).toBe('sideB');

    // In a 1-set or preliminary match with only Set 1 entered
    const match1 = evaluateSheetMatch(
      { ...DEFAULT_MATCH_RULES, sets: 1 },
      [{ set: 1, side_a: 12, side_b: 15 }]
    );
    expect(match1.isFinished).toBe(true);
    expect(match1.winner).toBe('sideB');
    expect(match1.setsWonB).toBe(1);
  });

  it('correctly evaluates user prompt doubles format: team a vs team b 15-13 (Team A wins)', () => {
    const set1 = evaluateSheetSetScore(DEFAULT_MATCH_RULES, 1, 15, 13);
    expect(set1.isFinished).toBe(true);
    expect(set1.winner).toBe('sideA');

    const match1 = evaluateSheetMatch(
      { ...DEFAULT_MATCH_RULES, sets: 1 },
      [{ set: 1, side_a: 15, side_b: 13 }]
    );
    expect(match1.isFinished).toBe(true);
    expect(match1.winner).toBe('sideA');
    expect(match1.setsWonA).toBe(1);
  });

  it('evaluates best of 3 sets: 12-15, 21-18, 15-13 (Side A wins 2-1)', () => {
    const match = evaluateSheetMatch(DEFAULT_MATCH_RULES, [
      { set: 1, side_a: 12, side_b: 15 },
      { set: 2, side_a: 21, side_b: 18 },
      { set: 3, side_a: 15, side_b: 13 },
    ]);

    expect(match.isFinished).toBe(true);
    expect(match.winner).toBe('sideA');
    expect(match.setsWonA).toBe(2);
    expect(match.setsWonB).toBe(1);
  });

  it('formats singles matchup labels', () => {
    const info = formatMatchupInfo(
      'singles',
      { player1: { name: 'Arjun Verma' } },
      { player1: { name: 'Vikram Singh' } }
    );

    expect(info.isDoubles).toBe(false);
    expect(info.title).toBe('Arjun Verma vs Vikram Singh');
    expect(info.shortA).toBe('Arjun');
    expect(info.shortB).toBe('Vikram');
  });

  it('formats doubles matchup labels', () => {
    const info = formatMatchupInfo(
      'doubles',
      { player1: { name: 'Arjun' }, player2: { name: 'Dev' } },
      { player1: { name: 'Vikram' }, player2: { name: 'Leo' } }
    );

    expect(info.isDoubles).toBe(true);
    expect(info.title).toBe('Team A vs Team B');
    expect(info.sideAPlayers).toBe('Arjun & Dev');
    expect(info.sideBPlayers).toBe('Vikram & Leo');
    expect(info.shortA).toBe('Team A');
    expect(info.shortB).toBe('Team B');
  });
});
