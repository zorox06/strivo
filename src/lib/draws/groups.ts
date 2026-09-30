/**
-- Badminton Groups + Knockout Stage Engine
-- Pure TypeScript module with ZERO UI or DB dependencies.
-- Implements snake distribution (A, B, C, C, B, A...), round-robin group match generation,
-- group standings calculation, and top-2 cross-group knockout qualification.
*/

import { KnockoutParticipant } from './knockout';

export interface GroupParticipant extends KnockoutParticipant {
  groupName: string;
}

export interface GroupMatch {
  id: string;
  groupName: string;
  round: number;
  entryA: KnockoutParticipant;
  entryB: KnockoutParticipant;
}

export interface GroupStandingsRow {
  participant: KnockoutParticipant;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  pointsDiff: number;
  rank: number;
}

export interface GroupStageResult {
  groups: Record<string, KnockoutParticipant[]>;
  matches: GroupMatch[];
}

/**
 * Distributes participants into groups using snake distribution by rating.
 * Example for 3 groups (A, B, C):
 * 1 -> A, 2 -> B, 3 -> C
 * 4 -> C, 5 -> B, 6 -> A
 * 7 -> A, 8 -> B, 9 -> C
 */
export function snakeDistribute(
  participants: KnockoutParticipant[],
  numGroups: number
): Record<string, KnockoutParticipant[]> {
  if (numGroups < 1) throw new Error('Number of groups must be at least 1');
  if (participants.length < numGroups) {
    throw new Error('Number of participants cannot be less than number of groups');
  }

  // Sort descending by rating
  const sorted = [...participants].sort((a, b) => b.rating - a.rating);

  const groupNames = Array.from({ length: numGroups }, (_, i) =>
    String.fromCharCode(65 + i)
  ); // ['A', 'B', 'C', ...]

  const groups: Record<string, KnockoutParticipant[]> = {};
  groupNames.forEach((g) => {
    groups[g] = [];
  });

  let groupIdx = 0;
  let direction = 1; // 1 for forward, -1 for reverse

  for (let i = 0; i < sorted.length; i++) {
    const currentGroup = groupNames[groupIdx];
    groups[currentGroup].push(sorted[i]);

    if (numGroups > 1) {
      if (direction === 1 && groupIdx === numGroups - 1) {
        direction = -1; // bounce back at the end
      } else if (direction === -1 && groupIdx === 0) {
        direction = 1; // bounce forward at the start
      } else {
        groupIdx += direction;
      }
    }
  }

  return groups;
}

/**
 * Generates all round-robin matches for each group.
 */
export function generateGroupMatches(
  groups: Record<string, KnockoutParticipant[]>
): GroupMatch[] {
  const matches: GroupMatch[] = [];

  for (const [groupName, members] of Object.entries(groups)) {
    let matchIdx = 1;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        matches.push({
          id: `group-${groupName}-m${matchIdx++}`,
          groupName,
          round: 1,
          entryA: members[i],
          entryB: members[j],
        });
      }
    }
  }

  return matches;
}

/**
 * Calculates group standings and returns ordered ranks.
 */
export function calculateGroupStandings(
  participants: KnockoutParticipant[],
  completedMatches: Array<{
    entryAId: string;
    entryBId: string;
    setsWonA: number;
    setsWonB: number;
    pointsA: number;
    pointsB: number;
    winnerId: string;
  }>
): GroupStandingsRow[] {
  const rows: Record<string, GroupStandingsRow> = {};

  participants.forEach((p) => {
    rows[p.id] = {
      participant: p,
      played: 0,
      won: 0,
      lost: 0,
      setsWon: 0,
      setsLost: 0,
      pointsWon: 0,
      pointsLost: 0,
      pointsDiff: 0,
      rank: 1,
    };
  });

  for (const m of completedMatches) {
    const a = rows[m.entryAId];
    const b = rows[m.entryBId];
    if (a && b) {
      a.played++;
      b.played++;
      a.setsWon += m.setsWonA;
      a.setsLost += m.setsWonB;
      b.setsWon += m.setsWonB;
      b.setsLost += m.setsWonA;
      a.pointsWon += m.pointsA;
      a.pointsLost += m.pointsB;
      b.pointsWon += m.pointsB;
      b.pointsLost += m.pointsA;

      if (m.winnerId === a.participant.id) {
        a.won++;
        b.lost++;
      } else if (m.winnerId === b.participant.id) {
        b.won++;
        a.lost++;
      }
    }
  }

  // Calculate pointsDiff and sort
  const standings = Object.values(rows).map((r) => ({
    ...r,
    pointsDiff: r.pointsWon - r.pointsLost,
  }));

  standings.sort((a, b) => {
    if (b.won !== a.won) return b.won - a.won;
    const setDiffA = a.setsWon - a.setsLost;
    const setDiffB = b.setsWon - b.setsLost;
    if (setDiffB !== setDiffA) return setDiffB - setDiffA;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    return b.participant.rating - a.participant.rating;
  });

  standings.forEach((s, idx) => {
    s.rank = idx + 1;
  });

  return standings;
}

/**
 * Qualifies top 2 from each group and pairs them across groups for the knockout stage.
 * E.g., Group A #1 vs Group B #2, Group B #1 vs Group A #2.
 */
export function qualifyGroupTop2(
  groupStandings: Record<string, GroupStandingsRow[]>
): KnockoutParticipant[] {
  const qualifiers: KnockoutParticipant[] = [];
  const groupNames = Object.keys(groupStandings).sort();

  for (const name of groupNames) {
    const standings = groupStandings[name];
    if (standings.length >= 1) qualifiers.push(standings[0].participant);
    if (standings.length >= 2) qualifiers.push(standings[1].participant);
  }

  return qualifiers;
}
