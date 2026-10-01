import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface PostBody {
  categoryId: string;
  player1Id: string;
  player2Id?: string | null;
  isSolo?: boolean;
}

interface DeleteBody {
  entryId: string;
}

interface PatchBody {
  entryId: string;
  player2Id: string;
}

async function getAuthAndPermissions(request: Request, tournamentId: string) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return { error: 'Unauthorized: missing authorization token', status: 401 };
  }

  const adminClient = createAdminClient();
  const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);

  if (userErr || !user) {
    return { error: 'Unauthorized: invalid session or token', status: 401 };
  }

  // 1. Fetch tournament
  const { data: tournament } = await adminClient
    .from('tournaments')
    .select('id, name, status, created_by')
    .eq('id', tournamentId)
    .single();

  if (!tournament) {
    return { error: 'Tournament not found', status: 404 };
  }

  // 2. Fetch profile to check is_admin
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, is_admin, rating, gender, name, username')
    .eq('id', user.id)
    .single();

  // 3. Check tournament manager role
  const { data: manager } = await adminClient
    .from('tournament_managers')
    .select('id, level')
    .eq('tournament_id', tournamentId)
    .eq('player_id', user.id)
    .maybeSingle();

  const isManager = !!profile?.is_admin || tournament.created_by === user.id || !!manager;

  return { adminClient, user, profile, tournament, isManager };
}

// POST: Add Player / Team or Self-Register
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const authResult = await getAuthAndPermissions(request, tournamentId);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { adminClient, user, tournament, isManager } = authResult;
    const body = (await request.json()) as PostBody;
    const { categoryId, player1Id, player2Id, isSolo } = body;

    if (!categoryId || !player1Id) {
      return NextResponse.json({ error: 'categoryId and player1Id are required' }, { status: 400 });
    }

    // If not a manager/owner, user can ONLY self-register
    if (!isManager) {
      if (player1Id !== user.id) {
        return NextResponse.json(
          { error: 'Players can only register themselves.' },
          { status: 403 }
        );
      }
      if (tournament.status !== 'draft') {
        return NextResponse.json(
          { error: 'Registrations are closed for this tournament.' },
          { status: 400 }
        );
      }
    }

    // Verify category belongs to this tournament
    const { data: category } = await adminClient
      .from('categories')
      .select('id, name, type, gender, tournament_id')
      .eq('id', categoryId)
      .eq('tournament_id', tournamentId)
      .single();

    if (!category) {
      return NextResponse.json({ error: 'Category not found in this tournament' }, { status: 404 });
    }

    // Fetch Player 1
    const { data: p1 } = await adminClient
      .from('profiles')
      .select('id, username, name, gender, rating')
      .eq('id', player1Id)
      .single();

    if (!p1) {
      return NextResponse.json({ error: 'Player 1 not found' }, { status: 404 });
    }

    // Gender check for Player 1
    if (category.gender !== 'mixed' && p1.gender !== category.gender) {
      return NextResponse.json(
        { error: `Player 1 (${p1.name}) is registered as ${p1.gender}, but this category requires ${category.gender}.` },
        { status: 400 }
      );
    }

    // Check if player1 already in category
    const { data: existingP1 } = await adminClient
      .from('entries')
      .select('id')
      .eq('category_id', categoryId)
      .or(`player1_id.eq.${p1.id},player2_id.eq.${p1.id}`)
      .maybeSingle();

    if (existingP1) {
      return NextResponse.json(
        { error: `@${p1.username} is already registered in this category.` },
        { status: 400 }
      );
    }

    // Handle Player 2 if doubles
    let p2 = null;
    const isDoubles = category.type === 'doubles';
    const hasPlayer2 = isDoubles && !isSolo && !!player2Id;

    if (hasPlayer2 && player2Id) {
      if (player2Id === player1Id) {
        return NextResponse.json({ error: 'Player 1 and Player 2 cannot be the same player.' }, { status: 400 });
      }

      const { data: fetchedP2 } = await adminClient
        .from('profiles')
        .select('id, username, name, gender, rating')
        .eq('id', player2Id)
        .single();

      if (!fetchedP2) {
        return NextResponse.json({ error: 'Player 2 not found' }, { status: 404 });
      }
      p2 = fetchedP2;

      // Gender check for Player 2
      if (category.gender !== 'mixed' && p2.gender !== category.gender) {
        return NextResponse.json(
          { error: `Player 2 (${p2.name}) is registered as ${p2.gender}, but this category requires ${category.gender}.` },
          { status: 400 }
        );
      }

      if (category.gender === 'mixed' && p1.gender === p2.gender) {
        return NextResponse.json(
          { error: 'Mixed doubles requires one boy and one girl.' },
          { status: 400 }
        );
      }

      // Check if player2 already in category
      const { data: existingP2 } = await adminClient
        .from('entries')
        .select('id')
        .eq('category_id', categoryId)
        .or(`player1_id.eq.${p2.id},player2_id.eq.${p2.id}`)
        .maybeSingle();

      if (existingP2) {
        return NextResponse.json(
          { error: `@${p2.username} is already registered in this category.` },
          { status: 400 }
        );
      }
    }

    // Calculate seed and pair rating
    const { count } = await adminClient
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    const nextSeed = (count ?? 0) + 1;
    const pairRating = p2
      ? Math.round((p1.rating + p2.rating) / 2)
      : p1.rating;

    // Insert entry
    const { data: newEntry, error: insErr } = await adminClient
      .from('entries')
      .insert({
        category_id: categoryId,
        player1_id: p1.id,
        player2_id: p2 ? p2.id : null,
        seed: nextSeed,
        pair_rating: pairRating,
        is_solo: !p2,
      })
      .select(`
        id, category_id, seed, pair_rating, is_solo,
        player1:profiles!entries_player1_id_fkey(id, username, name, avatar_id, rating, gender, level),
        player2:profiles!entries_player2_id_fkey(id, username, name, avatar_id, rating, gender, level)
      `)
      .single();

    if (insErr) {
      console.error('API Insert Entry Error:', insErr);
      return NextResponse.json({ error: insErr.message || 'Failed to add entry' }, { status: 500 });
    }

    // Log audit
    await adminClient.from('audit_log').insert({
      tournament_id: tournamentId,
      action: isManager ? 'entry_added_by_manager' : 'player_self_registered',
      actor_id: user.id,
      details: {
        categoryName: category.name,
        player1Username: p1.username,
        player2Username: p2?.username || null,
        isSolo: !p2,
      },
    });

    return NextResponse.json({ success: true, entry: newEntry }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove Player/Team (Manager/Owner) or Withdraw (Self)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const authResult = await getAuthAndPermissions(request, tournamentId);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { adminClient, user, tournament, isManager } = authResult;

    // Can read entryId from query params or body
    const url = new URL(request.url);
    let entryId = url.searchParams.get('entryId');
    if (!entryId) {
      try {
        const body = (await request.json()) as DeleteBody;
        entryId = body.entryId;
      } catch {
        // no body
      }
    }

    if (!entryId) {
      return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
    }

    // Fetch entry with category to verify tournament association
    const { data: entry } = await adminClient
      .from('entries')
      .select('id, category_id, player1_id, player2_id, category:categories(tournament_id)')
      .eq('id', entryId)
      .single();

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const catTournamentId = (entry.category as unknown as { tournament_id: string })?.tournament_id;
    if (catTournamentId !== tournamentId) {
      return NextResponse.json({ error: 'Entry does not belong to this tournament' }, { status: 400 });
    }

    // If not a manager, only player1 or player2 can withdraw themselves
    if (!isManager) {
      const isPlayerInEntry = entry.player1_id === user.id || entry.player2_id === user.id;
      if (!isPlayerInEntry) {
        return NextResponse.json(
          { error: 'You can only withdraw your own entry.' },
          { status: 403 }
        );
      }
      if (tournament.status !== 'draft') {
        return NextResponse.json(
          { error: 'Cannot withdraw after tournament draw has commenced.' },
          { status: 400 }
        );
      }
    }

    // Delete the entry
    const { error: delErr } = await adminClient
      .from('entries')
      .delete()
      .eq('id', entryId);

    if (delErr) {
      console.error('API Delete Entry Error:', delErr);
      return NextResponse.json({ error: delErr.message || 'Failed to delete entry' }, { status: 500 });
    }

    // Audit log
    await adminClient.from('audit_log').insert({
      tournament_id: tournamentId,
      action: isManager ? 'entry_removed_by_manager' : 'player_withdrew',
      actor_id: user.id,
      details: {
        entryId,
        deletedBy: user.id,
        isManager,
      },
    });

    return NextResponse.json({ success: true, message: 'Entry removed successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Assign Partner to Solo Entry
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const authResult = await getAuthAndPermissions(request, tournamentId);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { adminClient, user, isManager } = authResult;
    const body = (await request.json()) as PatchBody;
    const { entryId, player2Id } = body;

    if (!entryId || !player2Id) {
      return NextResponse.json({ error: 'entryId and player2Id are required' }, { status: 400 });
    }

    // Fetch entry
    const { data: entry } = await adminClient
      .from('entries')
      .select('id, category_id, player1_id, player2_id, category:categories(tournament_id, type, gender)')
      .eq('id', entryId)
      .single();

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Permission check: must be manager OR the player1 of this solo entry
    if (!isManager && entry.player1_id !== user.id) {
      return NextResponse.json({ error: 'Permission denied to modify this entry' }, { status: 403 });
    }

    if (entry.player1_id === player2Id) {
      return NextResponse.json({ error: 'Partner cannot be the same as Player 1' }, { status: 400 });
    }

    // Fetch Player 1 and Player 2 profiles
    const [{ data: p1 }, { data: p2 }] = await Promise.all([
      adminClient.from('profiles').select('id, rating, gender, username').eq('id', entry.player1_id).single(),
      adminClient.from('profiles').select('id, rating, gender, username, name').eq('id', player2Id).single(),
    ]);

    if (!p1 || !p2) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    const category = entry.category as unknown as { tournament_id: string; type: string; gender: string };

    // Gender check
    if (category.gender !== 'mixed' && p2.gender !== category.gender) {
      return NextResponse.json(
        { error: `Partner (${p2.name}) is registered as ${p2.gender}, but this category requires ${category.gender}.` },
        { status: 400 }
      );
    }

    if (category.gender === 'mixed' && p1.gender === p2.gender) {
      return NextResponse.json(
        { error: 'Mixed doubles requires one boy and one girl.' },
        { status: 400 }
      );
    }

    // Check if player2 already in category
    const { data: existingP2 } = await adminClient
      .from('entries')
      .select('id')
      .eq('category_id', entry.category_id)
      .or(`player1_id.eq.${p2.id},player2_id.eq.${p2.id}`)
      .maybeSingle();

    if (existingP2) {
      return NextResponse.json(
        { error: `@${p2.username} is already registered in this category.` },
        { status: 400 }
      );
    }

    const combinedRating = Math.round((p1.rating + p2.rating) / 2);

    const { data: updatedEntry, error: updErr } = await adminClient
      .from('entries')
      .update({
        player2_id: p2.id,
        is_solo: false,
        pair_rating: combinedRating,
      })
      .eq('id', entryId)
      .select(`
        id, category_id, seed, pair_rating, is_solo,
        player1:profiles!entries_player1_id_fkey(id, username, name, avatar_id, rating, gender, level),
        player2:profiles!entries_player2_id_fkey(id, username, name, avatar_id, rating, gender, level)
      `)
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Failed to update entry' }, { status: 500 });
    }

    await adminClient.from('audit_log').insert({
      tournament_id: tournamentId,
      action: 'partner_assigned',
      actor_id: user.id,
      details: {
        entryId,
        player1Username: p1.username,
        player2Username: p2.username,
      },
    });

    return NextResponse.json({ success: true, entry: updatedEntry });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
