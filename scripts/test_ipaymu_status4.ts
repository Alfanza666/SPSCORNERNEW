import { config } from 'dotenv';
config();
import { IpaymuClient } from '../src/services/ipaymu/client.js';

const isProd = process.env.IPAYMU_PRODUCTION === 'true';
// Note: we inject the fixie url to the client to bypass 406
const client = new IpaymuClient(process.env.IPAYMU_VA || '', process.env.IPAYMU_API_KEY || '', isProd, {}, process.env.FIXIE_URL);

async function check() {
  // Try overriding the getTransactionStatus method just for this test
  client.getTransactionStatus = async function(transactionId: string) {
    const { IpaymuSignature } = await import('../src/services/ipaymu/signature.js');
    const body = { transactionId: transactionId };
    const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
      this.va,
      body,
      'POST',
      this.apiKey
    );
    try {
      const response = await this.axiosInstance.post(`${this.baseUrl}/transaction`, JSON.parse(jsonBody), {
        ...this.axiosConfig,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
          'timestamp': timestamp,
        }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Status Check Error: ${error.response?.data?.Message || error.message}`);
    }
  };

  try {
    const res = await client.getTransactionStatus('36601704');
    console.log("By iPaymu TX ID:", JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.error("By iPaymu TX ID error:", e?.response?.data || e.message);
  }
}

check();
