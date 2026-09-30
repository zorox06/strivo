import type { RatingHistory } from '../types';

export function playerWonMatch(record: RatingHistory, playerId: string): boolean {
  const match = record.match;
  if (!match?.winner_id) return record.delta > 0;
  const sideA = match.entry_a;
  const isSideA = sideA?.player1?.id === playerId || sideA?.player2?.id === playerId;
  return match.winner_id === (isSideA ? sideA?.id : match.entry_b?.id);
}

export function calculateProfileStats(history: RatingHistory[], playerId: string) {
  let wins = 0, losses = 0, streak = 0, bestStreak = 0, pointsScored = 0, pointsConceded = 0;
  for (const record of history) {
    if (playerWonMatch(record, playerId)) { wins++; streak = streak >= 0 ? streak + 1 : 1; }
    else { losses++; streak = streak <= 0 ? streak - 1 : -1; }
    bestStreak = Math.max(bestStreak, streak);
    const sideA = record.match?.entry_a;
    const isSideA = sideA?.player1?.id === playerId || sideA?.player2?.id === playerId;
    for (const set of record.match?.set_scores ?? []) {
      pointsScored += isSideA ? set.side_a : set.side_b;
      pointsConceded += isSideA ? set.side_b : set.side_a;
    }
  }
  return { wins, losses, winRate: wins + losses ? Math.round(wins / (wins + losses) * 100) : 0, currentStreak: streak, bestStreak, pointsScored, pointsConceded };
}
