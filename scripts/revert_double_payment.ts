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

async function revertDoublePayments() {
  console.log("Starting revert process for double payments before June 30, 2026...");
  
  // Find transactions created before June 30, 2026, that were marked as 'balances_updated' by our previous script
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('id, status, total_amount, metadata, created_at, transaction_items(*)')
    .in('status', ['paid', 'success'])
    .lt('created_at', '2026-06-30T00:00:00Z')
    .eq('metadata->>balances_updated', 'true');

  if (error) {
    console.error("Error fetching transactions:", error);
    return;
  }

  console.log(`Found ${txs.length} transactions to revert.`);

  // We need to aggregate the deductions per seller to do fewer database calls,
  // or just loop through and deduct item by item.
  // Aggregating is safer and faster.
  
  const sellerDeductions = {};
  
  for (const tx of txs) {
    for (const item of tx.transaction_items) {
      if (!item.seller_id) continue;
      
      const subtotal = Number(item.subtotal) || 0;
      const gross = Number(item.price) * Number(item.quantity);
      const fee = gross - subtotal;
      
      if (!sellerDeductions[item.seller_id]) {
        sellerDeductions[item.seller_id] = { balance: 0, sales: 0, fee: 0 };
      }
      
      sellerDeductions[item.seller_id].balance += subtotal;
      sellerDeductions[item.seller_id].sales += gross;
      sellerDeductions[item.seller_id].fee += fee;
    }
  }

  console.log("Seller deductions to apply:");
  console.log(sellerDeductions);

  // Apply deductions to profiles
  for (const [sellerId, deduction] of Object.entries(sellerDeductions)) {
    // We need to do this atomically or sequentially.
    // Fetch current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance, total_sales, total_fee_paid')
      .eq('id', sellerId)
      .single();
      
    if (profileError || !profile) {
      console.error(`Could not fetch profile for seller ${sellerId}`, profileError);
      continue;
    }
    
    const newBalance = Math.max(0, (Number(profile.balance) || 0) - deduction.balance);
    const newSales = Math.max(0, (Number(profile.total_sales) || 0) - deduction.sales);
    const newFee = Math.max(0, (Number(profile.total_fee_paid) || 0) - deduction.fee);
    
    console.log(`Seller ${sellerId}: Balance ${profile.balance} -> ${newBalance}`);
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        balance: newBalance,
        total_sales: newSales,
        total_fee_paid: newFee
      })
      .eq('id', sellerId);
      
    if (updateError) {
      console.error(`Failed to update seller ${sellerId}`, updateError);
    } else {
      console.log(`Successfully reverted balance for seller ${sellerId}`);
    }
  }

  // Remove balances_updated from the transactions
  let txUpdated = 0;
  for (const tx of txs) {
    const newMetadata = { ...tx.metadata };
    delete newMetadata.balances_updated;
    
    const { error: txUpdateError } = await supabase
      .from('transactions')
      .update({ metadata: newMetadata })
      .eq('id', tx.id);
      
    if (txUpdateError) {
      console.error(`Failed to update metadata for tx ${tx.id}`, txUpdateError);
    } else {
      txUpdated++;
    }
  }
  
  console.log(`Finished updating metadata for ${txUpdated} transactions.`);
}

revertDoublePayments();
