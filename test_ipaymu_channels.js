import fetch from 'node-fetch';
import CryptoJS from 'crypto-js';

const va = process.env.IPAYMU_VA || '';
const apikey = process.env.IPAYMU_API_KEY || '';
const url = 'https://my.ipaymu.com/api/v2/payment-channels';

const body = {};

const jsonBody = JSON.stringify(body);
const bodyEncrypt = CryptoJS.SHA256(jsonBody).toString(CryptoJS.enc.Hex).toLowerCase();
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const stringtosign = va + ":" + bodyEncrypt + ":GET:" + timestamp;
const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(stringtosign, apikey)).toLowerCase();

console.log('Sending request to:', url);

fetch(url, {
    method: "GET",
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        va: va,
        signature: signature,
        timestamp: timestamp
    }
})
.then(res => res.text())
.then(text => {
    console.log('Response:', text);
})
.catch(err => {
    console.error('Error:', err);
});
