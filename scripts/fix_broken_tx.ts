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

// Setup mock instances for services
import { initPaymentService, updateSellerBalances } from '../src/services/payment.js';
import { initStockService, commitTransactionStock } from '../src/services/stock.js';

initPaymentService(supabase);
initStockService(supabase);

async function fixBrokenTransactions() {
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('id, status, total_amount, metadata, created_at, transaction_items(*)')
    .in('status', ['paid', 'success']);

  if (error) {
    console.error("Error fetching transactions:", error);
    return;
  }

  const brokenBalances = txs.filter(tx => !tx.metadata?.balances_updated);
  console.log(`Found ${brokenBalances.length} paid/success transactions with UNPAID seller balances!`);
  
  for (const tx of brokenBalances) {
    console.log(`Fixing seller balance for Tx: ${tx.id}`);
    try {
      const result = await updateSellerBalances(tx.transaction_items, tx.id);
      console.log(`  Result:`, result);
    } catch (e) {
      console.error(`  Failed to fix balance for Tx: ${tx.id}`, e);
    }
  }

  const brokenStock = txs.filter(tx => tx.metadata?.stock_deducted === false);
  console.log(`\nFound ${brokenStock.length} paid/success transactions with UNDEDUCTED stock!`);
  for (const tx of brokenStock) {
    console.log(`Fixing stock for Tx: ${tx.id}`);
    try {
      const stockCommit = await commitTransactionStock(tx.id);
      console.log(`  Result:`, stockCommit);
    } catch (e) {
      console.error(`  Failed to fix stock for Tx: ${tx.id}`, e);
    }
  }

  console.log("\nFinished fixing broken transactions!");
}

fixBrokenTransactions();
