import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('*')
    .eq('table_schema', 'public');
  
  if (error) {
    console.error('Error fetching tables:', error);
  } else {
    console.log('Tables in public schema:', data.map(t => t.table_name));
  }
}

checkTables();
