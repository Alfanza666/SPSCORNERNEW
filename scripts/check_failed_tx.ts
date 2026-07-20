import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFailedTransactions() {
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('id, status, total_amount, metadata, created_at, buyer_name')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(50); // Get the latest 50 failed transactions

  if (error) {
    console.error("Error fetching transactions:", error);
    return;
  }

  console.log(`Checking latest ${txs.length} failed transactions for webhook callbacks...`);
  
  let suspiciousCount = 0;
  
  for (const tx of txs) {
    const webhookStatus = tx.metadata?.webhook_status;
    const cancelReason = tx.metadata?.cancel_reason;
    const ipaymuStatus = tx.metadata?.ipaymu_status || tx.metadata?.status; // sometimes stored here
    
    // Check if there is any indication of successful payment in the metadata
    const seemsPaid = 
      (webhookStatus && ['paid', 'success', 'berhasil'].includes(webhookStatus.toLowerCase())) ||
      (ipaymuStatus && ['paid', 'success', 'berhasil'].includes(ipaymuStatus.toLowerCase()));

    if (seemsPaid || webhookStatus) {
      console.log(`\nTx ID: ${tx.id}`);
      console.log(`Buyer: ${tx.buyer_name} | Amount: ${tx.total_amount} | Created: ${tx.created_at}`);
      console.log(`Webhook Status: ${webhookStatus || 'none'}`);
      console.log(`Cancel Reason: ${cancelReason || 'none'}`);
      console.log(`Metadata snippet:`, JSON.stringify(tx.metadata).slice(0, 150));
      suspiciousCount++;
    }
  }
  
  if (suspiciousCount === 0) {
    console.log("\nNo failed transactions found with successful webhook callbacks in the recent 50 transactions.");
  } else {
    console.log(`\nFound ${suspiciousCount} failed transactions that have webhook callbacks!`);
  }
}

checkFailedTransactions();
