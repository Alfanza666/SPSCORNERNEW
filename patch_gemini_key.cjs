const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(serverPath, 'utf8');

// Replace the start of the verification logic to check for the API key
const searchStr = `    const prompt = \`
        Tolong verifikasi bukti transfer ini.`;

const replaceStr = `    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: "GEMINI_API_KEY tidak dikonfigurasi di backend (.env). Sistem verifikasi AI tidak dapat berjalan." });
    }
    const prompt = \`
        Tolong verifikasi bukti transfer ini.`;

if (content.includes(searchStr) && !content.includes('GEMINI_API_KEY tidak dikonfigurasi')) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('server.ts patched successfully.');
} else {
    console.log('server.ts already patched or string not found.');
}

// Append to .env if not exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('GEMINI_API_KEY')) {
        envContent += '\n# Gemini AI (Wajib untuk Verifikasi Struk Otomatis)\nGEMINI_API_KEY=\n';
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('.env patched successfully.');
    }
}
