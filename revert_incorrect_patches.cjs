const fs = require('fs');

const filesToRevert = [
    'src/pages/dashboard/admin/AdminAnnouncements.tsx',
    'src/pages/dashboard/admin/AdminFeedbacks.tsx',
    'src/pages/dashboard/admin/AdminFlashsale.tsx',
    'src/pages/dashboard/admin/AdminProducts.tsx',
    'src/pages/dashboard/admin/AdminWithdrawals.tsx'
];

for (const file of filesToRevert) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/profiles!program_coupons_user_id_fkey/g, 'profiles');
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Reverted ${file}`);
}
