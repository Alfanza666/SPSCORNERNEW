const fs = require('fs');
let content = fs.readFileSync('vite-env.d.ts', 'utf8');
content = content.replace(/\\/g, '\\\\');
// Let's just restore vite-env.d.ts to default
fs.writeFileSync('vite-env.d.ts', '/// <reference types="vite/client" />\n/// <reference types="vite-plugin-pwa/client" />\n');
