// Central Supabase configuration with hardcoded credentials and fallbacks
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hccdzyhbyhanbyrbjazn.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2R6eWhieWhhbmJ5cmJqYXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzcwNTcsImV4cCI6MjEwNjM1MzA1N30._zsiFkzFSiGTMJYxMA61ifSlQXCAPsnqOqC-o0LeSPE';

export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2R6eWhieWhhbmJ5cmJqYXpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDc3NzA1NywiZXhwIjoyMTA2MzUzMDU3fQ.RbI68tVukHLIMe72kuQ3EMCFoIgFExDDIo5ghK5lDTM';

// Hardcoded standard password for default/seeded users
export const DEFAULT_USER_PASSWORD = 'password123';
