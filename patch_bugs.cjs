const fs = require('fs');

// 1. Fix RefundPolicy.tsx
let refundPolicy = fs.readFileSync('src/pages/RefundPolicy.tsx', 'utf8');
refundPolicy = refundPolicy.replace(/\.single\(\);/g, '.maybeSingle();');
fs.writeFileSync('src/pages/RefundPolicy.tsx', refundPolicy);

// 2. Fix AdminFeedbacks.tsx
let adminFeedbacks = fs.readFileSync('src/pages/dashboard/admin/AdminFeedbacks.tsx', 'utf8');
adminFeedbacks = adminFeedbacks.replace(/\.select\('\*, profiles\(name, nik\)'\)/g, ".select('*, profiles!feedbacks_user_id_fkey(name, nik)')");
fs.writeFileSync('src/pages/dashboard/admin/AdminFeedbacks.tsx', adminFeedbacks);

// 3. Add routes to App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
const feedbacksRoute = '<Route path="admin/feedbacks/" element={<AdminFeedbacks />} />';
const newRoutes = `
              <Route path="admin/feedbacks/" element={<AdminFeedbacks />} />
              <Route path="admin/pengaduan" element={<AdminPengaduan />} />
              <Route path="admin/pengaduan/" element={<AdminPengaduan />} />
              <Route path="admin/kritik-saran" element={<AdminKritikSaran />} />
              <Route path="admin/kritik-saran/" element={<AdminKritikSaran />} />`;
app = app.replace(feedbacksRoute, newRoutes);
fs.writeFileSync('src/App.tsx', app);

console.log('Fixed bugs and added routes.');
