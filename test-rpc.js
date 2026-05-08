import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('claim_auction_item', { p_item_id: '00000000-0000-0000-0000-000000000000' });
  // It should fail with "Not authenticated" or something similar, which proves the RPC exists.
  if (error) {
    console.log("RPC Error (expected):", error.message);
  } else {
    console.log("RPC Data:", data);
  }
}
test();
