import CryptoJS from 'crypto-js';

const va = "1179001258281919";
const apikey = process.env.IPAYMU_API_KEY || "test-api-key";

const body = {
    "name":"Putu",
    "phone":"08123456789",
    "email": "putu@gmail.com",
    "amount": "10000",
    "comments":"Payment to XYZ Store",
    "notifyUrl":"https://your-website.com/callback-url",
    "referenceId":"1234",
    "paymentMethod":"va",
    "paymentChannel":"bca",
};

const jsonBody = JSON.stringify(body);
const bodyEncrypt = CryptoJS.SHA256(jsonBody).toString(CryptoJS.enc.Hex).toLowerCase();
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const stringtosign = va + ":" + bodyEncrypt + ":POST:" + timestamp;
const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(stringtosign, apikey));

console.log({
  jsonBody,
  bodyEncrypt,
  timestamp,
  stringtosign,
  signature
});
