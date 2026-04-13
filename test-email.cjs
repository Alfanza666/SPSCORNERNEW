const nodemailer = require('nodemailer');
require('dotenv').config();

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

console.log("User:", GMAIL_USER);
console.log("Pass exists:", !!GMAIL_APP_PASSWORD);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

transporter.sendMail({
  from: `"SPS Corner" <${GMAIL_USER}>`,
  to: 'alfanza26@gmail.com',
  subject: 'Test email',
  html: 'Hello world'
}).then(info => console.log('Success:', info.messageId))
  .catch(err => console.error('Error:', err));
