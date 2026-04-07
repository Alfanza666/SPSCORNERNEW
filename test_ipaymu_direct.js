import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';

const va = process.env.IPAYMU_VA || '';
const apikey = process.env.IPAYMU_API_KEY || '';
const url = 'https://sandbox.ipaymu.com/api/v2/payment/direct';

const body = {
    "name": "Putu",
    "phone": "08123456789",
    "email": "putu@gmail.com",
    "amount": "10000",
    "comments": "Payment to XYZ Store",
    "notifyUrl": "https://your-website.com/callback-url",
    "referenceId": "1234",
    "paymentMethod": "va",
    "paymentChannel": "bca"
};

const jsonBody = JSON.stringify(body);
const bodyEncrypt = CryptoJS.SHA256(jsonBody).toString(CryptoJS.enc.Hex).toLowerCase();
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const stringtosign = va + ":" + bodyEncrypt + ":POST:" + timestamp;
const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(stringtosign, apikey)).toLowerCase();

console.log('Sending request to:', url);
console.log('Headers:', {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    va: va,
    signature: signature,
    timestamp: timestamp
});
console.log('Body:', jsonBody);

fetch(url, {
    method: "POST",
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        va: va,
        signature: signature,
        timestamp: timestamp
    },
    body: jsonBody
})
.then(res => res.text())
.then(text => {
    console.log('Response:', text);
})
.catch(err => {
    console.error('Error:', err);
});
