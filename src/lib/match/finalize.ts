import { SupabaseClient } from '@supabase/supabase-js';
import { MatchRules, SetScore } from './rules';
import { calculateMatchRating, EloTeam } from '../rating/elo';
import { evaluateSheetMatch } from './scoring';

export interface FinalizeMatchInput {
  supabase: SupabaseClient;
  matchId: string;
  category: {
    id: string;
    type: 'singles' | 'doubles';
    tournament?: { id: string };
  };
  entryA: {
    id: string;
    player1: {
      id: string;
      name: string;
      username: string;
      rating: number;
      matches_played: number;
      peak_rating?: number;
    };
    player2?: {
      id: string;
      name: string;
      username: string;
      rating: number;
      matches_played: number;
      peak_rating?: number;
    } | null;
  };
  entryB: {
    id: string;
    player1: {
      id: string;
      name: string;
      username: string;
      rating: number;
      matches_played: number;
      peak_rating?: number;
    };
    player2?: {
      id: string;
      name: string;
      username: string;
      rating: number;
      matches_played: number;
      peak_rating?: number;
    } | null;
  };
  rules: MatchRules;
  setScores: SetScore[];
  winnerSide: 'sideA' | 'sideB';
  court?: string | null;
  actorId: string;
  nextMatchId?: string | null;
  matchSlot?: number;
}

export async function finalizeMatchResult(input: FinalizeMatchInput) {
  const {
    supabase,
    matchId,
    category,
    entryA,
    entryB,
    rules,
    setScores,
    winnerSide,
    court,
    actorId,
    nextMatchId,
    matchSlot,
  } = input;

  const winnerEntryId = winnerSide === 'sideA' ? entryA.id : entryB.id;
  const isDoubles = category.type === 'doubles';

  const evaluation = evaluateSheetMatch(rules, setScores);
  if (!evaluation.isFinished || evaluation.winner !== winnerSide) throw new Error('Finish the required sets before confirming the result.');
  if (isDoubles && (!entryA.player2 || !entryB.player2)) throw new Error('Both doubles teams need two players before scoring.');
  const { data: existing, error: readError } = await supabase.from('matches').select('status').eq('id', matchId).single();
  if (readError) throw readError;
  if (existing.status === 'completed') throw new Error('This result has already been confirmed.');

  async function requireSuccess(result: PromiseLike<{ error: unknown }>) {
    const { error } = await result;
    if (error) throw error;
  }

  // 1. Update Match row in DB
  const { error: matchUpdateErr } = await supabase
    .from('matches')
    .update({
      set_scores: setScores,
      status: 'completed',
      winner_id: winnerEntryId,
      court: court?.trim() || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', matchId);

  if (matchUpdateErr) throw matchUpdateErr;

  // 2. Compute Elo Rating updates
  if (entryA?.player1 && entryB?.player1) {
    const sideAElo: EloTeam = {
      players: [
        {
          id: entryA.player1.id,
          rating: entryA.player1.rating || 1000,
          matchesPlayed: entryA.player1.matches_played || 0,
          peakRating: entryA.player1.peak_rating || entryA.player1.rating || 1000,
        },
        ...(entryA.player2
          ? [
              {
                id: entryA.player2.id,
                rating: entryA.player2.rating || 1000,
                matchesPlayed: entryA.player2.matches_played || 0,
                peakRating: entryA.player2.peak_rating || entryA.player2.rating || 1000,
              },
            ]
          : []),
      ],
    };

    const sideBElo: EloTeam = {
      players: [
        {
          id: entryB.player1.id,
          rating: entryB.player1.rating || 1000,
          matchesPlayed: entryB.player1.matches_played || 0,
          peakRating: entryB.player1.peak_rating || entryB.player1.rating || 1000,
        },
        ...(entryB.player2
          ? [
              {
                id: entryB.player2.id,
                rating: entryB.player2.rating || 1000,
                matchesPlayed: entryB.player2.matches_played || 0,
                peakRating: entryB.player2.peak_rating || entryB.player2.rating || 1000,
              },
            ]
          : []),
      ],
    };

    const ratingResult = calculateMatchRating({
      sideA: sideAElo,
      sideB: sideBElo,
      winner: winnerSide,
      isSingleSet: rules.sets === 1,
    });

    const allResults = [...ratingResult.sideA, ...ratingResult.sideB];
    for (const res of allResults) {
      // Clear old rating history entry for this match if re-scored
      await requireSuccess(supabase
        .from('rating_history')
        .delete()
        .match({ match_id: matchId, player_id: res.playerId }));

      // Insert fresh rating delta record
      await requireSuccess(supabase.from('rating_history').insert({
        player_id: res.playerId,
        match_id: matchId,
        rating_before: res.ratingBefore,
        rating_after: res.ratingAfter,
        delta: res.delta,
      }));

      // Update Player Profile with new rating, peak, and incremented matches_played
      const existingMatches =
        entryA.player1.id === res.playerId
          ? entryA.player1.matches_played
          : entryA.player2?.id === res.playerId
          ? entryA.player2.matches_played
          : entryB.player1.id === res.playerId
          ? entryB.player1.matches_played
          : entryB.player2?.matches_played || 0;

      await requireSuccess(supabase
        .from('profiles')
        .update({
          rating: res.ratingAfter,
          peak_rating: res.peakRating,
          matches_played: existingMatches + 1,
        })
        .eq('id', res.playerId));
    }
  }

  // 3. Advance winner to next round match in bracket (if knockout)
  if (nextMatchId && matchSlot !== undefined) {
    const isSlotOdd = matchSlot % 2 !== 0;
    await requireSuccess(supabase
      .from('matches')
      .update({
        [isSlotOdd ? 'entry_a_id' : 'entry_b_id']: winnerEntryId,
      })
      .eq('id', nextMatchId));
  }

  // 4. Record Audit Log
  const nameA = isDoubles
    ? `${entryA.player1.name} & ${entryA.player2?.name || 'TBD'}`
    : entryA.player1.name;
  const nameB = isDoubles
    ? `${entryB.player1.name} & ${entryB.player2?.name || 'TBD'}`
    : entryB.player1.name;

  if (category.tournament?.id) {
    await requireSuccess(supabase.from('audit_log').insert({
      tournament_id: category.tournament.id,
      action: 'score_confirmed',
      actor_id: actorId,
      details: {
        matchId,
        scores: setScores,
        winner: winnerSide === 'sideA' ? nameA : nameB,
      },
    }));
  }

  return {
    winnerName: winnerSide === 'sideA' ? nameA : nameB,
    winnerEntryId,
  };
}
