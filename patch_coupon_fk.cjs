const fs = require('fs');
const path = require('path');

const dir = 'src/pages/dashboard/admin';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => path.join(dir, f));

let patchedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(
        /\.select\('([\s\S]*?)profiles\(([\s\S]*?)\)([\s\S]*?)'\)/g,
        (match, p1, p2, p3) => {
            // Check if it already has the fkey to avoid double patching
            if (p1.includes('program_coupons_user_id_fkey') || match.includes('program_coupons_user_id_fkey')) return match;
            return `.select('${p1}profiles!program_coupons_user_id_fkey(${p2})${p3}')`;
        }
    );

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Patched ${file}`);
        patchedCount++;
    }
}

console.log(`Total files patched: ${patchedCount}`);
