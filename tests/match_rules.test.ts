import { describe, it, expect } from 'vitest';
import { evaluateSetScore, evaluateMatch, DEFAULT_MATCH_RULES, MatchRules } from '../src/lib/match/rules';

describe('Badminton Match Rules & Score Validation', () => {
  it('validates a standard set with 21 points and win by 2', () => {
    // 21-19: valid win
    const res1 = evaluateSetScore(DEFAULT_MATCH_RULES, 1, 21, 19);
    expect(res1.isFinished).toBe(true);
    expect(res1.winner).toBe('sideA');

    // 20-20: deuce / ongoing
    const res2 = evaluateSetScore(DEFAULT_MATCH_RULES, 1, 20, 20);
    expect(res2.isFinished).toBe(false);
    expect(res2.winner).toBeNull();

    // 22-20: win by 2
    const res3 = evaluateSetScore(DEFAULT_MATCH_RULES, 1, 20, 22);
    expect(res3.isFinished).toBe(true);
    expect(res3.winner).toBe('sideB');
  });

  it('respects point cap of 30 points', () => {
    // 29-29: ongoing
    const res1 = evaluateSetScore(DEFAULT_MATCH_RULES, 1, 29, 29);
    expect(res1.isFinished).toBe(false);

    // 30-29: reaches cap of 30, wins without needing 2-point lead!
    const res2 = evaluateSetScore(DEFAULT_MATCH_RULES, 1, 30, 29);
    expect(res2.isFinished).toBe(true);
    expect(res2.winner).toBe('sideA');
  });

  it('handles deciding set points override (e.g. 15 points in 3rd set)', () => {
    const rulesWithDeciding: MatchRules = {
      ...DEFAULT_MATCH_RULES,
      sets: 3,
      deciding_set_points: 15,
    };

    // Set 1: 15-13 is not finished because regular set target is 21
    const set1 = evaluateSetScore(rulesWithDeciding, 1, 15, 13);
    expect(set1.isFinished).toBe(false);

    // Set 3 (deciding set): 15-13 IS finished!
    const set3 = evaluateSetScore(rulesWithDeciding, 3, 15, 13);
    expect(set3.isFinished).toBe(true);
    expect(set3.winner).toBe('sideA');
  });

  it('automatically finishes match when required sets are won in best of 3', () => {
    // Side A wins 2 straight sets (21-15, 21-18)
    const matchRes1 = evaluateMatch(DEFAULT_MATCH_RULES, [
      { set: 1, side_a: 21, side_b: 15 },
      { set: 2, side_a: 21, side_b: 18 },
    ]);

    expect(matchRes1.isFinished).toBe(true);
    expect(matchRes1.winner).toBe('sideA');
    expect(matchRes1.setsWonA).toBe(2);
    expect(matchRes1.setsWonB).toBe(0);

    // 1-1 split, 3rd set unfinished
    const matchRes2 = evaluateMatch(DEFAULT_MATCH_RULES, [
      { set: 1, side_a: 21, side_b: 15 },
      { set: 2, side_a: 18, side_b: 21 },
      { set: 3, side_a: 10, side_b: 8 },
    ]);

    expect(matchRes2.isFinished).toBe(false);
    expect(matchRes2.winner).toBeNull();
    expect(matchRes2.setsWonA).toBe(1);
    expect(matchRes2.setsWonB).toBe(1);
  });
});
