#!/usr/bin/env node
/**
 * iPaymu History-Based QRIS Reconciliation
 * 
 * Strategy: Pull ALL paid transactions from iPaymu history, cross-ref with DB.
 * If iPaymu says PAID but DB says FAILED → fix it.
 * 
 * Usage: node scripts/reconcile-history.cjs [--dry-run] [--days 14]
 */

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const daysIdx = args.indexOf('--days');
const DAYS = daysIdx !== -1 ? parseInt(args[daysIdx + 1]) || 14 : 14;

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

console.log(`\n=== iPaymu History Reconciliation ===`);
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE'}`);
console.log(`Period: last ${DAYS} days`);
console.log(`VA: ${VA ? VA.slice(0, 8) + '...' : 'MISSING'}`);
console.log(`API_KEY: ${API_KEY ? API_KEY.slice(0, 8) + '...' : 'MISSING'}\n`);

function generateSignature(jsonBody) {
  const bodyHash = crypto.createHash('sha256').update(jsonBody).digest('hex').toLowerCase();
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const stringToSign = `POST:${VA}:${bodyHash}:${API_KEY}`;
  const signature = crypto.createHmac('sha256', API_KEY).update(stringToSign).digest('hex').toLowerCase();
  return { signature, timestamp };
}

function ipaymuRequest(path, body) {
  return new Promise((resolve, reject) => {
    const jsonBody = JSON.stringify(body);
    const { signature, timestamp } = generateSignature(jsonBody);
    const options = {
      hostname: 'my.ipaymu.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'va': VA,
        'signature': signature,
        'timestamp': timestamp,
        'Content-Length': Buffer.byteLength(jsonBody),
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
    req.write(jsonBody);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const startDate = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);

  console.log(`Fetching iPaymu history: ${startDate} to ${endDate}\n`);

  // Fetch paid transactions (status=1 = success) from iPaymu
  let allPaidTx = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const resp = await ipaymuRequest('/api/v2/history', {
      status: '1',
      date: 'created_at',
      startdate: startDate,
      enddate: endDate,
      limit: 20,
      page: page,
      orderBy: 'id',
      order: 'DESC',
    });

    if (resp.Status === 200 && resp.Data) {
      const results = resp.Data.Transaction || resp.Data.Results || [];
      allPaidTx = allPaidTx.concat(results);
      console.log(`  Page ${page}: ${results.length} transactions (total so far: ${allPaidTx.length})`);
      hasMore = results.length === 20;
      page++;
      await sleep(500);
    } else {
      console.log(`  Error or no data on page ${page}:`, resp.Message || resp.raw || JSON.stringify(resp));
      hasMore = false;
    }
  }

  // Also fetch status=6 (success unsettled)
  page = 1;
  hasMore = true;
  while (hasMore) {
    const resp = await ipaymuRequest('/api/v2/history', {
      status: '6',
      date: 'created_at',
      startdate: startDate,
      enddate: endDate,
      limit: 20,
      page: page,
      orderBy: 'id',
      order: 'DESC',
    });

    if (resp.Status === 200 && resp.Data) {
      const results = resp.Data.Transaction || resp.Data.Results || [];
      allPaidTx = allPaidTx.concat(results);
      console.log(`  Page ${page} (unsettled): ${results.length} transactions (total so far: ${allPaidTx.length})`);
      hasMore = results.length === 20;
      page++;
      await sleep(500);
    } else {
      hasMore = false;
    }
  }

  console.log(`\nTotal paid transactions from iPaymu: ${allPaidTx.length}\n`);

  // Build lookup map: referenceId → iPaymu data
  const ipaymuByRef = {};
  for (const tx of allPaidTx) {
    if (tx.ReferenceId) ipaymuByRef[String(tx.ReferenceId)] = tx;
  }

  // Fetch failed transactions from DB
  const sevenDaysAgo = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: failedTx, error } = await supabase
    .from('transactions')
    .select('id, status, total_amount, created_at, buyer_name, buyer_id, payment_details, payment_method, metadata')
    .eq('status', 'failed')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) { console.error('DB Error:', error); return; }

  const qrisFailed = (failedTx || []).filter(t =>
    t.payment_method?.toLowerCase().includes('ipaymu') ||
    t.payment_method?.toLowerCase().includes('qris') ||
    t.payment_method === 'qris'
  );

  console.log(`Failed iPaymu/QRIS transactions in DB: ${qrisFailed.length}\n`);

  const results = { fixed: 0, expired: 0, alreadyPaid: 0, notFound: 0, errors: 0 };

  for (const tx of qrisFailed) {
    // Try matching by referenceId (our transaction ID)
    const ipaymuTx = ipaymuByRef[tx.id];

    // Also try matching by ipaymu_trx_id
    let ipaymuTxAlt = null;
    if (!ipaymuTx && tx.payment_details?.ipaymu_trx_id) {
      ipaymuTxAlt = allPaidTx.find(t => String(t.TransactionId) === String(tx.payment_details.ipaymu_trx_id));
    }

    const match = ipaymuTx || ipaymuTxAlt;

    if (match) {
      console.log(`✅ MISMATCH: DB "${tx.id}" is FAILED but iPaymu says PAID (Status ${match.Status})`);
      console.log(`   Amount: Rp ${tx.total_amount} | Buyer: ${tx.buyer_name} | iPaymu Ref: ${match.ReferenceId}`);

      if (!DRY_RUN) {
        try {
          await reconcileTransaction(tx, match);
          results.fixed++;
        } catch (e) {
          console.log(`   ❌ Error: ${e.message}`);
          results.errors++;
        }
      } else {
        console.log(`   [DRY RUN] Would fix this transaction`);
        results.fixed++;
      }
    } else {
      // Not found in iPaymu paid history — likely truly expired/failed
      const lookupId = tx.payment_details?.ipaymu_trx_id || tx.id;
      try {
        const resp = await ipaymuRequest('/api/v2/transaction', { transactionId: lookupId, account: VA });
        if (resp.Status === 200 && resp.Data) {
          const st = resp.Data.Status;
          if (st === 1 || st === 6 || st === 7) {
            console.log(`✅ LOOKUP MISMATCH: DB "${tx.id}" is FAILED but iPaymu lookup says Status ${st}`);
            if (!DRY_RUN) {
              await reconcileTransaction(tx, resp.Data);
              results.fixed++;
            } else {
              results.fixed++;
            }
          } else if (st === 0 || st === -2) {
            console.log(`⏰ EXPIRED: ${tx.id} (iPaymu Status ${st})`);
            results.expired++;
          } else {
            console.log(`❓ STATUS ${st}: ${tx.id}`);
          }
        } else {
          console.log(`❌ NOT FOUND: ${tx.id}`);
          results.notFound++;
        }
      } catch (e) {
        console.log(`❌ ERROR: ${tx.id}: ${e.message}`);
        results.errors++;
      }
      await sleep(500);
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Fixed (-> paid): ${results.fixed}`);
  console.log(`Expired (kept): ${results.expired}`);
  console.log(`Not found: ${results.notFound}`);
  console.log(`Errors: ${results.errors}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);
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
        reconciled_note: 'History-based reconciliation: iPaymu callback never received',
      },
    })
    .eq('id', tx.id);

  if (updateErr) { console.error(`  ⚠️ Status error: ${updateErr.message}`); return; }
  console.log(`  Status → paid`);

  // 2. Deduct stock + audit trail
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
      notes: `History reconciliation: sale via iPaymu QRIS`,
      transaction_id: tx.id,
    });

    console.log(`  Stock: ${product.name} ${prevStock} → ${newStock}`);
  }

  // 3. Credit seller balances + audit trail (8% fee = 92% to seller)
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

  // 4. Credit buyer points (0.8%)
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
          description: `History reconciliation: QRIS Rp ${tx.total_amount.toLocaleString()}`,
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
