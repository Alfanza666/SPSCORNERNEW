// simple test just to see if syntax error or any obvious issues
import { spawnSync } from 'child_process';
const result = spawnSync('npx', ['tsc', '--noEmit', '--skipLibCheck'], { stdio: 'pipe', encoding: 'utf-8' });
if (result.stdout.includes('PortalLelang.tsx') || result.stderr.includes('PortalLelang.tsx')) {
    console.error("TypeScript Error in PortalLelang.tsx:");
    console.error(result.stdout || result.stderr);
    process.exit(1);
}
console.log("No TypeScript errors in PortalLelang.tsx");
