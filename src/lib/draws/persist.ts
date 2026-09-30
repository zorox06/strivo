import type { KnockoutDrawResult } from './knockout';
import type { MatchRules } from '../match/rules';

export function buildKnockoutRows(draw: KnockoutDrawResult, categoryId: string, rules: MatchRules, makeId: () => string) {
  const ids = new Map<string, string>();
  for (const round of draw.rounds) for (const match of round.matches) ids.set(`${round.round}:${match.slot}`, makeId());
  return draw.rounds.flatMap(round => round.matches.map(match => ({
    id: ids.get(`${round.round}:${match.slot}`)!,
    category_id: categoryId,
    round: round.round,
    round_name: round.roundName,
    slot: match.slot,
    entry_a_id: match.entryA?.id ?? null,
    entry_b_id: match.entryB?.id ?? null,
    next_match_id: ids.get(`${round.round + 1}:${Math.ceil(match.slot / 2)}`) ?? null,
    rules_snapshot: rules,
    status: match.isBye ? 'bye' : 'pending',
    winner_id: match.winner?.id ?? null,
    set_scores: [],
  })));
}
