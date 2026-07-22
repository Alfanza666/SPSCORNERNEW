const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const envContent = fs.readFileSync('/opt/sps-backend/.env', 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const VA = env.IPAYMU_VA;
const API_KEY = env.IPAYMU_API_KEY;

console.log(`VA: ${VA ? VA.slice(0, 8) + '...' : 'MISSING'}`);
console.log(`API_KEY: ${API_KEY ? API_KEY.slice(0, 8) + '...' : 'MISSING'}`);

function generateSignature(jsonBody) {
  const bodyHash = crypto.createHash('sha256').update(jsonBody).digest('hex').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const stringToSign = `POST:${VA}:${bodyHash}:${API_KEY}`;
  const signature = crypto.createHmac('sha256', API_KEY).update(stringToSign).digest('hex').toLowerCase();
  return { signature, timestamp };
}

function ipaymuLookup(transactionId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ transactionId });
    const { signature, timestamp } = generateSignature(body);
    const options = {
      hostname: 'my.ipaymu.com',
      path: '/api/v2/transaction',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'va': VA,
        'signature': signature,
        'timestamp': timestamp,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const sevenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: failedTx, error } = await supabase
    .from('transactions')
    .select('id, status, total_amount, created_at, buyer_name, buyer_id, payment_details, payment_method, metadata')
    .eq('status', 'failed')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) { console.error(error); return; }

  const qrisFailed = (failedTx || []).filter(t =>
    t.payment_method?.toLowerCase().includes('ipaymu') ||
    t.payment_method?.toLowerCase().includes('qris')
  );

  console.log(`\nFound ${qrisFailed.length} failed iPaymu/QRIS transactions\n`);

  const results = { fixed: 0, expired: 0, notFound: 0, errors: 0 };

  for (const tx of qrisFailed) {
    const lookupId = tx.payment_details?.ipaymu_trx_id || tx.id;

    try {
      const resp = await ipaymuLookup(lookupId);

      if (resp.Status === 200 && resp.Data) {
        const d = resp.Data;
        const st = d.Status;

        if (st === 6 || st === 7) {
          console.log(`\n✅ PAID ${tx.id} | Rp ${tx.total_amount} | ${tx.buyer_name}`);
          await reconcileTransaction(tx, d);
          results.fixed++;
        } else if (st === 0 || st === -2) {
          console.log(`⏰ EXPIRED ${tx.id} | Rp ${tx.total_amount} | ${tx.buyer_name}`);
          results.expired++;
        } else {
          console.log(`❓ STATUS ${st} ${tx.id} | Rp ${tx.total_amount} | ${tx.buyer_name}`);
        }
      } else {
        console.log(`❌ NOT FOUND ${tx.id} | Rp ${tx.total_amount} | ${tx.buyer_name}`);
        results.notFound++;
      }
    } catch (e) {
      console.log(`❌ ERROR ${tx.id}: ${e.message}`);
      results.errors++;
    }

    await sleep(500);
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Fixed (-> paid): ${results.fixed}`);
  console.log(`Expired: ${results.expired}`);
  console.log(`Not found: ${results.notFound}`);
  console.log(`Errors: ${results.errors}`);
})();

async function reconcileTransaction(tx, ipaymuData) {
  const { data: fullTx } = await supabase
    .from('transactions')
    .select('*, transaction_items(*)')
    .eq('id', tx.id)
    .maybeSingle();

  if (!fullTx) { console.log(`  ⚠️ Transaction not found!`); return; }
  if (fullTx.status === 'paid') { console.log(`  Already paid, skipping`); return; }

  // 1. Update status to paid
  const { error: updateErr } = await supabase
    .from('transactions')
    .update({
      status: 'paid',
      payment_details: {
        ...(fullTx.payment_details || {}),
        ipaymu_trx_id: ipaymuData.TransactionId || tx.payment_details?.ipaymu_trx_id,
        ipaymu_session_id: ipaymuData.SessionId,
        ipaymu_status: ipaymuData.Status,
        ipaymu_reconciled: true,
        reconciled_at: new Date().toISOString(),
        reconciled_note: 'Auto-reconciliation: iPaymu callback never received (notifyUrl bug)',
      },
    })
    .eq('id', tx.id);

  if (updateErr) { console.error(`  ⚠️ Status error: ${updateErr.message}`); return; }
  console.log(`  Status → paid`);

  // 2. Deduct stock + audit trail (correct column names)
  for (const item of (fullTx.transaction_items || [])) {
    if (!item.seller_id) continue;

    const { data: product } = await supabase
      .from('products')
      .select('id, stock, name')
      .eq('id', item.product_id)
      .maybeSingle();

    if (!product) continue;

    const prevStock = product.stock || 0;
    const newStock = Math.max(0, prevStock - item.quantity);

    await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);
    await supabase.from('stock_adjustments').insert({
      product_id: item.product_id,
      user_id: tx.buyer_id || null,
      previous_stock: prevStock,
      new_stock: newStock,
      adjustment_type: 'sale',
      notes: `Auto-reconciliation: sale via iPaymu QRIS`,
      transaction_id: tx.id,
    });

    console.log(`  Stock: ${product.name} ${prevStock} → ${newStock}`);
  }

  // 3. Credit seller balances + audit trail (correct column names)
  for (const item of (fullTx.transaction_items || [])) {
    if (!item.seller_id) continue;

    const { data: seller } = await supabase
      .from('sellers')
      .select('id, balance, total_sales')
      .eq('id', item.seller_id)
      .maybeSingle();

    if (!seller) continue;

    const sellerEarning = Math.round(item.price * 0.92);
    const newBalance = (seller.balance || 0) + sellerEarning;
    const newSales = (seller.total_sales || 0) + sellerEarning;

    await supabase.from('sellers').update({
      balance: newBalance,
      total_sales: newSales,
    }).eq('id', item.seller_id);

    await supabase.from('seller_balance_adjustments').insert({
      seller_id: item.seller_id,
      transaction_id: tx.id,
      balance_delta: sellerEarning,
      sales_delta: sellerEarning,
      fee_delta: 0,
    });

    console.log(`  Seller: ${seller.balance} → ${newBalance} (+${sellerEarning})`);
  }

  // 4. Credit buyer points (profiles.loyalty_points + points_history)
  if (tx.buyer_id) {
    const pointsEarned = Math.floor(tx.total_amount * 0.008);
    if (pointsEarned > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, loyalty_points')
        .eq('id', tx.buyer_id)
        .maybeSingle();

      if (profile) {
        const newPoints = (profile.loyalty_points || 0) + pointsEarned;
        await supabase.from('profiles').update({ loyalty_points: newPoints }).eq('id', tx.buyer_id);
        await supabase.from('points_history').insert({
          user_id: tx.buyer_id,
          transaction_id: tx.id,
          points: pointsEarned,
          type: 'earned',
          description: `Pembayaran QRIS Rp ${tx.total_amount.toLocaleString()}`,
          earned_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });
        console.log(`  Points: +${pointsEarned}`);
      }
    }
  }

  // 5. Mark metadata
  await supabase
    .from('transactions')
    .update({
      metadata: {
        ...(fullTx.metadata || {}),
        stock_deducted: true,
        reconciled: true,
        points_added: true,
        reconciled_at: new Date().toISOString(),
      },
    })
    .eq('id', tx.id);

  console.log(`  DONE`);
}
