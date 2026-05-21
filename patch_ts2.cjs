const fs = require('fs');

// 1. Fix sw.ts
let sw = fs.readFileSync('src/sw.ts', 'utf8');
sw = sw.replace(
  /self\.registration\.showNotification\(([^,]+),\s*\{([\s\S]*?)\}\s*\)/g,
  'self.registration.showNotification($1, { $2 } as any)'
);
fs.writeFileSync('src/sw.ts', sw);

// 2. Fix vite.config.ts
let vite = fs.readFileSync('vite.config.ts', 'utf8');
vite = vite.replace(/permissions:\s*\[[\s\S]*?\],/g, '');
fs.writeFileSync('vite.config.ts', vite);

console.log('Fixed sw.ts and vite.config.ts');
