// @ts-nocheck
// Script: verify-pending-ipaymu.ts
// Cek semua transaksi MENUNGGU yang punya ipaymu_trx_id, verifikasi ke iPaymu,
// dan proses otomatis jika sudah dibayar.
// Jalankan dari ROOT project: npx tsx scripts/verify-pending-ipaymu.ts

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { IpaymuClient } from '../src/services/ipaymu/client.js';
import { initStockService, commitTransactionStock } from '../src/services/stock.js';
import { initPaymentService, updateSellerBalances, updateBuyerPoints } from '../src/services/payment.js';
import { initNotificationService, sendNotification } from '../src/services/notification.js';
import https from 'https';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Init services
initStockService(supabase, null, null);
initPaymentService(supabase);
initNotificationService(supabase, null);

const IPAYMU_VA = (process.env.IPAYMU_VA || '').replace(/['"]/g, '').trim();
const IPAYMU_API_KEY = (process.env.IPAYMU_API_KEY || '').replace(/['"]/g, '').trim();
const IPAYMU_PRODUCTION = process.env.IPAYMU_PRODUCTION !== 'false';
const FIXIE_URL = process.env.FIXIE_URL && !process.env.FIXIE_URL.includes('YOUR_FIXIE') ? process.env.FIXIE_URL : null;

// Gunakan Fixie proxy agar IP match dengan whitelist iPaymu
// (script lokal tidak punya IP VPS yang di-whitelist)
const ipaymu = new IpaymuClient(
  IPAYMU_VA,
  IPAYMU_API_KEY,
  IPAYMU_PRODUCTION,
  {},       // axiosConfig dasar
  FIXIE_URL, // fixieUrl — dipakai sebagai httpsAgent proxy
  !!FIXIE_URL // requireStaticEgress = true jika Fixie tersedia
);

const PAID_STATUSES = new Set(['paid', 'success', 'sukses', 'berhasil', 'completed', 'settlement']);
const FAILED_STATUSES = new Set(['failed', 'fail', 'gagal', 'expired', 'cancel', 'cancelled', 'canceled', 'deny', 'denied']);

function isPaid(statusResponse: any): boolean {
  const values: string[] = [];
  const visit = (value: any, key = '') => {
    if (!value || typeof value !== 'object') {
      if (key.toLowerCase().includes('status') && typeof value === 'string')
        values.push(value.toLowerCase().trim());
      return;
    }
    for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  visit(statusResponse);
  return values.some(v => PAID_STATUSES.has(v));
}

function isFailed(statusResponse: any): boolean {
  const data = statusResponse?.Data || statusResponse || {};
  const statusCode = Number(data.Status ?? data.status_code ?? data.transaction_status_code);
  if (Number.isFinite(statusCode) && statusCode === -2) return true;

  const textValues = [
    data.status,
    data.Status,
    data.status_desc,
    data.StatusDesc,
    data.payment_status,
    data.PaidStatus,
    data.transaction_status,
  ]
    .filter(value => typeof value === 'string')
    .map(value => value.trim().toLowerCase());

  return textValues.some(value => FAILED_STATUSES.has(value));
}

function getChargeableAmount(tx: any): number {
  const meta = tx.metadata || {};
  const remaining = Number(meta.remaining_amount);
  if (meta.point_payment && remaining > 0 && remaining < Number(tx.total_amount)) {
    return Math.round(remaining);
  }
  return Math.round(Number(tx.total_amount));
}

async function main() {
  console.log('=== SPS Corner — iPaymu Pending Verifier ===\n');
  console.log(`iPaymu configured: ${Boolean(IPAYMU_VA && IPAYMU_API_KEY)}`);
  console.log(`Production : ${IPAYMU_PRODUCTION}\n`);

  // Ambil semua transaksi pending yang punya ipaymu_trx_id
  const { data: pendingTx, error } = await supabase
    .from('transactions')
    .select('id, buyer_id, buyer_name, total_amount, payment_method, payment_details, metadata, created_at, transaction_items(*)')
    .in('status', ['pending'])
    .not('payment_details->>ipaymu_trx_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Gagal query Supabase:', error.message);
    process.exit(1);
  }

  if (!pendingTx || pendingTx.length === 0) {
    console.log('✅ Tidak ada transaksi pending dengan ipaymu_trx_id.\n');
    return;
  }

  console.log(`📋 Ditemukan ${pendingTx.length} transaksi pending dengan ipaymu_trx_id:\n`);

  let confirmedPaid = 0;
  let expiredAtGateway = 0;
  let stillPending = 0;
  let checkErrors = 0;

  for (const tx of pendingTx) {
    const pd = tx.payment_details || {};
    const ipaymuTrxId = pd.ipaymu_trx_id;
    const age = Math.round((Date.now() - new Date(tx.created_at).getTime()) / 60000);

    process.stdout.write(
      `  #${tx.id.slice(0, 8)} | Rp${Number(tx.total_amount).toLocaleString('id-ID')} | ${tx.payment_method} | ${age}m lalu | trxId=${ipaymuTrxId} → `
    );

    try {
      const statusResp = await ipaymu.getTransactionStatus(ipaymuTrxId);
      const paid = isPaid(statusResp);

      if (paid) {
        // Stock must be committed before marking a transaction as paid.
        try {
          const stockResult = await commitTransactionStock(tx.id);
          if (stockResult?.alreadyCommitted) {
            console.log(`       Stock : sudah committed sebelumnya ✅`);
          } else if (stockResult?.success) {
            console.log(`       Stock : committed ✅`);
          } else {
            console.log(`       Stock : GAGAL ⚠️ — ${stockResult?.error}`);
            checkErrors++;
            continue;
          }
        } catch (e) {
          console.log(`       Stock : ERROR ⚠️ — ${e.message}`);
          checkErrors++;
          continue;
        }

        // Claim the pending row only after stock is ready.
        const { data: claimed, error: claimError } = await supabase
          .from('transactions')
          .update({
            status: 'paid',
            payment_details: {
              ...pd,
              ipaymu_status: 'paid',
              paid_at: new Date().toISOString(),
              auto_verified: true,
              auto_verified_at: new Date().toISOString(),
            }
          })
          .eq('id', tx.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle();

        if (claimError) {
          console.log(`       Status : UPDATE ERROR ⚠️ — ${claimError.message}`);
          checkErrors++;
          continue;
        }
        if (!claimed) {
          console.log(`       Status : dilewati, sudah diproses proses lain`);
          continue;
        }

        console.log(`✅ PAID`);

        // Seller balance (idempotent via RPC)
        try {
          await updateSellerBalances(tx.transaction_items, tx.id);
          console.log(`       Balance: settled ✅`);
        } catch (e) {
          console.log(`       Balance: ERROR ⚠️ — ${e.message}`);
        }

        // 4. Buyer points (idempotent via guard baru)
        try {
          await updateBuyerPoints(tx.id, tx.buyer_id, getChargeableAmount(tx));
          console.log(`       Points : updated ✅`);
        } catch (e) {
          console.log(`       Points : ERROR ⚠️ — ${e.message}`);
        }

        // 5. Notif buyer
        if (tx.buyer_id) {
          try {
            await sendNotification(tx.buyer_id, {
              type: 'transaction',
              title: '✅ Pembayaran Dikonfirmasi',
              message: `Transaksi #${tx.id.slice(0, 8)} sebesar Rp ${Number(tx.total_amount).toLocaleString('id-ID')} telah dikonfirmasi.`,
              path: `/kiosk/history?id=${tx.id}`,
            });
            console.log(`       Notif  : terkirim ✅`);
          } catch (e) {
            console.log(`       Notif  : gagal (non-blocking)`);
          }
        }

        confirmedPaid++;
      } else {
        // Cek apakah expired/failed di iPaymu
        const isExpired = isFailed(statusResp);

        if (isExpired) {
          console.log(`❌ EXPIRED/FAILED di gateway`);
          await supabase
            .from('transactions')
            .update({
              status: 'failed',
              metadata: { ...(tx.metadata || {}), cancel_reason: 'Auto-cancelled: gateway expired/failed' },
              payment_details: { ...pd, ipaymu_status: 'expired' }
            })
            .eq('id', tx.id)
            .eq('status', 'pending');
          expiredAtGateway++;
        } else {
          console.log(`⏳ Masih pending di gateway`);
          stillPending++;
        }
      }
    } catch (e) {
      console.log(`⚠️ Error: ${e.message}`);
      checkErrors++;
    }

    // Rate-limit protection
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n════════════════════════════');
  console.log('HASIL VERIFIKASI:');
  console.log(`  ✅ Dikonfirmasi paid & diproses : ${confirmedPaid}`);
  console.log(`  ❌ Expired/failed di gateway     : ${expiredAtGateway}`);
  console.log(`  ⏳ Masih pending di gateway      : ${stillPending}`);
  console.log(`  ⚠️ Error cek iPaymu              : ${checkErrors}`);
  console.log('════════════════════════════\n');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
