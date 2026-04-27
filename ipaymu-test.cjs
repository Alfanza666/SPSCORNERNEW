require('dotenv').config();
const axios = require('axios');
const CryptoJS = require('crypto-js');

async function testIpaymu() {
  const VA = process.env.IPAYMU_VA || '';
  const API_KEY = process.env.IPAYMU_API_KEY || '';

  if (!VA || !API_KEY) {
    console.log("Error: IPAYMU_VA or IPAYMU_API_KEY is missing from .env");
    return;
  }

  const url = 'https://my.ipaymu.com/api/v2/payment/direct';

  const body = {
    name: "Tester",
    phone: "081234567890",
    email: "tester@gmail.com",
    amount: 10000,
    comments: "Test Direct Payment",
    notifyUrl: "https://spscorner.store/api/payment/ipaymu/callback",
    referenceId: "TEST-" + Date.now(),
    paymentMethod: "va",
    paymentChannel: "bca"
  };

  const jsonBody = JSON.stringify(body);
  const bodyEncrypt = CryptoJS.SHA256(jsonBody).toString(CryptoJS.enc.Hex).toLowerCase();
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const stringtosign = `${VA}:${bodyEncrypt}:POST:${timestamp}`;
  const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(stringtosign, API_KEY)).toLowerCase();

  console.log("=== IPAYMU DIRECT PAYMENT TEST ===");
  console.log("URL:", url);
  console.log("VA:", VA);
  console.log("API KEY Length:", API_KEY.length);
  console.log("Timestamp:", timestamp);
  console.log("JSON Body:", jsonBody);
  console.log("Signature:", signature);

  try {
    const res = await axios.post(url, jsonBody, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'va': VA,
        'signature': signature,
        'timestamp': timestamp
      }
    });
    console.log("\n=== SUCCESS ===");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log("\n=== ERROR ===");
    if (err.response) {
      console.log("Status:", err.response.status);
      console.log("Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.log(err.message);
    }
  }
}

testIpaymu();
