import { IpaymuSignature } from './signature.js';
import axios from 'axios';

export interface RedirectPaymentData {
  product?: string[];
  qty?: string[] | number[];
  price?: string[] | number[];
  amount: string | number;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  referenceId: string;
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
}

export interface DirectPaymentData {
  name: string;
  phone: string;
  email: string;
  amount: string | number;
  comments?: string;
  notifyUrl: string;
  referenceId: string;
  paymentMethod: string;
  paymentChannel: string;
}

export interface IpaymuResponse {
  Status: number;
  Message: string;
  Data?: {
    Url?: string;
    SessionId?: string;
    TransactionId?: string;
    QrCode?: string;
  };
}

export class IpaymuClient {
  private va: string;
  private apiKey: string;
  private baseUrl: string;
  private axiosConfig: any;

  constructor(va: string, apiKey: string, production: boolean = false, axiosConfig: any = {}) {
    this.va = va.trim();
    this.apiKey = apiKey.trim();
    this.baseUrl = production
      ? 'https://my.ipaymu.com/api/v2'
      : 'https://sandbox.ipaymu.com/api/v2';
    this.axiosConfig = axiosConfig;
      
    const logMsg = `\n=== IPAYMU CLIENT INITIALIZED ===\nMode: ${production ? 'PRODUCTION' : 'SANDBOX'}\nBase URL: ${this.baseUrl}\nVA: ${this.va}\nAPI Key Length: ${this.apiKey.length}\nRaw IPAYMU_PRODUCTION env: ${process.env.IPAYMU_PRODUCTION}\n=================================\n`;
    console.log(logMsg);
  }

  /**
   * Create Redirect Payment
   * User akan diarahkan ke payment page Ipaymu
   */
  async createPayment(data: RedirectPaymentData): Promise<IpaymuResponse> {
    const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
      this.va,
      data,
      'POST',
      this.apiKey
    );

    try {
      console.log('📤 Sending payment request to Ipaymu...');
      const response = await axios.post(`${this.baseUrl}/payment`, jsonBody, {
        ...this.axiosConfig,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
          'timestamp': timestamp,
        }
      });

      const responseData = response.data;

      if (responseData.Status === 200) {
        console.log('✅ Payment request successful');
        return responseData;
      } else {
        throw new Error(responseData.Message || 'Payment creation failed');
      }
    } catch (error: any) {
      console.error('❌ Payment Error:', error.response?.data || error.message);
      let errMsg = error.response?.data?.Message || error.response?.data?.message || error.message;
      if (error.response?.status === 401 || errMsg?.toLowerCase().includes('unauthorized')) {
        errMsg = "Konfigurasi IPaymu belum sesuai atau Sandbox/Production tertukar. Silakan hubungi Admin.";
      }
      throw new Error(`Gagal memproses pembayaran IPaymu: ${errMsg}`);
    }
  }

  /**
   * Create Direct Payment
   * Payment langsung tanpa redirect ke Ipaymu
   */
  async createDirectPayment(data: DirectPaymentData): Promise<IpaymuResponse> {
    const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
      this.va,
      data,
      'POST',
      this.apiKey
    );

    try {
      console.log('📤 Sending direct payment request...');
      const response = await axios.post(`${this.baseUrl}/payment/direct`, jsonBody, {
        ...this.axiosConfig,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
          'timestamp': timestamp,
        }
      });

      const responseData = response.data;

      if (responseData.Status === 200) {
        console.log('✅ Direct payment request successful');
        return responseData;
      } else {
        throw new Error(responseData.Message || 'Direct payment failed');
      }
    } catch (error: any) {
      console.error('❌ Direct Payment Error:', error.response?.data || error.message);
      let errMsg = error.response?.data?.Message || error.response?.data?.message || error.message;
      if (error.response?.status === 401 || errMsg?.toLowerCase().includes('unauthorized')) {
        errMsg = "Konfigurasi IPaymu API belum sesuai atau Sandbox/Production tertukar. Hubungi Admin.";
      }
      throw new Error(`Gagal memproses pembayaran IPaymu: ${errMsg}`);
    }
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(referenceId: string): Promise<any> {
    const body = { reference_id: referenceId };
    const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
      this.va,
      body,
      'POST',
      this.apiKey
    );

    try {
      const response = await axios.post(`${this.baseUrl}/transaction/details`, JSON.parse(jsonBody), {
        ...this.axiosConfig,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
          'timestamp': timestamp,
        }
      });

      const responseData = response.data;
      return responseData;
    } catch (error: any) {
      throw new Error(`Status Check Error: ${error.response?.data?.Message || error.message}`);
    }
  }

  /**
   * Get available payment methods
   */
  async getPaymentMethods(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/payment-methods`, this.axiosConfig);
      const responseData = response.data;
      return responseData;
    } catch (error: any) {
      throw new Error(`Payment Methods Error: ${error.response?.data?.Message || error.message}`);
    }
  }
}
