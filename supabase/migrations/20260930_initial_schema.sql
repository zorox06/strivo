-- =====================================================================
-- Badminton Tournament Management System - Initial Migration
-- PostgreSQL Schema with Row Level Security (RLS) & Realtime
-- =====================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- =====================================================================
-- 1. PROFILES & CONTACTS
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username citext unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  name text not null,
  gender text not null check (gender in ('boys', 'girls')),
  avatar_id text not null default 'cat-01',
  bio text default '',
  level text not null default 'intermediate' check (level in ('beginner', 'amateur', 'intermediate', 'advanced', 'professional')),
  rating integer not null default 500,
  peak_rating integer not null default 500,
  matches_played integer not null default 0,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_contacts (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  show_phone boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Secure Profile View enforcing database-level phone privacy
create or replace view public.profiles_view with (security_invoker = true) as
select
  p.id,
  p.email,
  p.username,
  p.name,
  p.gender,
  p.avatar_id,
  p.bio,
  p.level,
  p.rating,
  p.peak_rating,
  p.matches_played,
  p.is_admin,
  p.created_at,
  case
    when p.id = auth.uid() or (pc.show_phone = true and auth.uid() is not null) then pc.phone
    else null
  end as phone,
  case
    when p.id = auth.uid() then pc.show_phone
    else null
  end as show_phone
from public.profiles p
left join public.player_contacts pc on p.id = pc.player_id;

-- =====================================================================
-- 2. TOURNAMENTS & MANAGERS
-- =====================================================================
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'published', 'in_progress', 'completed')),
  rules jsonb not null default '{
    "sets": 3,
    "points_per_set": 21,
    "win_by_2": true,
    "point_cap": 30,
    "deciding_set_points": null
  }'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_managers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  level text not null check (level in ('entries', 'full')),
  created_at timestamptz not null default now(),
  unique(tournament_id, player_id)
);

-- =====================================================================
-- 3. CATEGORIES & ENTRIES
-- =====================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  type text not null check (type in ('singles', 'doubles')),
  gender text not null check (gender in ('boys', 'girls', 'mixed')),
  format text not null check (format in ('knockout', 'groups_knockout', 'swiss')),
  rules_override jsonb default null,
  status text not null default 'draft' check (status in ('draft', 'draw_generated', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  player1_id uuid not null references public.profiles(id) on delete cascade,
  player2_id uuid references public.profiles(id) on delete cascade,
  seed integer,
  is_solo boolean not null default false,
  pair_rating integer not null default 1000,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 4. MATCHES, RATING HISTORY & AUDIT LOG
-- =====================================================================
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  round integer not null,
  round_name text,
  slot integer not null,
  entry_a_id uuid references public.entries(id) on delete set null,
  entry_b_id uuid references public.entries(id) on delete set null,
  next_match_id uuid references public.matches(id) on delete set null,
  rules_snapshot jsonb not null,
  set_scores jsonb not null default '[]'::jsonb,
  winner_id uuid references public.entries(id) on delete set null,
  court text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'bye')),
  match_order integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rating_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  rating_before integer not null,
  rating_after integer not null,
  delta integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  action text not null,
  actor_id uuid references public.profiles(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.player_contacts enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_managers enable row level security;
alter table public.categories enable row level security;
alter table public.entries enable row level security;
alter table public.matches enable row level security;
alter table public.rating_history enable row level security;
alter table public.audit_log enable row level security;

-- PROFILES RLS
drop policy if exists "Profiles are viewable by all authenticated users" on public.profiles;
create policy "Profiles are viewable by all authenticated users"
  on public.profiles for select using (auth.uid() is not null);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- CONTACTS RLS (Database-enforced phone privacy)
drop policy if exists "Contacts viewable by owner or if show_phone is true to authenticated" on public.player_contacts;
create policy "Contacts viewable by owner or if show_phone is true to authenticated"
  on public.player_contacts for select using (
    auth.uid() = player_id or (show_phone = true and auth.uid() is not null)
  );

drop policy if exists "Players can insert their own contact" on public.player_contacts;
create policy "Players can insert their own contact"
  on public.player_contacts for insert with check (auth.uid() = player_id);

drop policy if exists "Players can update their own contact" on public.player_contacts;
create policy "Players can update their own contact"
  on public.player_contacts for update using (auth.uid() = player_id);

-- TOURNAMENTS RLS
drop policy if exists "Tournaments are viewable by anyone authenticated" on public.tournaments;
create policy "Tournaments are viewable by anyone authenticated"
  on public.tournaments for select using (auth.uid() is not null);

drop policy if exists "Admins can manage tournaments" on public.tournaments;
create policy "Admins can manage tournaments"
  on public.tournaments for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- MANAGERS RLS
drop policy if exists "Managers viewable by authenticated users" on public.tournament_managers;
create policy "Managers viewable by authenticated users"
  on public.tournament_managers for select using (auth.uid() is not null);

drop policy if exists "Only admins can manage tournament managers" on public.tournament_managers;
create policy "Only admins can manage tournament managers"
  on public.tournament_managers for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- CATEGORIES RLS
drop policy if exists "Categories are viewable by all authenticated users" on public.categories;
create policy "Categories are viewable by all authenticated users"
  on public.categories for select using (auth.uid() is not null);

drop policy if exists "Admins and managers can modify categories" on public.categories;
create policy "Admins and managers can modify categories"
  on public.categories for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.tournament_managers
      where tournament_id = categories.tournament_id and player_id = auth.uid()
    )
  );

-- ENTRIES RLS
drop policy if exists "Entries viewable by all authenticated users" on public.entries;
create policy "Entries viewable by all authenticated users"
  on public.entries for select using (auth.uid() is not null);

drop policy if exists "Admins and managers can manage entries" on public.entries;
create policy "Admins and managers can manage entries"
  on public.entries for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.categories c
      join public.tournament_managers tm on tm.tournament_id = c.tournament_id
      where c.id = entries.category_id and tm.player_id = auth.uid()
    )
  );

-- MATCHES RLS
drop policy if exists "Matches are viewable by all authenticated users" on public.matches;
create policy "Matches are viewable by all authenticated users"
  on public.matches for select using (auth.uid() is not null);

drop policy if exists "Admins and full managers can update matches" on public.matches;
create policy "Admins and full managers can update matches"
  on public.matches for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.categories c
      join public.tournament_managers tm on tm.tournament_id = c.tournament_id
      where c.id = matches.category_id
        and tm.player_id = auth.uid()
        and tm.level = 'full'
    )
  );

-- RATING HISTORY RLS
drop policy if exists "Rating history is viewable by all authenticated users" on public.rating_history;
create policy "Rating history is viewable by all authenticated users"
  on public.rating_history for select using (auth.uid() is not null);

drop policy if exists "Rating history insertable by admins and full managers" on public.rating_history;
create policy "Rating history insertable by admins and full managers"
  on public.rating_history for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.matches m
      join public.categories c on c.id = m.category_id
      join public.tournament_managers tm on tm.tournament_id = c.tournament_id
      where m.id = rating_history.match_id and tm.player_id = auth.uid() and tm.level = 'full'
    )
  );

-- AUDIT LOG RLS
drop policy if exists "Audit log is viewable by admin and tournament managers" on public.audit_log;
create policy "Audit log is viewable by admin and tournament managers"
  on public.audit_log for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or (
      tournament_id is not null and exists (
        select 1 from public.tournament_managers
        where tournament_id = audit_log.tournament_id and player_id = auth.uid()
      )
    )
  );

drop policy if exists "Audit log insertable by admin and managers" on public.audit_log;
create policy "Audit log insertable by admin and managers"
  on public.audit_log for insert with check (auth.uid() is not null);

-- Realtime publications
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tournaments') then
    alter publication supabase_realtime add table public.tournaments;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rating_history') then
    alter publication supabase_realtime add table public.rating_history;
  end if;
exception when others then
  raise notice 'Realtime publication setup skipped or not supported';
end
$$;
