const fs = require('fs');

function addAdminNotify(file, path, typeName) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if we already patched it
    if (content.includes('notifyAdmins')) return;

    // We need to inject code after successful insert to `feedbacks`
    const notifyCode = `
      // notifyAdmins
      try {
        const { data: admins } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin']);
        if (admins) {
            const notifications = admins.map(admin => ({
                user_id: admin.id,
                title: '${typeName} Baru',
                message: \`Terdapat ${typeName.toLowerCase()} baru dari \${user.name}\`,
                type: 'system',
                path: '${path}'
            }));
            await supabase.from('notifications').insert(notifications);
        }
      } catch (e) { console.error('Gagal mengirim notif admin', e); }
      // end notifyAdmins
`;

    content = content.replace(
        /toast\.success\('.*?dikirim'\);/,
        match => `${notifyCode}\n      ${match}`
    );
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Patched ${file}`);
}

addAdminNotify('src/pages/portal/PortalPengaduan.tsx', '/dashboard/admin/pengaduan', 'Pengaduan');
addAdminNotify('src/pages/portal/PortalKritik.tsx', '/dashboard/admin/kritik', 'Kritik & Saran');
