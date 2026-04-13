const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = 'https://jofwebrbdlovwkgklwab.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('transaction_items')
    .select('*, products(name, category)')
    .limit(5);
  
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

test();
