// @ts-nocheck
// Script: force-process-paid.ts
// Force-process transaksi yang sudah TERKONFIRMASI PAID di dashboard iPaymu
// tapi gagal dicek via API (Fixie timeout).
// Kecualikan yang expired: #06ac5552 (iPaymu trxId=37203675 — status Expired)
// Jalankan dari ROOT: npx tsx scripts/force-process-paid.ts

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { initStockService, commitTransactionStock } from '../src/services/stock.js';
import { initPaymentService, updateSellerBalances, updateBuyerPoints } from '../src/services/payment.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

initStockService(supabase, null, null);
initPaymentService(supabase);

// Daftar transaksi yang SUDAH CONFIRMED BERHASIL di iPaymu dashboard
// (dikecualikan: #06ac5552 = Expired di iPaymu)
const PAID_TX_IDS = [
  '2b6cfdef', // Rp20.000 — iPaymu #37207866 — Berhasil+Unsettled
  '269c576c', // Rp12.400 — iPaymu #37203315 — Berhasil+Unsettled
  'd7b6af9d', // Rp5.700  — iPaymu #37201448 — Berhasil+Unsettled
  '61502412', // Rp16.000 — iPaymu #37201220 — Berhasil+Unsettled
  '567e50d3', // Rp4.300  — iPaymu #37200715 — Berhasil+Unsettled
  'a1763633', // Rp3.000  — iPaymu #37200632 — Berhasil+Unsettled
  'a73bc542', // Rp13.000 — iPaymu #37197611 — Berhasil+Unsettled
  '8732e1cd', // Rp2.000  — iPaymu #37196958 — Berhasil+Unsettled
  'f818bb92', // Rp2.100  — iPaymu #37194989 — Berhasil+Unsettled
  '67728ec0', // Rp2.100  — iPaymu #37192765 — Berhasil+Unsettled
  'd48c194b', // Rp10.500 — iPaymu #37192414 — Berhasil+Unsettled
  '3a13eb53', // Rp10.200 — iPaymu #37190556 — Berhasil+Unsettled
  '628d5904', // Rp12.000 — iPaymu #37190145 — Berhasil+Unsettled
  '368e833f', // Rp10.000 — iPaymu #37189422 — Berhasil+Unsettled
  '3ee34e37', // Rp12.000 — iPaymu #37188675 — Berhasil+Unsettled
];

// Yang EXPIRED di iPaymu — update ke failed
const EXPIRED_TX_IDS = [
  '06ac5552', // Rp2.000 — iPaymu #37203675 — Expired
];

function getChargeableAmount(tx: any): number {
  const meta = tx.metadata || {};
  const remaining = Number(meta.remaining_amount);
  if (meta.point_payment && remaining > 0 && remaining < Number(tx.total_amount)) {
    return Math.round(remaining);
  }
  return Math.round(Number(tx.total_amount));
}

async function processOneTx(tx: any) {
  const pd = tx.payment_details || {};
  process.stdout.write(`  #${tx.id.slice(0, 8)} | Rp${Number(tx.total_amount).toLocaleString('id-ID')} → `);

  // Stock must be committed before marking a transaction as paid.
  try {
    const r = await commitTransactionStock(tx.id);
    if (!r?.success) {
      console.log(`       Stock  : GAGAL — ${r?.error}`);
      return;
    }
    console.log(`       Stock  : ${r?.alreadyCommitted ? 'sudah committed' : 'committed'} ✅`);
  } catch (e) {
    console.log(`       Stock  : ERROR — ${e.message}`);
    return;
  }

  const { data: claimed, error: updateErr } = await supabase
    .from('transactions')
    .update({
      status: 'paid',
      payment_details: {
        ...pd,
        ipaymu_status: 'paid',
        paid_at: new Date().toISOString(),
        auto_verified: true,
        auto_verified_source: 'dashboard_confirmed',
        auto_verified_at: new Date().toISOString(),
      }
    })
    .eq('id', tx.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (updateErr) {
    console.log(`❌ Update gagal: ${updateErr.message}`);
    return;
  }
  if (!claimed) {
    console.log('⏭️ sudah diproses proses lain');
    return;
  }
  console.log('✅ paid');

  // Seller balance
  try {
    await updateSellerBalances(tx.transaction_items, tx.id);
    console.log(`       Balance: settled ✅`);
  } catch (e) {
    console.log(`       Balance: ERROR — ${e.message}`);
  }

  // 4. Buyer points
  try {
    await updateBuyerPoints(tx.id, tx.buyer_id, getChargeableAmount(tx));
    console.log(`       Points : updated ✅`);
  } catch (e) {
    console.log(`       Points : ERROR — ${e.message}`);
  }
}

async function main() {
  console.log('=== Force-Process Confirmed Paid Transactions ===\n');

  // Ambil data lengkap untuk semua TX yang perlu diproses
  // Match by short ID prefix (8 char)
  const allIds = [...PAID_TX_IDS, ...EXPIRED_TX_IDS];

  // Query semua pending tx yang masih ada
  const { data: txList, error } = await supabase
    .from('transactions')
    .select('id, buyer_id, buyer_name, total_amount, payment_method, payment_details, metadata, created_at, transaction_items(*)')
    .in('status', ['pending'])
    .not('payment_details->>ipaymu_trx_id', 'is', null);

  if (error) {
    console.error('❌ Query gagal:', error.message);
    process.exit(1);
  }

  // Filter berdasarkan prefix ID
  const paidList = (txList || []).filter(tx => PAID_TX_IDS.some(prefix => tx.id.startsWith(prefix)));
  const expiredList = (txList || []).filter(tx => EXPIRED_TX_IDS.some(prefix => tx.id.startsWith(prefix)));

  console.log(`📋 Akan diproses sebagai PAID   : ${paidList.length} transaksi`);
  console.log(`📋 Akan diproses sebagai EXPIRED : ${expiredList.length} transaksi\n`);

  // Proses PAID
  if (paidList.length > 0) {
    console.log('--- PAID ---');
    for (const tx of paidList) {
      await processOneTx(tx);
    }
  }

  // Proses EXPIRED — update ke failed saja, tidak perlu proses stock/balance
  if (expiredList.length > 0) {
    console.log('\n--- EXPIRED/FAILED ---');
    for (const tx of expiredList) {
      const pd = tx.payment_details || {};
      process.stdout.write(`  #${tx.id.slice(0, 8)} | Rp${Number(tx.total_amount).toLocaleString('id-ID')} → `);
      await supabase
        .from('transactions')
        .update({
          status: 'failed',
          metadata: { ...(tx.metadata || {}), cancel_reason: 'iPaymu Expired — confirmed via dashboard' },
          payment_details: { ...pd, ipaymu_status: 'expired' }
        })
        .eq('id', tx.id)
        .eq('status', 'pending');
      console.log('❌ marked failed (expired)');
    }
  }

  console.log('\n✅ Selesai.');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
