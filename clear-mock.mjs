import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Deleting mock items...');
  const { data, error } = await supabase
    .from('items')
    .delete()
    .eq('is_mock', true);

  if (error) {
    console.error('Error deleting mock items:', error);
  } else {
    console.log('Successfully deleted mock items.');
  }
}

main();
