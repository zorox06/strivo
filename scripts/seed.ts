import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { generateKnockoutDraw } from '../src/lib/draws/knockout';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Parse optional --email=... command line argument or use OWNER_EMAIL env
const args = process.argv.slice(2);
let ownerEmail = process.env.OWNER_EMAIL || 'akshayx06@badminton.app';
const ownerPassword = process.env.OWNER_PASSWORD || undefined;

for (const arg of args) {
  if (arg.startsWith('--email=')) {
    ownerEmail = arg.replace('--email=', '').trim();
  }
}

interface SeedPlayerDef {
  username: string;
  name: string;
  gender: 'boys' | 'girls';
  level: 'beginner' | 'intermediate' | 'advanced';
  rating: number;
  avatar_id: string;
  bio: string;
  phone: string;
  show_phone: boolean;
}

const SAMPLE_PLAYERS: SeedPlayerDef[] = [
  // 12 Boys
  { username: 'arjun_v', name: 'Arjun Verma', gender: 'boys', level: 'advanced', rating: 1250, avatar_id: 'cat-01', bio: 'Aggressive singles smasher.', phone: '+15551010001', show_phone: true },
  { username: 'vikram_s', name: 'Vikram Singh', gender: 'boys', level: 'advanced', rating: 1220, avatar_id: 'cat-02', bio: 'Former college team captain.', phone: '+15551010002', show_phone: false },
  { username: 'rohit_m', name: 'Rohit Mehta', gender: 'boys', level: 'advanced', rating: 1190, avatar_id: 'cat-03', bio: 'Net play specialist.', phone: '+15551010003', show_phone: false },
  { username: 'rahul_k', name: 'Rahul Kumar', gender: 'boys', level: 'advanced', rating: 1170, avatar_id: 'cat-04', bio: 'Consistent baseline rallies.', phone: '+15551010004', show_phone: true },
  { username: 'dev_p', name: 'Dev Patel', gender: 'boys', level: 'intermediate', rating: 1060, avatar_id: 'cat-05', bio: 'Playing weekly club matches.', phone: '+15551010005', show_phone: false },
  { username: 'zayd_a', name: 'Zayd Ali', gender: 'boys', level: 'intermediate', rating: 1030, avatar_id: 'cat-06', bio: 'Focusing on doubles rotation.', phone: '+15551010006', show_phone: true },
  { username: 'leo_c', name: 'Leo Chen', gender: 'boys', level: 'intermediate', rating: 1010, avatar_id: 'cat-07', bio: 'Yonex Astrox fan.', phone: '+15551010007', show_phone: false },
  { username: 'marcus_t', name: 'Marcus Taylor', gender: 'boys', level: 'intermediate', rating: 980, avatar_id: 'cat-08', bio: 'Fast footwork enthusiast.', phone: '+15551010008', show_phone: false },
  { username: 'kenji_s', name: 'Kenji Sato', gender: 'boys', level: 'beginner', rating: 850, avatar_id: 'cat-09', bio: 'Learning deception shots.', phone: '+15551010009', show_phone: true },
  { username: 'alex_b', name: 'Alex Brown', gender: 'boys', level: 'beginner', rating: 820, avatar_id: 'cat-10', bio: 'Badminton newcomer!', phone: '+15551010010', show_phone: false },
  { username: 'lucas_m', name: 'Lucas Miller', gender: 'boys', level: 'beginner', rating: 790, avatar_id: 'cat-11', bio: 'Training backhand clears.', phone: '+15551010011', show_phone: false },
  { username: 'sam_r', name: 'Sam Reed', gender: 'boys', level: 'beginner', rating: 760, avatar_id: 'cat-12', bio: 'Here for fun and fitness.', phone: '+15551010012', show_phone: true },

  // 12 Girls
  { username: 'ananya_s', name: 'Ananya Sharma', gender: 'girls', level: 'advanced', rating: 1240, avatar_id: 'cat-01', bio: 'Top ranked junior singles player.', phone: '+15552020001', show_phone: true },
  { username: 'priya_r', name: 'Priya Rao', gender: 'girls', level: 'advanced', rating: 1210, avatar_id: 'cat-02', bio: 'Precision drop shot lover.', phone: '+15552020002', show_phone: false },
  { username: 'mia_w', name: 'Mia Wang', gender: 'girls', level: 'advanced', rating: 1180, avatar_id: 'cat-03', bio: 'Fast attacking style.', phone: '+15552020003', show_phone: true },
  { username: 'chloe_d', name: 'Chloe Dubois', gender: 'girls', level: 'advanced', rating: 1160, avatar_id: 'cat-04', bio: 'Deceptive slice champion.', phone: '+15552020004', show_phone: false },
  { username: 'sara_m', name: 'Sara Morales', gender: 'girls', level: 'intermediate', rating: 1070, avatar_id: 'cat-05', bio: 'High stamina singles grinder.', phone: '+15552020005', show_phone: false },
  { username: 'aoi_t', name: 'Aoi Takahashi', gender: 'girls', level: 'intermediate', rating: 1040, avatar_id: 'cat-06', bio: 'Quick interceptor at the front court.', phone: '+15552020006', show_phone: true },
  { username: 'emma_j', name: 'Emma Johnson', gender: 'girls', level: 'intermediate', rating: 1000, avatar_id: 'cat-07', bio: 'Victor Brave Sword racket.', phone: '+15552020007', show_phone: false },
  { username: 'elena_k', name: 'Elena Kostas', gender: 'girls', level: 'intermediate', rating: 970, avatar_id: 'cat-08', bio: 'Tournament enthusiast.', phone: '+15552020008', show_phone: false },
  { username: 'nina_l', name: 'Nina Lin', gender: 'girls', level: 'beginner', rating: 860, avatar_id: 'cat-09', bio: 'Working on consistency.', phone: '+15552020009', show_phone: true },
  { username: 'zara_k', name: 'Zara Khan', gender: 'girls', level: 'beginner', rating: 830, avatar_id: 'cat-10', bio: 'Learning overhead clears.', phone: '+15552020010', show_phone: false },
  { username: 'sophia_h', name: 'Sophia Hansen', gender: 'girls', level: 'beginner', rating: 800, avatar_id: 'cat-11', bio: 'Weekend player.', phone: '+15552020011', show_phone: false },
  { username: 'maya_c', name: 'Maya Chen', gender: 'girls', level: 'beginner', rating: 770, avatar_id: 'cat-12', bio: 'Excited for first tournament!', phone: '+15552020012', show_phone: true },
];

async function ensureAuthUser(email: string, password?: string): Promise<string> {
  // Check if user already exists
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const existing = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    if (password) {
      await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    }
    return existing.id;
  }

  // Create new user with confirmed email and optional password
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: password || undefined,
    email_confirm: true,
    user_metadata: { is_seeded: true },
  });

  if (createError || !created.user) {
    throw new Error(`Failed to create auth user for ${email}: ${createError?.message}`);
  }

  return created.user.id;
}

async function main() {
  console.log('🏸 Starting Badminton Tournament Database Seeding...');
  console.log(`👤 Owner Email: ${ownerEmail}`);

  // 1. Seed Owner Account
  console.log('\n--- 1. Creating/Verifying Owner Account ---');
  const ownerId = await ensureAuthUser(ownerEmail, ownerPassword);
  console.log(`✔ Owner Auth ID: ${ownerId}`);

  const ownerProfile = {
    id: ownerId,
    email: ownerEmail,
    username: 'akshayx06',
    name: 'Akshay',
    gender: 'boys',
    avatar_id: 'cat-01',
    bio: 'Badminton Tournament Director & App Administrator.',
    level: 'advanced',
    rating: 1200,
    peak_rating: 1200,
    matches_played: 15,
    is_admin: true,
  };

  const { error: ownerError } = await supabase.from('profiles').upsert(ownerProfile);
  if (ownerError) {
    console.error('Failed to upsert owner profile:', ownerError.message);
  } else {
    console.log(`✔ Owner Profile upserted with is_admin = true`);
    await supabase.from('player_contacts').upsert({
      player_id: ownerId,
      phone: '+15550000000',
      show_phone: true,
    });
  }

  // 2. Seed 24 Sample Players
  console.log('\n--- 2. Creating 24 Sample Players (12 Boys, 12 Girls) ---');
  const playerIds: Record<string, string> = {};

  for (const p of SAMPLE_PLAYERS) {
    const email = `${p.username}@sample.badminton.app`;
    try {
      const authId = await ensureAuthUser(email);
      playerIds[p.username] = authId;

      const profileData = {
        id: authId,
        email,
        username: p.username,
        name: p.name,
        gender: p.gender,
        avatar_id: p.avatar_id,
        bio: p.bio,
        level: p.level,
        rating: p.rating,
        peak_rating: p.rating + Math.floor(Math.random() * 40),
        matches_played: Math.floor(Math.random() * 15) + 3,
        is_admin: false,
      };

      await supabase.from('profiles').upsert(profileData);
      await supabase.from('player_contacts').upsert({
        player_id: authId,
        phone: p.phone,
        show_phone: p.show_phone,
      });

      process.stdout.write(`✔ Seeded: ${p.name.padEnd(18)} (${p.gender}, ${p.rating} Elo)\n`);
    } catch (err: unknown) {
      console.error(`Error seeding ${p.username}:`, err instanceof Error ? err.message : String(err));
    }
  }

  // 3. Seed Sample Tournament
  console.log('\n--- 3. Creating Sample Tournament & Knockout Draw ---');
  const tournamentData = {
    name: 'Metropolitan Spring Open 2026',
    date: new Date().toISOString().split('T')[0],
    status: 'in_progress',
    rules: {
      sets: 3,
      points_per_set: 21,
      win_by_2: true,
      point_cap: 30,
      deciding_set_points: null,
    },
    created_by: ownerId,
  };

  const { data: tourney, error: tErr } = await supabase
    .from('tournaments')
    .insert(tournamentData)
    .select()
    .single();

  if (tErr) {
    console.error('Failed to create tournament:', tErr.message);
    return;
  }

  console.log(`✔ Created Tournament: "${tourney.name}" (ID: ${tourney.id})`);

  // Create Categories
  const categories = [
    { name: 'Boys Singles', type: 'singles', gender: 'boys', format: 'knockout' },
    { name: 'Girls Singles', type: 'singles', gender: 'girls', format: 'knockout' },
    { name: 'Boys Doubles', type: 'doubles', gender: 'boys', format: 'knockout' },
    { name: 'Girls Doubles', type: 'doubles', gender: 'girls', format: 'knockout' },
    { name: 'Mixed Doubles', type: 'doubles', gender: 'mixed', format: 'knockout' },
  ];

  for (const cat of categories) {
    const { data: createdCat, error: catErr } = await supabase
      .from('categories')
      .insert({
        tournament_id: tourney.id,
        ...cat,
        status: 'in_progress',
      })
      .select()
      .single();

    if (catErr) {
      console.error(`Failed to create category ${cat.name}:`, catErr.message);
      continue;
    }

    console.log(`✔ Category Created: ${createdCat.name}`);

    // If Boys Singles: register 8 boys entries & generate matches
    if (cat.name === 'Boys Singles') {
      const topBoys = SAMPLE_PLAYERS.filter((p) => p.gender === 'boys').slice(0, 8);
      const entriesList: { id: string; name: string; rating: number; seed: number }[] = [];

      for (let i = 0; i < topBoys.length; i++) {
        const p = topBoys[i];
        const pId = playerIds[p.username];
        if (pId) {
          const { data: entry } = await supabase
            .from('entries')
            .insert({
              category_id: createdCat.id,
              player1_id: pId,
              seed: i + 1,
              pair_rating: p.rating,
              is_solo: false,
            })
            .select()
            .single();

          if (entry) {
            entriesList.push({
              id: entry.id,
              name: p.name,
              rating: p.rating,
              seed: i + 1,
            });
          }
        }
      }

      console.log(`  Added ${entriesList.length} seeded entries to Boys Singles`);

      // Generate Knockout Draw
      const draw = generateKnockoutDraw(entriesList);
      const insertedMatchesByRound: Record<number, Record<number, string>> = {};

      for (const round of draw.rounds) {
        insertedMatchesByRound[round.round] = {};
        for (const match of round.matches) {
          const { data: createdMatch } = await supabase
            .from('matches')
            .insert({
              category_id: createdCat.id,
              round: round.round,
              round_name: round.roundName,
              slot: match.slot,
              entry_a_id: match.entryA?.id || null,
              entry_b_id: match.entryB?.id || null,
              rules_snapshot: tourney.rules,
              status: match.isBye ? 'bye' : 'pending',
              winner_id: match.winner?.id || null,
              set_scores: [],
            })
            .select()
            .single();

          if (createdMatch) {
            insertedMatchesByRound[round.round][match.slot] = createdMatch.id;
          }
        }
      }

      // Link next_match_id
      for (const round of draw.rounds) {
        if (round.round < draw.roundsCount) {
          for (const match of round.matches) {
            const currentMatchId = insertedMatchesByRound[round.round]?.[match.slot];
            const nextSlot = Math.ceil(match.slot / 2);
            const nextMatchId = insertedMatchesByRound[round.round + 1]?.[nextSlot];
            if (currentMatchId && nextMatchId) {
              await supabase
                .from('matches')
                .update({ next_match_id: nextMatchId })
                .eq('id', currentMatchId);
            }
          }
        }
      }
      console.log(`  ✔ Generated 3 rounds of Knockout matches for Boys Singles`);
    }

    // If Boys Doubles: register 4 doubles teams & generate matches
    if (cat.name === 'Boys Doubles') {
      const doublesPairs = [
        { p1: 'arjun_v', p2: 'dev_p', name: 'Arjun Verma & Dev Patel', seed: 1 },
        { p1: 'vikram_s', p2: 'leo_c', name: 'Vikram Singh & Leo Chen', seed: 2 },
        { p1: 'rohit_m', p2: 'marcus_t', name: 'Rohit Mehta & Marcus Taylor', seed: 3 },
        { p1: 'rahul_k', p2: 'zayd_a', name: 'Rahul Kumar & Zayd Ali', seed: 4 },
      ];

      const entriesList: { id: string; name: string; rating: number; seed: number }[] = [];

      for (const pair of doublesPairs) {
        const id1 = playerIds[pair.p1];
        const id2 = playerIds[pair.p2];
        const player1 = SAMPLE_PLAYERS.find((p) => p.username === pair.p1);
        const player2 = SAMPLE_PLAYERS.find((p) => p.username === pair.p2);
        const avgRating = Math.round(((player1?.rating || 1000) + (player2?.rating || 1000)) / 2);

        if (id1 && id2) {
          const { data: entry } = await supabase
            .from('entries')
            .insert({
              category_id: createdCat.id,
              player1_id: id1,
              player2_id: id2,
              seed: pair.seed,
              pair_rating: avgRating,
              is_solo: false,
            })
            .select()
            .single();

          if (entry) {
            entriesList.push({
              id: entry.id,
              name: pair.name,
              rating: avgRating,
              seed: pair.seed,
            });
          }
        }
      }

      console.log(`  Added ${entriesList.length} doubles teams to Boys Doubles`);

      // Generate Knockout Draw for Doubles
      const draw = generateKnockoutDraw(entriesList);
      const insertedMatchesByRound: Record<number, Record<number, string>> = {};

      for (const round of draw.rounds) {
        insertedMatchesByRound[round.round] = {};
        for (const match of round.matches) {
          const { data: createdMatch } = await supabase
            .from('matches')
            .insert({
              category_id: createdCat.id,
              round: round.round,
              round_name: round.roundName,
              slot: match.slot,
              entry_a_id: match.entryA?.id || null,
              entry_b_id: match.entryB?.id || null,
              rules_snapshot: tourney.rules,
              status: match.isBye ? 'bye' : 'pending',
              winner_id: match.winner?.id || null,
              set_scores: [],
            })
            .select()
            .single();

          if (createdMatch) {
            insertedMatchesByRound[round.round][match.slot] = createdMatch.id;
          }
        }
      }

      // Link next_match_id
      for (const round of draw.rounds) {
        if (round.round < draw.roundsCount) {
          for (const match of round.matches) {
            const currentMatchId = insertedMatchesByRound[round.round]?.[match.slot];
            const nextSlot = Math.ceil(match.slot / 2);
            const nextMatchId = insertedMatchesByRound[round.round + 1]?.[nextSlot];
            if (currentMatchId && nextMatchId) {
              await supabase
                .from('matches')
                .update({ next_match_id: nextMatchId })
                .eq('id', currentMatchId);
            }
          }
        }
      }
      console.log(`  ✔ Generated 2 rounds of Knockout matches for Boys Doubles`);
    }
  }

  console.log('\n✨ Database seeding completed successfully!');
  console.log('You can now log in with email: ' + ownerEmail);
}

main().catch(console.error);
