import { config } from 'dotenv';
config();
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function fixFailedTransactions() {
  console.log("Fetching failed iPaymu transactions...");
  
  const { data: failedTx, error } = await supabase
    .from('transactions')
    .select('id, payment_method, metadata, payment_details, created_at')
    .eq('status', 'failed')
    .gte('created_at', '2024-07-01T00:00:00Z');

  if (error) {
    console.error("Gagal mengambil data:", error);
    return;
  }

  const relevantTx = failedTx.filter(tx => 
    tx.payment_method === 'qris' || 
    tx.payment_method === 'ipaymu' || 
    tx.payment_details?.ipaymu_trx_id ||
    tx.metadata?.ipaymu_trx_id
  );

  console.log(`Ditemukan ${relevantTx.length} transaksi gagal yang menggunakan iPaymu.`);
  console.log("Memulai proses sinkronisasi ulang dengan iPaymu...");

  let fixedCount = 0;
  for (const tx of relevantTx) {
    const ipaymuTrxId = tx.payment_details?.ipaymu_trx_id || tx.metadata?.ipaymu_trx_id || tx.id;
    
    console.log(`[${tx.id}] Mengecek status ulang via Webhook buatan... (iPaymu Trx ID: ${ipaymuTrxId})`);
    
    try {
      const payload = JSON.stringify({
        transaction_id: ipaymuTrxId,
        reference_id: tx.id,
        status: 'success'
      });
      
      const curlCmd = `curl -s -X POST http://127.0.0.1:3000/api/payment/ipaymu/callback -H 'Content-Type: application/json' -d '${payload}'`;
      const stdout = execSync(curlCmd, { encoding: 'utf-8' });
      
      try {
        const resData = JSON.parse(stdout);
        if (resData.success) {
          if (!resData.message?.includes('Ignored: transaction already paid')) {
             console.log(` ✅ BERHASIL! Transaksi ${tx.id} ternyata lunas di iPaymu dan telah diperbaiki di sistem kita!`);
             fixedCount++;
          } else {
             console.log(` ➖ Transaksi ${tx.id} sebelumnya sudah berstatus paid.`);
          }
        } else {
          console.log(` ❌ Transaksi ${tx.id} gagal dikonfirmasi (Response: ${JSON.stringify(resData)})`);
        }
      } catch (parseErr) {
        console.log(` ⚠️ Gagal mem-parse response API: ${stdout}`);
      }
      
      // Delay to avoid hitting PM2 rate limits (max 10 requests per minute = ~6s delay)
      await new Promise(r => setTimeout(r, 6500));
      
    } catch (e: any) {
      console.log(` ⚠️ Error menghubungi server lokal: ${e.message}`);
    }
  }

  console.log(`\nSelesai! Berhasil memperbaiki ${fixedCount} transaksi.`);
}

fixFailedTransactions();
