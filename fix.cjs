const fs = require('fs');
const content = fs.readFileSync('src/pages/kiosk/Checkout.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Request push notification permission')) {
    // replace 4 lines
    lines[i] = '    // We no longer automatically request Notification permission here.';
    lines[i+1] = '';
    lines[i+2] = '';
    lines[i+3] = '';
    break;
  }
}

fs.writeFileSync('src/pages/kiosk/Checkout.tsx', lines.join('\n'));
console.log('done');
