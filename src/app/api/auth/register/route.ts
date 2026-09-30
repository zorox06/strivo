import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_USER_PASSWORD } from '@/lib/supabase/config';
import { STARTING_LEVEL_RATINGS } from '@/lib/rating/elo';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      username: rawUsername,
      name: rawName,
      email: rawEmail,
      password: rawPassword,
      gender = 'boys',
      level = 'intermediate',
      avatarId = 'cat-01',
    } = body;

    const username = (rawUsername || '').trim().toLowerCase();
    const name = (rawName || '').trim();
    const email = (rawEmail || '').trim().toLowerCase();
    const password = (rawPassword || '').trim() || DEFAULT_USER_PASSWORD;

    // Validation
    if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-20 characters (letters, numbers, underscores only).' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Please enter your full name.' },
        { status: 400 }
      );
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Check if username is already taken in profiles
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'This username is already taken. Please pick another.' },
        { status: 400 }
      );
    }

    // Check if email already exists in profiles
    const { data: existingEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in.' },
        { status: 400 }
      );
    }

    // Create user in Supabase auth with confirmed email (NO OTP sent!)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, name },
    });

    if (authError || !authData.user) {
      // If user already exists in auth.users but not in profiles
      if (authError?.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'This email is already registered. Please sign in.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user account.' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;
    const startingRating =
      STARTING_LEVEL_RATINGS[level as keyof typeof STARTING_LEVEL_RATINGS] || 1000;

    // Create profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      username,
      name,
      gender: gender === 'girls' ? 'girls' : 'boys',
      level: ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'intermediate',
      rating: startingRating,
      peak_rating: startingRating,
      avatar_id: avatarId || 'cat-01',
      bio: '',
      matches_played: 0,
      is_admin: false,
    });

    if (profileError) {
      console.error('Error inserting profile during registration:', profileError);
      return NextResponse.json(
        { error: 'Account created, but profile initialization failed. Please sign in.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId,
      email,
      username,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal registration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
