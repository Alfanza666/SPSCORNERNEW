import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE variables in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBrokenTransactions() {
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('id, status, total_amount, metadata, created_at')
    .in('status', ['paid', 'success']);

  if (error) {
    console.error("Error fetching transactions:", error);
    return;
  }

  const broken = txs.filter(tx => !tx.metadata?.balances_updated);
  console.log(`Found ${broken.length} paid/success transactions with UNPAID seller balances!`);
  
  for (const tx of broken) {
    console.log(`- Tx: ${tx.id} | Amount: ${tx.total_amount} | Created: ${tx.created_at}`);
  }

  const { data: brokenStock, error: stockError } = await supabase
    .from('transactions')
    .select('id, status, total_amount, metadata, created_at')
    .in('status', ['paid', 'success']);

  if (stockError) {
    console.error("Error fetching stock transactions:", stockError);
    return;
  }
  const brokenS = brokenStock.filter(tx => tx.metadata?.stock_deducted === false);
  console.log(`\nFound ${brokenS.length} paid/success transactions with UNDEDUCTED stock!`);
  for (const tx of brokenS) {
    console.log(`- Tx: ${tx.id} | Amount: ${tx.total_amount} | Created: ${tx.created_at}`);
  }
}

checkBrokenTransactions();
