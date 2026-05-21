const fs = require('fs');

let portal = fs.readFileSync('src/pages/dashboard/PortalLayout.tsx', 'utf8');

if (!portal.includes('Kembali ke Kiosk')) {
    portal = portal.replace(
        /Dashboard Seller[\s\S]*?<\/button>\s*\)}/m,
        match => `${match}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                onClick={() => navigate('/kiosk')}
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                  <Home className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                </div>
                Kembali ke Kiosk
              </button>`
    );
    // Also patch mobile nav
    portal = portal.replace(
        /<div className="space-y-1\.5 focus:outline-none">/m,
        match => `${match}
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                          onClick={() => { navigate('/kiosk'); setIsSidebarOpen(false); }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                            <Home className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                          </div>
                          Kembali ke Kiosk
                        </button>`
    );
    fs.writeFileSync('src/pages/dashboard/PortalLayout.tsx', portal, 'utf8');
    console.log('Patched PortalLayout.tsx');
}

let dashboard = fs.readFileSync('src/pages/dashboard/DashboardLayout.tsx', 'utf8');

if (!dashboard.includes('Akses Portal')) {
    dashboard = dashboard.replace(/import \{/m, 'import { Globe,');
    
    // Replace in desktop
    dashboard = dashboard.replace(
        /<div className="space-y-2 tour-seller-sidebar-kiosk">/m,
        match => `${match}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group"
                onClick={() => navigate('/portal')}
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                  <Globe className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                </div>
                Akses Portal
              </button>`
    );
    
    // Replace in mobile
    dashboard = dashboard.replace(
        /onClick=\{\(\) => \{ navigate\('\/kiosk'\); setIsSidebarOpen\(false\); \}\}/m,
        match => `onClick={() => { navigate('/portal'); setIsSidebarOpen(false); }}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center group-hover:scale-110 transition-all">
                            <Globe className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white" />
                          </div>
                          Akses Portal
                        </button>
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all group focus:outline-none"
                          ${match}`
    );
    
    fs.writeFileSync('src/pages/dashboard/DashboardLayout.tsx', dashboard, 'utf8');
    console.log('Patched DashboardLayout.tsx');
}
