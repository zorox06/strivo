-- Migration: Support 5 skill tiers and ensure baseline 500 rating
-- Tiers: beginner, amateur, intermediate, advanced, professional

-- 1. Drop existing constraint and apply new 5-tier check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_level_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_level_check 
  CHECK (level in ('beginner', 'amateur', 'intermediate', 'advanced', 'professional'));

-- 2. Update default ratings from 1000 to 500
ALTER TABLE public.profiles ALTER COLUMN rating SET DEFAULT 500;
ALTER TABLE public.profiles ALTER COLUMN peak_rating SET DEFAULT 500;

-- 3. Reset any unplayed profiles starting from 1000 down to 500
UPDATE public.profiles 
SET rating = 500, peak_rating = 500 
WHERE matches_played = 0 AND rating = 1000;
