import { MatchRules, SetScore, evaluateSetScore } from './rules';

export interface SheetSetEvaluation {
  isFinished: boolean;
  winner: 'sideA' | 'sideB' | null;
  scoreA: number;
  scoreB: number;
  label: string;
}

export interface SheetMatchEvaluation {
  isFinished: boolean;
  winner: 'sideA' | 'sideB' | null;
  setsWonA: number;
  setsWonB: number;
  setsNeededToWin: number;
  activeSets: SheetSetEvaluation[];
  summaryText: string;
}

/**
 * Evaluates a single set entered from a physical scoresheet.
 * Supports standard rules (21 pts, win-by-2, cap 30) AND local/shortened sheet formats
 * (e.g., 15-13, 12-15, 11-9).
 */
export function evaluateSheetSetScore(
  rules: MatchRules,
  setNumber: number,
  scoreA: number,
  scoreB: number
): SheetSetEvaluation {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || (rules.point_cap !== null && Math.max(scoreA, scoreB) > rules.point_cap) || (scoreA === 0 && scoreB === 0)) {
    return {
      isFinished: false,
      winner: null,
      scoreA,
      scoreB,
      label: 'Not played',
    };
  }

  // 1. Try standard evaluation first
  const std = evaluateSetScore(rules, setNumber, scoreA, scoreB);
  if (std.isFinished && std.winner) {
    return {
      isFinished: true,
      winner: std.winner,
      scoreA,
      scoreB,
      label: `${std.winner === 'sideA' ? 'A' : 'B'} won (${scoreA}-${scoreB})`,
    };
  }

  // 2. Flexible sheet score evaluation:
  // If scores are unequal, and at least one side reached 11+ points (or higher than target)
  // or if one side has a lead and is at least 15 points
  const maxScore = Math.max(scoreA, scoreB);
  const diff = Math.abs(scoreA - scoreB);

  if (scoreA !== scoreB && maxScore >= 11 && (diff >= 2 || maxScore >= 15 || maxScore >= rules.points_per_set)) {
    const winner = scoreA > scoreB ? 'sideA' : 'sideB';
    return {
      isFinished: true,
      winner,
      scoreA,
      scoreB,
      label: `${winner === 'sideA' ? 'A' : 'B'} won (${scoreA}-${scoreB})`,
    };
  }

  // If tied or incomplete
  return {
    isFinished: false,
    winner: null,
    scoreA,
    scoreB,
    label: scoreA === scoreB ? `Tied (${scoreA}-${scoreB})` : `In progress (${scoreA}-${scoreB})`,
  };
}

/**
 * Evaluates a match entered from a scoresheet.
 */
export function evaluateSheetMatch(
  rules: MatchRules,
  setScores: SetScore[]
): SheetMatchEvaluation {
  const setsNeededToWin = Math.ceil(rules.sets / 2);
  let setsWonA = 0;
  let setsWonB = 0;
  const activeSets: SheetSetEvaluation[] = [];

  for (const s of setScores) {
    if (s.side_a === 0 && s.side_b === 0) continue;

    const setEval = evaluateSheetSetScore(rules, s.set, s.side_a, s.side_b);
    activeSets.push(setEval);

    if (setEval.isFinished && setEval.winner) {
      if (setEval.winner === 'sideA') setsWonA++;
      if (setEval.winner === 'sideB') setsWonB++;
    }

    if (setsWonA >= setsNeededToWin || setsWonB >= setsNeededToWin) {
      break;
    }
  }

  let winner: 'sideA' | 'sideB' | null = null;
  let isFinished = false;

  if (setsWonA >= setsNeededToWin) {
    winner = 'sideA';
    isFinished = true;
  } else if (setsWonB >= setsNeededToWin) {
    winner = 'sideB';
    isFinished = true;
  } else if (rules.sets === 1 && activeSets.length > 0 && activeSets[0].isFinished) {
    // 1-set match
    winner = activeSets[0].winner;
    isFinished = winner !== null;
  }

  const scoresFormatted = activeSets
    .filter((s) => s.scoreA > 0 || s.scoreB > 0)
    .map((s) => `${s.scoreA}-${s.scoreB}`)
    .join(', ');

  const summaryText = isFinished && winner
    ? `${winner === 'sideA' ? 'A' : 'B'} wins (${setsWonA}-${setsWonB}) [${scoresFormatted}]`
    : `In progress (${setsWonA}-${setsWonB})`;

  return {
    isFinished,
    winner,
    setsWonA,
    setsWonB,
    setsNeededToWin,
    activeSets,
    summaryText,
  };
}

/**
 * Format participant labels for Singles vs Doubles
 */
export function formatMatchupInfo(
  categoryType: 'singles' | 'doubles',
  entryA: { player1?: { name: string } | null; player2?: { name: string } | null } | null,
  entryB: { player1?: { name: string } | null; player2?: { name: string } | null } | null
) {
  const isDoubles = categoryType === 'doubles';

  if (isDoubles) {
    const p1A = entryA?.player1?.name || 'TBD';
    const p2A = entryA?.player2?.name || 'TBD';
    const p1B = entryB?.player1?.name || 'TBD';
    const p2B = entryB?.player2?.name || 'TBD';

    return {
      isDoubles: true,
      title: 'Team A vs Team B',
      sideALabel: 'Team A',
      sideBLabel: 'Team B',
      sideAPlayers: `${p1A} & ${p2A}`,
      sideBPlayers: `${p1B} & ${p2B}`,
      shortA: 'Team A',
      shortB: 'Team B',
    };
  }

  const nameA = entryA?.player1?.name || 'Player A';
  const nameB = entryB?.player1?.name || 'Player B';
  const firstNameA = nameA.split(' ')[0] || 'A';
  const firstNameB = nameB.split(' ')[0] || 'B';

  return {
    isDoubles: false,
    title: `${nameA} vs ${nameB}`,
    sideALabel: nameA,
    sideBLabel: nameB,
    sideAPlayers: nameA,
    sideBPlayers: nameB,
    shortA: firstNameA,
    shortB: firstNameB,
  };
}
