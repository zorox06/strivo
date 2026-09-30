import { describe, it, expect } from 'vitest';
import { evaluateSheetMatch, evaluateSheetSetScore } from '../src/lib/match/scoring';
import { DEFAULT_MATCH_RULES, evaluateMatch, evaluateSetScore } from '../src/lib/match/rules';
import { calculateProfileStats } from '../src/lib/rating/stats';
import { generateKnockoutDraw } from '../src/lib/draws/knockout';
import { buildKnockoutRows } from '../src/lib/draws/persist';
import type { RatingHistory } from '../src/lib/types';

describe('Strivo scoring regressions', () => {
  it('keeps best of three open after one completed set', () => {
    expect(evaluateSheetMatch(DEFAULT_MATCH_RULES, [{ set: 1, side_a: 21, side_b: 15 }]).isFinished).toBe(false);
  });
  it('keeps best of five open after two wins and finishes on the third', () => {
    const rules = { ...DEFAULT_MATCH_RULES, sets: 5 as const };
    const sets = [1, 2, 3].map(set => ({ set, side_a: 21, side_b: 15 }));
    expect(evaluateSheetMatch(rules, sets.slice(0, 2)).isFinished).toBe(false);
    expect(evaluateSheetMatch(rules, sets).winner).toBe('sideA');
  });
  it('keeps the live scoreboard open at 11–0 under 21-point rules', () => {
    expect(evaluateSetScore(DEFAULT_MATCH_RULES, 1, 11, 0).isFinished).toBe(false);
    expect(evaluateMatch(DEFAULT_MATCH_RULES, [{ set: 1, side_a: 11, side_b: 0 }]).isFinished).toBe(false);
  });
  it('rejects points above the cap and fractional scores', () => {
    expect(evaluateSetScore(DEFAULT_MATCH_RULES, 1, 31, 29).isValid).toBe(false);
    expect(evaluateSetScore(DEFAULT_MATCH_RULES, 1, 21.5, 19).isValid).toBe(false);
    expect(evaluateSheetSetScore(DEFAULT_MATCH_RULES, 1, 31, 29).isFinished).toBe(false);
  });
});

describe('Strivo profile statistics', () => {
  const history = [{ delta: 0, match: { winner_id: 'entry-a', entry_a: { id: 'entry-a', player1: { id: 'one' }, player2: { id: 'two' } }, entry_b: { id: 'entry-b', player1: { id: 'three' }, player2: null }, set_scores: [{ set: 1, side_a: 21, side_b: 17 }] } }] as unknown as RatingHistory[];
  it('recognizes a doubles partner on side A and counts their points', () => {
    expect(calculateProfileStats(history, 'two')).toMatchObject({ wins: 1, losses: 0, pointsScored: 21, pointsConceded: 17 });
  });
  it('records a loss despite a rounded Elo delta of zero', () => {
    expect(calculateProfileStats(history, 'three')).toMatchObject({ wins: 0, losses: 1, pointsScored: 17, pointsConceded: 21 });
  });
});

describe('Strivo bracket persistence', () => {
  it('links every earlier round to the correct next-round slot', () => {
    let id = 0;
    const draw = generateKnockoutDraw(Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, rating: 1000 + i })));
    const rows = buildKnockoutRows(draw, 'category', DEFAULT_MATCH_RULES, () => `match-${++id}`);
    for (const row of rows.filter(r => r.round < 3)) expect(row.next_match_id).toBe(rows.find(r => r.round === row.round + 1 && r.slot === Math.ceil(row.slot / 2))?.id);
    expect(rows.find(r => r.round === 3)?.next_match_id).toBeNull();
  });
  it('preserves bye winners and advances them into the following round', () => {
    let id = 0;
    const draw = generateKnockoutDraw(Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, rating: 1000 + i })));
    const rows = buildKnockoutRows(draw, 'category', DEFAULT_MATCH_RULES, () => `match-${++id}`);
    const bye = rows.find(r => r.status === 'bye')!;
    const next = rows.find(r => r.id === bye.next_match_id)!;
    expect([next.entry_a_id, next.entry_b_id]).toContain(bye.winner_id);
  });
});
