const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.ts');
let content = fs.readFileSync(serverPath, 'utf8');

const regex = /const geminiResponse = await ai\.models\.generateContent\(\{/;
const replacement = `if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: "GEMINI_API_KEY tidak dikonfigurasi di backend (.env). Sistem verifikasi AI tidak dapat berjalan." });
    }
    const geminiResponse = await ai.models.generateContent({`;

if (!content.includes('GEMINI_API_KEY tidak dikonfigurasi')) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('server.ts patched successfully.');
} else {
    console.log('server.ts already patched or string not found.');
}
