// @ts-nocheck
// Repair only missing earned ledger rows for already-settled auto-paid transactions.
// This script intentionally does NOT increment profile loyalty_points.
// Run with --apply after reviewing the dry-run output.

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getChargeableAmount(tx: any): number {
  const metadata = tx.metadata || {};
  const remaining = Number(metadata.remaining_amount);
  if (metadata.point_payment && remaining > 0 && remaining < Number(tx.total_amount)) return Math.round(remaining);
  return Math.round(Number(tx.total_amount) || 0);
}

const { data: transactions, error } = await supabase
  .from('transactions')
  .select('id, buyer_id, total_amount, metadata, payment_details')
  .eq('status', 'paid')
  .eq('payment_method', 'qris')
  .eq('payment_details->>auto_verified', 'true')
  .not('buyer_id', 'is', null)
  .order('created_at', { ascending: true });
if (error) throw error;

let repaired = 0;
let skipped = 0;
for (const tx of transactions || []) {
  const points = Math.floor(getChargeableAmount(tx) * 0.008);
  if (points < 1) {
    skipped++;
    continue;
  }

  const { data: existing, error: existingError } = await supabase
    .from('points_history')
    .select('id')
    .eq('transaction_id', tx.id)
    .eq('type', 'earned')
    .limit(1);
  if (existingError) throw existingError;
  if (existing?.length) {
    skipped++;
    continue;
  }

  console.log(`${apply ? 'REPAIR' : 'WOULD_REPAIR'} ${tx.id.slice(0, 8)} points=${points}`);
  if (!apply) continue;

  const { error: insertError } = await supabase.from('points_history').insert({
    user_id: tx.buyer_id,
    transaction_id: tx.id,
    points,
    type: 'earned',
    description: `Ledger repair poin dari transaksi auto-paid #${tx.id.slice(0, 8)}`,
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (insertError) throw insertError;
  repaired++;
}

console.log(JSON.stringify({ apply, scanned: transactions?.length || 0, repaired, skipped }, null, 2));
