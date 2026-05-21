const fs = require('fs');

let dashboard = fs.readFileSync('src/pages/dashboard/DashboardLayout.tsx', 'utf8');

// Fix wrong import of Globe
dashboard = dashboard.replace(
    /import \{ Globe, Outlet, Navigate, useNavigate, useLocation \} from 'react-router-dom';/g,
    "import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';"
);

// Add Globe to lucide-react import
if (!dashboard.includes('Globe,')) {
    dashboard = dashboard.replace(
        /import \{/m,
        'import { Globe,'
    );
}

fs.writeFileSync('src/pages/dashboard/DashboardLayout.tsx', dashboard, 'utf8');
console.log('Fixed Globe import');
