const fs = require('fs');

function patchFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    let originalLength = content.length;
    for (const r of replacements) {
        if (!content.includes(r.search)) {
            console.warn(`WARNING: Could not find search string in ${path}:`, r.search.substring(0, 50) + '...');
        } else {
            content = content.replace(r.search, r.replace);
        }
    }
    if (content.length !== originalLength) {
        fs.writeFileSync(path, content, 'utf8');
        console.log(`Patched ${path} successfully!`);
    } else {
        console.log(`Failed to patch ${path}: No changes made.`);
    }
}

// AdminUnionPrograms.tsx
patchFile('src/pages/dashboard/admin/AdminUnionPrograms.tsx', [
    {
        search: "        toast.success('Program berhasil dibuat');\n      }",
        replace: "        toast.success('Program berhasil dibuat');\n        if (programData.is_active) {\n            fetch('/api/admin/programs/notify', {\n                method: 'POST',\n                headers: { 'Content-Type': 'application/json' },\n                body: JSON.stringify({ program_id: programId, title: programData.name })\n            }).catch(console.error);\n        }\n      }"
    },
    {
        search: "      toast.success(`Program ${!program.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);\n      fetchPrograms();",
        replace: "      const newStatus = !program.is_active;\n      toast.success(`Program ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`);\n      if (newStatus) {\n          fetch('/api/admin/programs/notify', {\n              method: 'POST',\n              headers: { 'Content-Type': 'application/json' },\n              body: JSON.stringify({ program_id: program.id, title: program.name })\n          }).catch(console.error);\n      }\n      fetchPrograms();"
    }
]);

// SellerPreOrders.tsx
patchFile('src/pages/dashboard/seller/SellerPreOrders.tsx', [
    {
        search: "      if (newStatus === 'ready') updateData.ready_at = new Date().toISOString();\n      if (newStatus === 'picked_up') updateData.picked_up_at = new Date().toISOString();\n      const { error } = await supabase.from('pre_orders').update(updateData).eq('id', orderId);\n      if (error) throw error;\n      toast.success(`Status diubah ke: ${STATUS_LABELS[newStatus]}`);",
        replace: "      if (newStatus === 'ready') {\n          updateData.ready_at = new Date().toISOString();\n          const order = preOrders.find(o => o.id === orderId);\n          if (order) {\n              fetch('/api/pre-orders/notify-ready', {\n                  method: 'POST',\n                  headers: { 'Content-Type': 'application/json' },\n                  body: JSON.stringify({ order_id: orderId, buyer_id: order.buyer_id, buyer_name: order.buyer_name })\n              }).catch(console.error);\n          }\n      }\n      if (newStatus === 'picked_up') updateData.picked_up_at = new Date().toISOString();\n      const { error } = await supabase.from('pre_orders').update(updateData).eq('id', orderId);\n      if (error) throw error;\n      toast.success(`Status diubah ke: ${STATUS_LABELS[newStatus]}`);"
    }
]);
