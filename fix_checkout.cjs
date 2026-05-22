const fs = require('fs');
const path = 'src/pages/kiosk/Checkout.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `    // Request push notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }`;

const replaceStr = `    // We no longer automatically request Notification permission here.`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replaceStr);
  fs.writeFileSync(path, content);
  console.log('Successfully patched Checkout.tsx');
} else {
  console.log('Target string not found!');
}
