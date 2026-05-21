const fs = require('fs');

let unionPrograms = fs.readFileSync('src/pages/dashboard/admin/AdminUnionPrograms.tsx', 'utf8');

unionPrograms = unionPrograms.replace(
    /toast\.success\('Program berhasil dibuat'\);\s*\}/,
    `toast.success('Program berhasil dibuat');
        if (programData.is_active) {
            fetch('/api/admin/programs/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ program_id: programId, title: programData.name })
            }).catch(console.error);
        }
      }`
);

unionPrograms = unionPrograms.replace(
    /toast\.success\(`Program \$\{!program\.is_active \? 'diaktifkan' : 'dinonaktifkan'\}`\);\s*fetchPrograms\(\);/,
    `const newStatus = !program.is_active;
      toast.success(\`Program \${newStatus ? 'diaktifkan' : 'dinonaktifkan'}\`);
      if (newStatus) {
          fetch('/api/admin/programs/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ program_id: program.id, title: program.name })
          }).catch(console.error);
      }
      fetchPrograms();`
);

fs.writeFileSync('src/pages/dashboard/admin/AdminUnionPrograms.tsx', unionPrograms, 'utf8');
console.log('AdminUnionPrograms patched');

let sellerPO = fs.readFileSync('src/pages/dashboard/seller/SellerPreOrders.tsx', 'utf8');
sellerPO = sellerPO.replace(
    /if \(newStatus === 'ready'\) updateData\.ready_at = new Date\(\)\.toISOString\(\);/,
    `if (newStatus === 'ready') {
        updateData.ready_at = new Date().toISOString();
        const order = preOrders.find((o: any) => o.id === orderId);
        if (order) {
            fetch('/api/pre-orders/notify-ready', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, buyer_id: order.buyer_id, buyer_name: order.buyer_name })
            }).catch(console.error);
        }
      }`
);
fs.writeFileSync('src/pages/dashboard/seller/SellerPreOrders.tsx', sellerPO, 'utf8');
console.log('SellerPreOrders patched');
