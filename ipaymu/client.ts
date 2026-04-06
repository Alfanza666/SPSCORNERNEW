import axios, { AxiosInstance } from 'axios';
import { generateIpaymuSignature } from './signature';

export interface PaymentRequestData {
  name: string;
  email: string;
  phone: string;
  amount: number;
  notifyUrl: string;
  returnUrl?: string;
  cancelUrl?: string;
  referenceId: string;
  product?: string[];
  qty?: number[];
  price?: number[];
  paymentMethod?: string;
  paymentChannel?: string;
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
  private client: AxiosInstance;

  constructor(va: string, apiKey: string) {
    this.va = va;
    this.apiKey = apiKey;
    this.baseUrl = 'https://my.ipaymu.com/api/v2'; // Production endpoint

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  /**
   * Create Redirect Payment (user goes to Ipaymu payment page)
   */
  async createPayment(data: PaymentRequestData): Promise<IpaymuResponse> {
    const { signature, timestamp } = generateIpaymuSignature(
      this.va,
      data,
      'POST',
      this.apiKey
    );

    try {
      console.log('📤 Creating Ipaymu payment:', {
        reference: data.referenceId,
        amount: data.amount,
      });

      const response = await this.client.post<IpaymuResponse>('/payment', data, {
        headers: {
          va: this.va,
          signature,
          timestamp,
        },
      });

      if (response.data.Status === 200) {
        console.log('✅ Payment created:', response.data.Data?.SessionId);
        return response.data;
      } else {
        throw new Error(response.data.Message || 'Payment creation failed');
      }
    } catch (error: any) {
      console.error('❌ Payment Error:', error.response?.data || error.message);
      throw new Error(
        `Payment Error: ${error.response?.data?.Message || error.message}`
      );
    }
  }

  /**
   * Create Direct Payment (QRIS, Bank Transfer, etc)
   */
  async createDirectPayment(data: PaymentRequestData): Promise<IpaymuResponse> {
    const { signature, timestamp } = generateIpaymuSignature(
      this.va,
      data,
      'POST',
      this.apiKey
    );

    try {
      console.log('📤 Creating direct payment:', {
        reference: data.referenceId,
        method: data.paymentMethod,
      });

      const response = await this.client.post<IpaymuResponse>(
        '/payment/direct',
        data,
        {
          headers: {
            va: this.va,
            signature,
            timestamp,
          },
        }
      );

      if (response.data.Status === 200) {
        console.log('✅ Direct payment created');
        return response.data;
      } else {
        throw new Error(response.data.Message || 'Direct payment failed');
      }
    } catch (error: any) {
      console.error('❌ Direct Payment Error:', error.response?.data || error.message);
      throw new Error(
        `Direct Payment Error: ${error.response?.data?.Message || error.message}`
      );
    }
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(referenceId: string): Promise<any> {
    const body = { reference_id: referenceId };
    const { signature, timestamp } = generateIpaymuSignature(
      this.va,
      body,
      'POST',
      this.apiKey
    );

    try {
      const response = await this.client.post(
        '/transaction/details',
        body,
        {
          headers: {
            va: this.va,
            signature,
            timestamp,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ Status Check Error:', error.response?.data || error.message);
      throw new Error(
        `Status Check Error: ${error.response?.data?.Message || error.message}`
      );
    }
  }
}import axios from 'axios';

export class IpaymuClient {
    private apiKey: string;
    private apiUrl: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.apiUrl = 'https://api.ipaymu.com/'; // Replace with actual URL
    }

    async createPayment(data: any) {
        try {
            const response = await axios.post(`${this.apiUrl}createPayment`, data, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Error creating payment: ${error.response.data.message}`);
        }
    }

    async createDirectPayment(data: any) {
        try {
            const response = await axios.post(`${this.apiUrl}createDirectPayment`, data, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Error creating direct payment: ${error.response.data.message}`);
        }
    }
}
