import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { identifier } = await request.json();

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: 'Identifier is required' },
        { status: 400 }
      );
    }

    const clean = identifier.trim().toLowerCase();

    // If already an email, return directly
    if (clean.includes('@')) {
      return NextResponse.json({ email: clean });
    }

    // Lookup profile by username using admin client
    const supabaseAdmin = createAdminClient();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('username', clean)
      .maybeSingle();

    if (profile?.email) {
      return NextResponse.json({ email: profile.email });
    }

    // Fallback: check sample email domain or standard domain
    return NextResponse.json({ email: `${clean}@badminton.app` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve identifier';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
