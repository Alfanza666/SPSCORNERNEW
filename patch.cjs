const fs = require('fs');

function patchFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    let originalLength = content.length;
    for (const r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    if (content.length !== originalLength) {
        fs.writeFileSync(path, content, 'utf8');
        console.log(`Patched ${path} successfully!`);
    } else {
        console.log(`Failed to patch ${path}: No changes made.`);
    }
}

patchFile('src/App.tsx', [
    {
        search: /const AdminFormResponses = lazyWithRetry\(\(\) => import\('\.\/pages\/dashboard\/admin\/AdminFormResponses'\)\);/,
        replace: `const AdminFormResponses = lazyWithRetry(() => import('./pages/dashboard/admin/AdminFormResponses'));\nconst AdminCouponReports = lazyWithRetry(() => import('./pages/dashboard/admin/AdminCouponReports'));`
    },
    {
        search: /<Route path="admin\/forms\/responses\/:formId" element=\{<AdminFormResponses \/>\} \/>/,
        replace: `<Route path="admin/forms/responses/:formId" element={<AdminFormResponses />} />\n              <Route path="admin/coupon-reports" element={<AdminCouponReports />} />\n              <Route path="admin/coupon-reports/" element={<AdminCouponReports />} />`
    }
]);

patchFile('src/pages/dashboard/DashboardLayout.tsx', [
    {
        search: /import \{[\s\S]*?Bug,[\s\S]*?\} from 'lucide-react';/,
        replace: (match) => {
            if (!match.includes('ClipboardList')) {
                return match.replace('Bug,', 'Bug, ClipboardList,');
            }
            return match;
        }
    },
    {
        search: /\{ to: "\/dashboard\/admin\/reports", icon: Bug, label: "Laporan & Bug", badge: unreadCount > 0 \? unreadCount : undefined \},/,
        replace: `{ to: "/dashboard/admin/reports", icon: Bug, label: "Laporan & Bug", badge: unreadCount > 0 ? unreadCount : undefined },\n          { to: "/dashboard/admin/coupon-reports", icon: ClipboardList, label: "Laporan Kupon" },`
    }
]);
