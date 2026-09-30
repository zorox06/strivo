/**
-- Badminton Match Rules & Score Validation Engine
-- Pure TypeScript module with ZERO UI or DB dependencies.
-- Handles validation of badminton sets, point caps, deuce/win-by-2 rules,
-- deciding set points override, and match auto-completion.
*/

export interface MatchRules {
  sets: 1 | 3 | 5;
  points_per_set: number;
  win_by_2: boolean;
  point_cap: number | null;
  deciding_set_points: number | null;
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  sets: 3,
  points_per_set: 21,
  win_by_2: true,
  point_cap: 30,
  deciding_set_points: null,
};

export interface SetScore {
  set: number;
  side_a: number;
  side_b: number;
}

export interface SetEvaluation {
  isFinished: boolean;
  winner: 'sideA' | 'sideB' | null;
  isValid: boolean;
  targetPoints: number;
  message?: string;
}

export interface MatchEvaluation {
  isFinished: boolean;
  winner: 'sideA' | 'sideB' | null;
  setsWonA: number;
  setsWonB: number;
  setsNeededToWin: number;
  maxSets: number;
  currentSetIndex: number;
  setEvaluations: SetEvaluation[];
  isValid: boolean;
}

/**
 * Returns the target winning points for a given set index (1-based).
 * Accounts for deciding_set_points in set 3 (best of 3) or set 5 (best of 5).
 */
export function getTargetPointsForSet(rules: MatchRules, setNumber: number): number {
  const isDecidingSet =
    (rules.sets === 3 && setNumber === 3) || (rules.sets === 5 && setNumber === 5);

  if (isDecidingSet && rules.deciding_set_points !== null && rules.deciding_set_points > 0) {
    return rules.deciding_set_points;
  }
  return rules.points_per_set;
}

/**
 * Evaluates whether a single set is complete, valid, and who won.
 */
export function evaluateSetScore(
  rules: MatchRules,
  setNumber: number,
  scoreA: number,
  scoreB: number
): SetEvaluation {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return { isFinished: false, winner: null, isValid: false, targetPoints: 0, message: 'Scores cannot be negative' };
  }

  const target = getTargetPointsForSet(rules, setNumber);
  const cap = rules.point_cap;

  if (cap !== null && (scoreA > cap || scoreB > cap)) {
    return { isFinished: false, winner: null, isValid: false, targetPoints: target, message: 'Score exceeded cap' };
  }

  // If win_by_2 is not enabled
  if (!rules.win_by_2) {
    if (scoreA >= target && scoreA > scoreB) {
      return { isFinished: true, winner: 'sideA', isValid: true, targetPoints: target };
    }
    if (scoreB >= target && scoreB > scoreA) {
      return { isFinished: true, winner: 'sideB', isValid: true, targetPoints: target };
    }
    return { isFinished: false, winner: null, isValid: true, targetPoints: target };
  }

  // Cap reached
  if (cap !== null && cap > 0) {
    if (scoreA >= cap) {
      if (scoreA > scoreB) {
        return { isFinished: true, winner: 'sideA', isValid: true, targetPoints: target };
      }
      return { isFinished: false, winner: null, isValid: false, targetPoints: target, message: 'Score exceeded cap' };
    }
    if (scoreB >= cap) {
      if (scoreB > scoreA) {
        return { isFinished: true, winner: 'sideB', isValid: true, targetPoints: target };
      }
      return { isFinished: false, winner: null, isValid: false, targetPoints: target, message: 'Score exceeded cap' };
    }
  }

  // Win by 2 reached at or above target
  if (scoreA >= target && scoreA - scoreB >= 2) {
    return { isFinished: true, winner: 'sideA', isValid: true, targetPoints: target };
  }
  if (scoreB >= target && scoreB - scoreA >= 2) {
    return { isFinished: true, winner: 'sideB', isValid: true, targetPoints: target };
  }

  return { isFinished: false, winner: null, isValid: true, targetPoints: target };
}

/**
 * Evaluates the entire match score against rules.
 * Calculates sets won, determines if match is completed, and indicates
 * which set is currently active.
 */
export function evaluateMatch(
  rules: MatchRules,
  setScores: SetScore[]
): MatchEvaluation {
  const setsNeededToWin = Math.ceil(rules.sets / 2);
  let setsWonA = 0;
  let setsWonB = 0;
  let overallWinner: 'sideA' | 'sideB' | null = null;
  const setEvaluations: SetEvaluation[] = [];

  for (let i = 0; i < setScores.length; i++) {
    const s = setScores[i];
    const evalSet = evaluateSetScore(rules, s.set, s.side_a, s.side_b);
    setEvaluations.push(evalSet);

    if (!evalSet.isValid) {
      return {
        isFinished: false,
        winner: null,
        setsWonA,
        setsWonB,
        setsNeededToWin,
        maxSets: rules.sets,
        currentSetIndex: i + 1,
        setEvaluations,
        isValid: false,
      };
    }

    if (evalSet.isFinished) {
      if (evalSet.winner === 'sideA') setsWonA++;
      if (evalSet.winner === 'sideB') setsWonB++;
    }

    if (setsWonA >= setsNeededToWin) {
      overallWinner = 'sideA';
      break;
    }
    if (setsWonB >= setsNeededToWin) {
      overallWinner = 'sideB';
      break;
    }
  }

  const isFinished = overallWinner !== null;

  return {
    isFinished,
    winner: overallWinner,
    setsWonA,
    setsWonB,
    setsNeededToWin,
    maxSets: rules.sets,
    currentSetIndex: setEvaluations.length,
    setEvaluations,
    isValid: true,
  };
}
