import { IpaymuSignature } from './signature.js';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

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
  private fixieUrl: string | null;
  private axiosInstance: any;
  private requireStaticEgress: boolean;

  constructor(
    va: string,
    apiKey: string,
    production: boolean = false,
    axiosConfig: any = {},
    fixieUrl: string | null = null,
    requireStaticEgress: boolean = false,
  ) {
    this.va = va.trim();
    this.apiKey = apiKey.trim();
    this.baseUrl = production
      ? 'https://my.ipaymu.com/api/v2'
      : 'https://sandbox.ipaymu.com/api/v2';
    this.fixieUrl = fixieUrl;
    this.requireStaticEgress = requireStaticEgress;
    this.axiosConfig = requireStaticEgress && fixieUrl
      ? {
          ...axiosConfig,
          httpsAgent: new HttpsProxyAgent(fixieUrl),
          proxy: false,
        }
      : axiosConfig;
      
    // Transport dipilih sebelum request. Payment POST tidak boleh direplay
    // melalui jalur kedua setelah request pertama sudah dikirim.
    this.axiosInstance = axios.create(this.axiosConfig);

    console.log(`[Ipaymu] Mode: ${production ? 'PRODUCTION' : 'SANDBOX'}`);
  }

  getTransportMode(): 'direct' | 'fixie' | 'unavailable' {
    if (this.requireStaticEgress) return this.fixieUrl ? 'fixie' : 'unavailable';
    return 'direct';
  }

  private ensureTransportReady(): void {
    if (!this.requireStaticEgress || this.fixieUrl) return;

    const error: any = new Error('Static egress iPaymu belum tersedia pada runtime serverless.');
    error.statusCode = 503;
    error.code = 'IPAYMU_STATIC_EGRESS_UNAVAILABLE';
    error.ambiguous = false;
    throw error;
  }

  private createGatewayError(error: any, fallbackMessage: string): Error {
    const upstreamMessage = error.response?.data?.Message
      || error.response?.data?.message
      || error.message
      || fallbackMessage;
    const unauthorized = error.response?.status === 401
      || String(upstreamMessage).toLowerCase().includes('unauthorized');
    const uncertain = Boolean(error.request && !error.response);
    const gatewayError: any = new Error(
      unauthorized
        ? 'Konfigurasi jaringan iPaymu ditolak. Silakan hubungi Admin.'
        : `Gagal memproses pembayaran iPaymu: ${upstreamMessage}`,
    );
    gatewayError.statusCode = 502;
    gatewayError.code = unauthorized
      ? 'IPAYMU_UPSTREAM_UNAUTHORIZED'
      : uncertain
        ? 'IPAYMU_REQUEST_UNCERTAIN'
        : 'IPAYMU_UPSTREAM_ERROR';
    gatewayError.ambiguous = uncertain;
    return gatewayError;
  }

  /**
   * Create Redirect Payment
   * User akan diarahkan ke payment page Ipaymu
   */
  async createPayment(data: RedirectPaymentData): Promise<IpaymuResponse> {
    this.ensureTransportReady();
    const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
      this.va,
      data,
      'POST',
      this.apiKey
    );

    try {
      console.log('📤 Sending payment request to Ipaymu...');
      const response = await this.axiosInstance.post(`${this.baseUrl}/payment`, jsonBody, {
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
      throw this.createGatewayError(error, 'Payment creation failed');
    }
  }

  /**
   * Create Direct Payment
   * Payment langsung tanpa redirect ke Ipaymu
   */
  async createDirectPayment(data: DirectPaymentData): Promise<IpaymuResponse> {
    this.ensureTransportReady();
    const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
      this.va,
      data,
      'POST',
      this.apiKey
    );

    try {
      console.log('📤 Sending direct payment request...');
      const response = await this.axiosInstance.post(`${this.baseUrl}/payment/direct`, jsonBody, {
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
      throw this.createGatewayError(error, 'Direct payment failed');
    }
  }

  /**
   * Check transaction status
   * Per docs: https://docs.ipaymu.com/id/docs/transaction/check-transaction
   */
  async getTransactionStatus(transactionId: string): Promise<any> {
    this.ensureTransportReady();
    const body = { transactionId: transactionId, account: this.va };
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

      const responseData = response.data;
      return responseData;
    } catch (error: any) {
      throw new Error(`Status Check Error: ${error.response?.data?.Message || error.message}`);
    }
  }

  /**
   * Get transaction history
   * Per docs: https://docs.ipaymu.com/id/docs/transaction/history-transaction
   */
  async getTransactionHistory(filters: {
    status?: string;
    date?: string;
    startdate?: string;
    enddate?: string;
    page?: number;
    limit?: number;
    orderBy?: string;
    order?: string;
  } = {}): Promise<any> {
    this.ensureTransportReady();
    const body: Record<string, any> = {};
    if (filters.status) body.status = filters.status;
    if (filters.date) body.date = filters.date;
    if (filters.startdate) body.startdate = filters.startdate;
    if (filters.enddate) body.enddate = filters.enddate;
    if (filters.page) body.page = filters.page;
    if (filters.limit) body.limit = Math.min(filters.limit, 20);
    if (filters.orderBy) body.orderBy = filters.orderBy;
    if (filters.order) body.order = filters.order;

    const { signature, timestamp, jsonBody } = IpaymuSignature.generate(
      this.va,
      body,
      'POST',
      this.apiKey
    );

    try {
      const response = await this.axiosInstance.post(`${this.baseUrl}/history`, JSON.parse(jsonBody), {
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
      throw new Error(`History Error: ${error.response?.data?.Message || error.message}`);
    }
  }

  /**
   * Get available payment methods
   */
  async getPaymentMethods(): Promise<any> {
    this.ensureTransportReady();
    try {
      const response = await this.axiosInstance.get(`${this.baseUrl}/payment-methods`, this.axiosConfig);
      const responseData = response.data;
      return responseData;
    } catch (error: any) {
      throw new Error(`Payment Methods Error: ${error.response?.data?.Message || error.message}`);
    }
  }
}
