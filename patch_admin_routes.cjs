const fs = require('fs');

// Patch App.tsx
let appStr = fs.readFileSync('src/App.tsx', 'utf8');

// Add imports
if (!appStr.includes('AdminPengaduan')) {
    appStr = appStr.replace(
        /const AdminDoorprizeSpin = lazyWithRetry\(\(\) => import\('\.\/pages\/dashboard\/admin\/AdminDoorprizeSpin'\)\);/,
        `const AdminDoorprizeSpin = lazyWithRetry(() => import('./pages/dashboard/admin/AdminDoorprizeSpin'));
const AdminPengaduan = lazyWithRetry(() => import('./pages/dashboard/admin/AdminPengaduan'));
const AdminKritikSaran = lazyWithRetry(() => import('./pages/dashboard/admin/AdminKritikSaran'));`
    );

    // Add routes
    appStr = appStr.replace(
        /<Route path="doorprize" element=\{<AdminDoorprizeSpin \/>\} \/>/,
        `<Route path="doorprize" element={<AdminDoorprizeSpin />} />
            <Route path="pengaduan" element={<AdminPengaduan />} />
            <Route path="kritik" element={<AdminKritikSaran />} />`
    );
    fs.writeFileSync('src/App.tsx', appStr, 'utf8');
    console.log('App.tsx patched');
}

// Patch DashboardLayout.tsx
let dashStr = fs.readFileSync('src/pages/dashboard/DashboardLayout.tsx', 'utf8');

if (!dashStr.includes('AdminPengaduan')) {
    // Add to adminGroups
    dashStr = dashStr.replace(
        /\{ to: "\/dashboard\/admin\/forms", icon: ClipboardList, label: "Form Builder" \}/,
        `{ to: "/dashboard/admin/forms", icon: ClipboardList, label: "Form Builder" },
            { to: "/dashboard/admin/pengaduan", icon: ShieldCheck, label: "Pengaduan & Pembelaan" },
            { to: "/dashboard/admin/kritik", icon: MessageSquare, label: "Kritik & Saran" }`
    );
    
    // Check if MessageSquare is imported
    if (!dashStr.includes('MessageSquare,')) {
        dashStr = dashStr.replace(/import \{/, 'import { MessageSquare,');
    }
    
    // Fix default open for all NavGroups
    dashStr = dashStr.replace(
        /defaultOpen=\{menuSearchQuery \? true : gIdx < 2\}/g,
        `defaultOpen={true}`
    );
    
    fs.writeFileSync('src/pages/dashboard/DashboardLayout.tsx', dashStr, 'utf8');
    console.log('DashboardLayout.tsx patched');
}
