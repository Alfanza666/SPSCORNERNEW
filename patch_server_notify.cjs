const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// 1. manual QRIS verify: uniqueSellers logic
content = content.replace(
    /const uniqueSellers = \[\s*\.\.\.new Set\(transaction\.transaction_items\.map\(\(item\) => item\.seller_id\)\),\s*\];\s*for \(const sellerId of uniqueSellers\) \{\s*if \(sellerId\) \{\s*await sendNotification\(sellerId, \{\s*type: "transaction",\s*title: "(?:[^\"]+)",\s*message: `Ada pesanan baru #[^\`]+`,\s*path: `\/dashboard\/seller\/transactions\?id=\$\{transaction_id\}`,\s*\}\);\s*\}\s*\}/,
    `const uniqueSellers = [...new Set(transaction.transaction_items.map((item) => item.seller_id))];
    let hasKoperasi = false;
    for (const sellerId of uniqueSellers) {
      if (sellerId) {
        await sendNotification(sellerId, {
          type: "transaction",
          title: "💰 Pesanan Baru Masuk!",
          message: \`Ada pesanan baru #\${transaction_id.slice(0, 8)} dari \${transaction.buyer_name} yang perlu Anda proses.\`,
          path: \`/dashboard/seller/transactions?id=\${transaction_id}\`,
        });
      } else {
        hasKoperasi = true;
      }
    }
    if (hasKoperasi) {
      const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin']);
      if (admins) {
        for (const admin of admins) {
          await sendNotification(admin.id, {
            type: 'transaction',
            title: '🛒 Pesanan Koperasi Baru',
            message: \`Ada pesanan baru #\${transaction_id.slice(0, 8)} dari \${transaction.buyer_name}.\`,
            path: \`/dashboard/admin/transactions?id=\${transaction_id}\`
          });
        }
      }
    }`
);

// 2. iPaymu callback: buyer notification + add seller & admin logic
content = content.replace(
    /if \(transaction\.buyer_id\) \{\s*await sendNotification\(transaction\.buyer_id, \{\s*type: "transaction",\s*title: "(?:[^\"]+)",\s*message: `Transaksi #[^\`]+`,\s*path: `\/kiosk\/history\?id=\$\{refId\}`,\s*\}\);\s*\}/,
    `if (transaction.buyer_id) {
        await sendNotification(transaction.buyer_id, {
          type: "transaction",
          title: "✅ Pembayaran Berhasil!",
          message: \`Transaksi #\${refId.slice(0, 8)} sebesar Rp \${Number(transaction.total_amount).toLocaleString("id-ID")} telah dikonfirmasi.\`,
          path: \`/kiosk/history?id=\${refId}\`,
        });
      }
      
      const uniqueSellers = [...new Set(transaction.transaction_items.map((item) => item.seller_id))];
      let hasKoperasi = false;
      for (const sellerId of uniqueSellers) {
        if (sellerId) {
          await sendNotification(sellerId, {
            type: 'transaction',
            title: '💰 Pesanan Baru Masuk!',
            message: \`Ada pesanan baru #\${refId.slice(0, 8)} dari \${transaction.buyer_name} yang perlu Anda proses.\`,
            path: \`/dashboard/seller/transactions?id=\${refId}\`,
          });
        } else {
          hasKoperasi = true;
        }
      }
      
      if (hasKoperasi) {
        const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin']);
        if (admins) {
          for (const admin of admins) {
            await sendNotification(admin.id, {
              type: 'transaction',
              title: '🛒 Pesanan Koperasi Baru',
              message: \`Ada pesanan baru #\${refId.slice(0, 8)} dari \${transaction.buyer_name}.\`,
              path: \`/dashboard/admin/transactions?id=\${refId}\`
            });
          }
        }
      }`
);

// 3. New Endpoints before app.listen
content = content.replace(
    /app\.listen\(port, \(\) => \{/g,
    `app.post('/api/admin/programs/notify', async (req, res) => {
  try {
    const { program_id, title } = req.body;
    const { data: users } = await supabase.from('profiles').select('id');
    if (users) {
      const userIds = users.map(u => u.id);
      await Promise.allSettled(userIds.map(id => sendNotification(id, {
        type: 'system',
        title: '📣 Program Kerja Baru!',
        message: \`Program kerja "\${title}" telah dirilis. Segera cek detailnya!\`,
        path: \`/union\`
      })));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pre-orders/notify-ready', async (req, res) => {
  try {
    const { order_id, buyer_id, buyer_name } = req.body;
    if (buyer_id) {
      await sendNotification(buyer_id, {
        type: 'transaction',
        title: '📦 Pesanan PO Siap Diambil!',
        message: \`Pesanan PO Anda atas nama \${buyer_name} sudah siap diambil. Silakan cek detailnya.\`,
        path: \`/\`
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {`
);

fs.writeFileSync('server.ts', content, 'utf8');
console.log('Regex patch applied!');
