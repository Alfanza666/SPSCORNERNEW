import { config } from 'dotenv';
config();
import axios from 'axios';
import { IpaymuSignature } from '../src/services/ipaymu/signature.js';

const isProd = process.env.IPAYMU_PRODUCTION === 'true';
const baseUrl = isProd ? 'https://my.ipaymu.com/api/v2' : 'https://sandbox.ipaymu.com/api/v2';
const va = process.env.IPAYMU_VA || '';
const apiKey = process.env.IPAYMU_API_KEY || '';

const axiosInstance = axios.create({});
axiosInstance.interceptors.response.use(
  (response: any) => response,
  async (error: any) => {
    const originalRequest = error.config;
    if (!originalRequest._retry && process.env.FIXIE_URL) {
      originalRequest._retry = true;
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      originalRequest.httpsAgent = new HttpsProxyAgent(process.env.FIXIE_URL);
      originalRequest.proxy = false;
      return axiosInstance(originalRequest);
    }
    return Promise.reject(error);
  }
);

async function check() {
  const body = { transactionId: "36601704" };
  const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
    va, body, 'POST', apiKey
  );
  try {
    const response = await axiosInstance.post(`${baseUrl}/transaction`, JSON.parse(jsonBody), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'va': va,
        'signature': signature,
        'timestamp': timestamp,
      }
    });
    console.log("By iPaymu TX ID:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("By iPaymu TX ID error:", error.response?.data || error.message);
  }
}

check();
