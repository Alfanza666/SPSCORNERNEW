import { IpaymuSignature } from './signature';

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

  constructor(va: string, apiKey: string, production: boolean = false) {
    this.va = va.trim();
    this.apiKey = apiKey.trim();
    this.baseUrl = production
      ? 'https://my.ipaymu.com/api/v2'
      : 'https://sandbox.ipaymu.com/api/v2';
      
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
      const response = await fetch(`${this.baseUrl}/payment`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
          'timestamp': timestamp,
        },
        body: jsonBody,
      });

      const responseData = await response.json();

      if (responseData.Status === 200) {
        console.log('✅ Payment request successful');
        return responseData;
      } else {
        throw new Error(responseData.Message || 'Payment creation failed');
      }
    } catch (error: any) {
      console.error('❌ Payment Error:', error);
      throw new Error(`Payment Error: ${error.message}`);
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
      const response = await fetch(`${this.baseUrl}/payment/direct`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
          'timestamp': timestamp,
        },
        body: jsonBody,
      });

      const responseData = await response.json();

      if (responseData.Status === 200) {
        console.log('✅ Direct payment request successful');
        return responseData;
      } else {
        throw new Error(responseData.Message || 'Direct payment failed');
      }
    } catch (error: any) {
      console.error('❌ Direct Payment Error:', error);
      throw new Error(`Direct Payment Error: ${error.message}`);
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
      const response = await fetch(`${this.baseUrl}/transaction/details`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
          'timestamp': timestamp,
        },
        body: jsonBody,
      });

      const responseData = await response.json();
      return responseData;
    } catch (error: any) {
      throw new Error(`Status Check Error: ${error.message}`);
    }
  }

  /**
   * Get available payment methods
   */
  async getPaymentMethods(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/payment-methods`);
      const responseData = await response.json();
      return responseData;
    } catch (error: any) {
      throw new Error(`Payment Methods Error: ${error.message}`);
    }
  }
}
