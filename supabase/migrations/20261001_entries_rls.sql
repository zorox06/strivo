-- Migration: 20261001_entries_rls.sql
-- Fix entries RLS to allow:
-- 1. Tournament creators (created_by) to manage entries, categories, and matches
-- 2. Authenticated players to self-register (insert) their own entry
-- 3. Authenticated players to withdraw (delete) their own entry
-- 4. Owners and managers to delete any entry

-- 1. ENTRIES POLICIES
drop policy if exists "Admins and managers can manage entries" on public.entries;
drop policy if exists "Admins, managers, and creators can manage entries" on public.entries;
drop policy if exists "Players can register themselves" on public.entries;
drop policy if exists "Players can withdraw their own entry" on public.entries;

-- Admins, tournament managers, and tournament creators can do ALL operations on entries
create policy "Admins, managers, and creators can manage entries"
  on public.entries for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.categories c
      join public.tournament_managers tm on tm.tournament_id = c.tournament_id
      where c.id = entries.category_id and tm.player_id = auth.uid()
    )
    or exists (
      select 1 from public.categories c
      join public.tournaments t on t.id = c.tournament_id
      where c.id = entries.category_id and t.created_by = auth.uid()
    )
  );

-- Players can self-register: insert entry where player1_id = auth.uid()
create policy "Players can register themselves"
  on public.entries for insert with check (
    auth.uid() = player1_id
  );

-- Players can withdraw their own entry (if they are player 1 or player 2)
create policy "Players can withdraw their own entry"
  on public.entries for delete using (
    auth.uid() = player1_id or auth.uid() = player2_id
  );

-- 2. CATEGORIES POLICIES (ensure creators can also manage categories)
drop policy if exists "Admins and managers can modify categories" on public.categories;
drop policy if exists "Admins, managers, and creators can modify categories" on public.categories;

create policy "Admins, managers, and creators can modify categories"
  on public.categories for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.tournament_managers tm
      where tm.tournament_id = categories.tournament_id and tm.player_id = auth.uid()
    )
    or exists (
      select 1 from public.tournaments t
      where t.id = categories.tournament_id and t.created_by = auth.uid()
    )
  );

-- 3. MATCHES POLICIES (ensure creators can also manage matches)
drop policy if exists "Admins and full managers can update matches" on public.matches;
drop policy if exists "Admins, managers, and creators can update matches" on public.matches;

create policy "Admins, managers, and creators can update matches"
  on public.matches for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (
      select 1 from public.categories c
      join public.tournament_managers tm on tm.tournament_id = c.tournament_id
      where c.id = matches.category_id and tm.player_id = auth.uid()
    )
    or exists (
      select 1 from public.categories c
      join public.tournaments t on t.id = c.tournament_id
      where c.id = matches.category_id and t.created_by = auth.uid()
    )
  );
