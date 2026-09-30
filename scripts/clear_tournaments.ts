import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Clearing test tournaments...');
  const { data: tourneys, error: listErr } = await sb.from('tournaments').select('id, name');
  if (listErr) {
    console.error('Failed to list tournaments:', listErr);
    process.exit(1);
  }

  console.log(`Found ${tourneys?.length || 0} tournaments to remove.`);
  for (const t of tourneys || []) {
    const { error: delErr } = await sb.from('tournaments').delete().eq('id', t.id);
    if (delErr) {
      console.error(`Error deleting tournament ${t.id}:`, delErr);
    } else {
      console.log(`✔ Removed tournament: "${t.name}" (${t.id})`);
    }
  }

  console.log('All test tournaments removed successfully!');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
