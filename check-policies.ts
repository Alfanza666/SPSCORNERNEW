import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  const { data, error } = await supabase
    .from('pg_policies')
    .select('*');
  
  if (error) {
    console.error('Error fetching policies:', error);
  } else {
    console.log('Policies:', JSON.stringify(data, null, 2));
  }
}

checkPolicies();
